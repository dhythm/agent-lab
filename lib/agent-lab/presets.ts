import type { TaskType } from "./types"

export interface TaskPreset {
  id: string
  label: string
  description: string
  type: TaskType
  prompt: string
  repository?: string
  /** Sample files served from /public that are attached automatically. */
  samples?: { name: string; url: string }[]
}

export const taskPresets: TaskPreset[] = [
  {
    id: "coding-redirect",
    label: "Coding: auth redirect",
    description: "Modify a GitHub repository and run its tests",
    type: "coding",
    prompt:
      "このリポジトリを調査し、ログイン済みユーザーがトップページにアクセスした場合は /mypage に遷移するよう修正してください。関連するテストを追加し、既存テストもすべて実行してください。",
    repository: "",
  },
  {
    id: "data-anomalies",
    label: "Data: CSV anomaly analysis",
    description: "Analyze a sales CSV, find outliers, write analysis.md",
    type: "data",
    prompt:
      "添付の売上データ (sales.csv) を分析してください。1) 基本統計と月次推移をまとめる 2) 異常値 (外れ値・重複・欠損・日付の矛盾など) を根拠付きで抽出する 3) 可能ならグラフを PNG で生成する 4) 結果を analysis.md にまとめる。分析は Python などのコードを実際に実行して行ってください。",
    samples: [{ name: "sales.csv", url: "/samples/sales.csv" }],
  },
  {
    id: "data-cleansing",
    label: "Data: customer list cleansing",
    description: "Normalize a messy customer list into a strict JSON schema",
    type: "data",
    prompt:
      "添付の顧客リスト (customers.csv) を正規化してください。表記ゆれ (全角/半角、空白、電話番号・メールアドレスの形式、会社名の敬称) を統一し、重複を統合し、schema.json の JSON Schema に準拠した customers.json を生成してください。変換で判断に迷った行は decisions.md に理由とともに列挙してください。最後に schema に対するバリデーションを実行して結果を報告してください。",
    samples: [
      { name: "customers.csv", url: "/samples/customers.csv" },
      { name: "schema.json", url: "/samples/schema.json" },
    ],
  },
  {
    id: "research-compare",
    label: "Research: hosting comparison",
    description: "Web research and a Markdown comparison report",
    type: "research",
    prompt:
      "Vercel / Neon / Supabase を比較し、Next.js + PostgreSQL の小規模 SaaS (個人開発、月間 1 万ユーザー想定) に適した構成を提案してください。価格、無料枠、リージョン (東京)、スケール時の制約、ベンダーロックインの観点で比較表を作り、根拠となる URL を明記して report.md にまとめてください。",
  },
  {
    id: "doc-meeting",
    label: "Document: meeting notes → summary",
    description: "Turn raw meeting notes into a decision log and action items",
    type: "general",
    prompt:
      "添付の議事録 (meeting-notes.md) を読み、1) 決定事項 2) 未決事項と論点 3) 担当者・期限付きのアクションアイテム 4) 次回アジェンダ案 を summary.md にまとめてください。原文にない情報は補わず、曖昧な箇所は「要確認」と明記してください。",
    samples: [{ name: "meeting-notes.md", url: "/samples/meeting-notes.md" }],
  },
  {
    id: "coding-kata",
    label: "Coding: self-contained kata",
    description: "Implement a small CLI with tests, no repository needed",
    type: "coding",
    prompt:
      "TypeScript で CSV を集計する CLI ツールを新規に作成してください。要件: `csvsum <file> --group-by <col> --sum <col>` でグループごとの合計を表形式で出力する。ヘッダー行の有無、引用符付きフィールド、空セルに対応すること。vitest でユニットテストを書き、すべて通ることを確認してください。プロジェクト一式を /workspace/outputs/csvsum に保存してください。",
  },
  {
    id: "content-seo-outline",
    label: "Content: SEO article outline",
    description: "Design an article outline with verbatim source excerpts, validated by a CLI in the sandbox",
    type: "general",
    prompt:
      "添付の instructions.md に従い、input.json のタイトル・キーワード・クローリング記事 (reportResources) から SEO 記事の構成を outline.schema.json の形式で作成し、作業ディレクトリに outline.json として保存してください。保存後は必ず `node /workspace/inputs/validate-outline.mjs outline.json /workspace/inputs/input.json` で検証し、status が pass になるまで violations に示された不一致だけを修正して再実行してください (warnings は自動補正されるため配分修正のための再出力は不要)。pass したら `--submit <出力ディレクトリ>/outline.json` で提出し、validationId・章数・参照件数・総文字数・警告の要点を報告してください。記事本文は書かないでください。",
    samples: [
      { name: "instructions.md", url: "/samples/seo-outline/instructions.md" },
      { name: "input.json", url: "/samples/seo-outline/input.json" },
      { name: "outline.schema.json", url: "/samples/seo-outline/outline.schema.json" },
      { name: "validate-outline.mjs", url: "/samples/seo-outline/validate-outline.mjs" },
    ],
  },
]

export function findPreset(id: string): TaskPreset | undefined {
  return taskPresets.find((p) => p.id === id)
}
