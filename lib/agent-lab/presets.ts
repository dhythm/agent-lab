import type { TaskType } from "./types"
import { ARTICLE_TASK_TEMPLATE } from "@/lib/article-writer/template"

export interface TaskPreset {
  id: string
  label: string
  description: string
  type: TaskType
  prompt: string
  systemPrompt?: string
  promptUrl?: string
  systemPromptUrl?: string
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
    id: "content-seo-article",
    label: "SEO article writing",
    description: "Task text is the writer prompt with {{variables}}; the JSON attachment fills them, the agent writes article.json",
    type: "article",
    prompt: ARTICLE_TASK_TEMPLATE,
    samples: [{ name: "article-input.json", url: "/samples/article-writer/article-input.json" }],
  },
  {
    id: "seo-proofread",
    label: "SEO article proofreading",
    description: "Proofread citations and readability into strict JSON",
    type: "seo-proofread",
    prompt: "",
    promptUrl: "/samples/seo-proofread-user.txt",
    systemPromptUrl: "/samples/seo-proofread-system.txt",
  },
]

export function findPreset(id: string): TaskPreset | undefined {
  return taskPresets.find((p) => p.id === id)
}
