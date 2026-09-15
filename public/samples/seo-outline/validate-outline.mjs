#!/usr/bin/env node
// Outline validator for the SEO article outline task.
// Zero dependencies so it can run unchanged inside an agent sandbox.
//
//   node validate-outline.mjs <outline.json> <input.json> [--submit <path>]
//
// Prints a JSON report. Exit code: 0 = pass, 1 = fail, 2 = usage / parse error.
// With --submit and status=pass, the adjusted outline (with validationId) is written to <path>.

import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const TOP_LEVEL_KEYS = ["direction", "chapters", "references", "coverage_check"]
const EVIDENCE_TYPES = ["crawl_required", "crawl_optional", "generic_only_ok"]
const SUMMARY_TITLE = "この記事のまとめ"
const SUMMARY_RANGE = [250, 300]
const TOTAL_RANGE = [5000, 6000]
const SECTION_MIN = 400
const H2_MAX = 20
const H3_MAX = 25
const FORBIDDEN_HEADINGS = ["おわりに", "よくある質問", "FAQ"]

function normalizeText(text) {
  return String(text).replace(/\s+/g, "")
}

function charCount(text) {
  return Array.from(String(text)).length
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function chapterTotal(chapter) {
  if (chapter.sections.length > 0) {
    return chapter.sections.reduce((sum, section) => sum + section.targetCharCount, 0)
  }
  return chapter.targetCharCount
}

function toInt(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function normalizeSection(raw) {
  return {
    id: String(raw?.id ?? ""),
    title: String(raw?.title ?? ""),
    targetCharCount: toInt(raw?.targetCharCount),
    overview: String(raw?.overview ?? ""),
    cautions: Array.isArray(raw?.cautions) ? raw.cautions.map(String) : [],
  }
}

function normalizeChapter(raw) {
  return {
    id: String(raw?.id ?? ""),
    title: String(raw?.title ?? ""),
    evidence_type: String(raw?.evidence_type ?? ""),
    targetCharCount: toInt(raw?.targetCharCount),
    overview: String(raw?.overview ?? ""),
    cautions: Array.isArray(raw?.cautions) ? raw.cautions.map(String) : [],
    sections: Array.isArray(raw?.sections) ? raw.sections.map(normalizeSection) : [],
  }
}

function normalizeReference(raw, index) {
  return {
    id: String(raw?.id ?? `r${index + 1}`),
    chapterId: String(raw?.chapterId ?? ""),
    sectionId: raw?.sectionId == null ? null : String(raw.sectionId),
    title: String(raw?.title ?? ""),
    url: String(raw?.url ?? ""),
    excerpt: String(raw?.excerpt ?? ""),
    intendedUse: String(raw?.intendedUse ?? ""),
  }
}

function checkStructure(outline, chapters, violations) {
  for (const key of Object.keys(outline)) {
    if (!TOP_LEVEL_KEYS.includes(key)) violations.push({ code: "unexpected_key", message: `Unexpected top-level key: ${key}` })
  }
  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in outline)) violations.push({ code: "missing_key", message: `Missing top-level key: ${key}` })
  }
  if (chapters.length < 2) {
    violations.push({ code: "too_few_chapters", message: "At least two chapters are required (summary + body)" })
  }
  if (chapters[0] && chapters[0].title !== SUMMARY_TITLE) {
    violations.push({
      code: "missing_summary_chapter",
      chapterId: chapters[0].id,
      message: `The first chapter must be titled "${SUMMARY_TITLE}"`,
    })
  }
  const seenChapters = new Set()
  const seenSections = new Set()
  chapters.forEach((chapter, index) => {
    if (!chapter.id) violations.push({ code: "missing_id", message: `Chapter at index ${index} has no id` })
    if (seenChapters.has(chapter.id)) violations.push({ code: "duplicate_id", chapterId: chapter.id, message: `Duplicate chapter id ${chapter.id}` })
    seenChapters.add(chapter.id)
    if (!EVIDENCE_TYPES.includes(chapter.evidence_type)) {
      violations.push({
        code: "invalid_evidence_type",
        chapterId: chapter.id,
        message: `evidence_type must be one of ${EVIDENCE_TYPES.join(", ")} (got "${chapter.evidence_type}")`,
      })
    }
    const isEdge = index === 0 || index === chapters.length - 1
    if (isEdge && chapter.sections.length > 0) {
      violations.push({ code: "sections_in_edge_chapter", chapterId: chapter.id, message: "The first and last chapters must not be split into sections" })
    }
    for (const title of [chapter.title, ...chapter.sections.map((s) => s.title)]) {
      if (FORBIDDEN_HEADINGS.some((word) => title.includes(word))) {
        violations.push({ code: "forbidden_heading", chapterId: chapter.id, message: `Forbidden heading: ${title}` })
      }
    }
    for (const section of chapter.sections) {
      if (!section.id) violations.push({ code: "missing_id", chapterId: chapter.id, message: `A section in ${chapter.id} has no id` })
      if (seenSections.has(section.id)) violations.push({ code: "duplicate_id", chapterId: chapter.id, message: `Duplicate section id ${section.id}` })
      seenSections.add(section.id)
    }
  })
}

function checkReferences(references, chapters, resources, violations) {
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const resourceByUrl = new Map(resources.map((r) => [String(r.url), r]))
  references.forEach((ref) => {
    const chapter = chapterById.get(ref.chapterId)
    if (!chapter) {
      violations.push({ code: "unknown_chapter", referenceId: ref.id, message: `Reference ${ref.id} points at unknown chapter ${ref.chapterId}` })
    } else if (ref.sectionId !== null && !chapter.sections.some((s) => s.id === ref.sectionId)) {
      violations.push({ code: "unknown_section", referenceId: ref.id, chapterId: chapter.id, message: `Reference ${ref.id} points at unknown section ${ref.sectionId} in ${chapter.id}` })
    }
    const resource = resourceByUrl.get(ref.url)
    if (!resource) {
      violations.push({ code: "unknown_resource", referenceId: ref.id, message: `Reference ${ref.id} uses a URL that is not in reportResources: ${ref.url}` })
      return
    }
    const excerpt = normalizeText(ref.excerpt)
    if (excerpt.length === 0) {
      violations.push({ code: "empty_excerpt", referenceId: ref.id, message: `Reference ${ref.id} has an empty excerpt` })
    } else if (!normalizeText(resource.content ?? "").includes(excerpt)) {
      violations.push({
        code: "excerpt_not_found",
        referenceId: ref.id,
        message: `Reference ${ref.id}: excerpt is not a verbatim, contiguous passage of "${resource.title ?? ref.url}". Copy the original text without summarizing, joining distant passages, or adding ellipses.`,
      })
    }
  })
}

function checkCoverage(chapters, references, violations) {
  const referenced = new Set(references.map((r) => r.chapterId))
  for (const chapter of chapters) {
    if (chapter.evidence_type === "crawl_required" && !referenced.has(chapter.id)) {
      violations.push({
        code: "crawl_required_without_reference",
        chapterId: chapter.id,
        message: `Chapter ${chapter.id} is crawl_required but has no reference. Add a reference or change evidence_type only if the chapter truly stands on general knowledge.`,
      })
    }
  }
}

function collectWarnings(chapters, references, warnings) {
  chapters.forEach((chapter, index) => {
    if (charCount(chapter.title) > H2_MAX) {
      warnings.push({ code: "heading_too_long", chapterId: chapter.id, message: `H2 "${chapter.title}" exceeds ${H2_MAX} characters` })
    }
    if (/について$|ご紹介|[（(]/.test(chapter.title) || /^\d+[.．、]/.test(chapter.title)) {
      warnings.push({ code: "heading_style", chapterId: chapter.id, message: `H2 "${chapter.title}" uses a discouraged pattern (numbering, brackets, 〜について, ご紹介)` })
    }
    if (chapter.sections.length > 0 && chapter.targetCharCount !== chapterTotal(chapter)) {
      warnings.push({ code: "chapter_total_mismatch", chapterId: chapter.id, message: `Chapter ${chapter.id} targetCharCount (${chapter.targetCharCount}) differs from the sum of its sections (${chapterTotal(chapter)}); the section sum is used` })
    }
    for (const section of chapter.sections) {
      if (charCount(section.title) > H3_MAX) {
        warnings.push({ code: "heading_too_long", chapterId: chapter.id, sectionId: section.id, message: `H3 "${section.title}" exceeds ${H3_MAX} characters` })
      }
      if (section.targetCharCount < SECTION_MIN) {
        warnings.push({ code: "section_too_short", chapterId: chapter.id, sectionId: section.id, message: `Section ${section.id} targets ${section.targetCharCount} characters; sections should have at least ${SECTION_MIN}. Consider merging sections.` })
      }
    }
    if (index === 0 && (chapter.targetCharCount < SUMMARY_RANGE[0] || chapter.targetCharCount > SUMMARY_RANGE[1])) {
      warnings.push({ code: "summary_chars_adjusted", chapterId: chapter.id, message: `Summary chapter targeted ${chapter.targetCharCount} characters; adjusted into ${SUMMARY_RANGE[0]}–${SUMMARY_RANGE[1]}` })
    }
  })
  const seenExcerpts = new Map()
  for (const ref of references) {
    const key = normalizeText(ref.excerpt)
    if (seenExcerpts.has(key)) {
      warnings.push({ code: "duplicate_excerpt", referenceId: ref.id, message: `Reference ${ref.id} repeats the excerpt of ${seenExcerpts.get(key)}` })
    } else {
      seenExcerpts.set(key, ref.id)
    }
    const sentences = ref.excerpt.split(/[。！？!?]\s*/).filter((s) => s.trim().length > 0).length
    if (sentences < 3 || sentences > 5) {
      warnings.push({ code: "excerpt_length", referenceId: ref.id, message: `Reference ${ref.id} excerpt has ${sentences} sentence(s); 3–5 is the guideline unless a shorter passage carries the needed condition` })
    }
  }
}

function adjustCharCounts(chapters, warnings) {
  const adjusted = chapters.map((chapter) => ({ ...chapter, sections: chapter.sections.map((s) => ({ ...s })) }))
  if (adjusted.length === 0) return adjusted
  const summary = adjusted[0]
  summary.targetCharCount = Math.min(SUMMARY_RANGE[1], Math.max(SUMMARY_RANGE[0], summary.targetCharCount))
  const body = adjusted.slice(1)
  const bodyTotal = body.reduce((sum, c) => sum + chapterTotal(c), 0)
  const total = summary.targetCharCount + bodyTotal
  if (total >= TOTAL_RANGE[0] && total <= TOTAL_RANGE[1]) return adjusted
  const target = total < TOTAL_RANGE[0] ? TOTAL_RANGE[0] : TOTAL_RANGE[1]
  const bodyTarget = target - summary.targetCharCount
  if (bodyTotal <= 0) return adjusted
  const factor = bodyTarget / bodyTotal
  for (const chapter of body) {
    if (chapter.sections.length > 0) {
      for (const section of chapter.sections) section.targetCharCount = Math.round(section.targetCharCount * factor)
      chapter.targetCharCount = chapterTotal(chapter)
    } else {
      chapter.targetCharCount = Math.round(chapter.targetCharCount * factor)
    }
  }
  // Absorb rounding drift in the largest body chapter so the total lands exactly on the bound.
  const drift = target - (summary.targetCharCount + body.reduce((sum, c) => sum + chapterTotal(c), 0))
  if (drift !== 0) {
    const largest = body.reduce((a, b) => (chapterTotal(b) > chapterTotal(a) ? b : a))
    if (largest.sections.length > 0) {
      largest.sections[0].targetCharCount += drift
      largest.targetCharCount = chapterTotal(largest)
    } else {
      largest.targetCharCount += drift
    }
  }
  warnings.push({
    code: "total_chars_adjusted",
    message: `Total targetCharCount was ${total}; body chapters were rescaled to reach ${target} (target range ${TOTAL_RANGE[0]}–${TOTAL_RANGE[1]}). Do not re-emit the outline just to fix this.`,
  })
  return adjusted
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

export function validateOutline(rawOutline, input) {
  const violations = []
  const warnings = []
  if (!isObject(rawOutline)) {
    return { status: "fail", validationId: null, violations: [{ code: "invalid_outline", message: "Outline must be a JSON object" }], warnings, outline: null, summary: null }
  }
  const resources = Array.isArray(input?.reportResources) ? input.reportResources : []
  const chapters = Array.isArray(rawOutline.chapters) ? rawOutline.chapters.map(normalizeChapter) : []
  const references = Array.isArray(rawOutline.references) ? rawOutline.references.map(normalizeReference) : []
  const coverage = isObject(rawOutline.coverage_check) ? rawOutline.coverage_check : {}

  checkStructure(rawOutline, chapters, violations)
  checkReferences(references, chapters, resources, violations)
  checkCoverage(chapters, references, violations)
  collectWarnings(chapters, references, warnings)

  const adjustedChapters = adjustCharCounts(chapters, warnings)
  const crawlRequired = chapters.filter((c) => c.evidence_type === "crawl_required").length
  const ratio = chapters.length > 0 ? Math.round((crawlRequired / chapters.length) * 100) / 100 : 0
  const givenRatio = Number(coverage.crawlRequiredRatio)
  if (!Number.isFinite(givenRatio) || Math.abs(givenRatio - ratio) > 0.01) {
    warnings.push({ code: "crawl_required_ratio_adjusted", message: `coverage_check.crawlRequiredRatio corrected to ${ratio} (${crawlRequired} of ${chapters.length} H2 are crawl_required)` })
  }

  const outline = {
    direction: String(rawOutline.direction ?? ""),
    chapters: adjustedChapters,
    references,
    coverage_check: {
      adoptedSlots: Array.isArray(coverage.adoptedSlots) ? coverage.adoptedSlots.map(String) : [],
      missingSlots: Array.isArray(coverage.missingSlots) ? coverage.missingSlots : [],
      crawlRequiredRatio: ratio,
    },
  }
  const status = violations.length === 0 ? "pass" : "fail"
  const validationId =
    status === "pass" ? createHash("sha256").update(JSON.stringify(canonical(outline))).digest("hex").slice(0, 16) : null
  const total = adjustedChapters.reduce((sum, c) => sum + chapterTotal(c), 0)
  return {
    status,
    validationId,
    violations,
    warnings,
    outline,
    summary: { chapters: chapters.length, references: references.length, distinctResources: new Set(references.map((r) => r.url)).size, totalChars: total, crawlRequiredRatio: ratio },
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"))
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--"))
  const submitIndex = argv.indexOf("--submit")
  const submitPath = submitIndex >= 0 ? argv[submitIndex + 1] : undefined
  if (args.length < 2 || (submitIndex >= 0 && !submitPath)) {
    console.error("Usage: node validate-outline.mjs <outline.json> <input.json> [--submit <path>]")
    return 2
  }
  let outline
  let input
  try {
    outline = readJson(args[0])
  } catch (error) {
    console.log(JSON.stringify({ status: "fail", violations: [{ code: "invalid_json", message: `Could not parse ${args[0]}: ${error.message}` }] }, null, 2))
    return 2
  }
  try {
    input = readJson(args[1])
  } catch (error) {
    console.error(`Could not parse ${args[1]}: ${error.message}`)
    return 2
  }
  const report = validateOutline(outline, input)
  const { outline: adjusted, ...printable } = report
  let submitted
  if (report.status === "pass" && submitPath) {
    mkdirSync(path.dirname(submitPath), { recursive: true })
    writeFileSync(submitPath, JSON.stringify({ validationId: report.validationId, ...adjusted }, null, 2), "utf8")
    submitted = submitPath
  }
  console.log(JSON.stringify({ ...printable, ...(submitted ? { submitted } : {}) }, null, 2))
  return report.status === "pass" ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}
