import {
  Sparkles,
  Brain,
  FileCode,
  Search,
  Terminal,
  Pencil,
  Wrench,
  FlaskConical,
  RotateCcw,
  TriangleAlert,
  CircleX,
  CircleCheckBig,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react"
import type { AgentEventType } from "@/lib/agent-lab/types"

export interface EventVisual {
  icon: LucideIcon
  /** classes for the small icon chip */
  chip: string
  label: string
}

const neutral = "bg-zinc-100 text-zinc-600 border-zinc-200"

export const eventVisuals: Record<AgentEventType, EventVisual> = {
  planning: { icon: Sparkles, chip: "bg-violet-50 text-violet-600 border-violet-100", label: "Planning" },
  thinking: { icon: Brain, chip: "bg-violet-50 text-violet-500 border-violet-100", label: "Thinking" },
  search: { icon: Search, chip: neutral, label: "Search" },
  file_read: { icon: FileCode, chip: neutral, label: "File read" },
  file_write: { icon: Pencil, chip: "bg-sky-50 text-sky-700 border-sky-100", label: "File edit" },
  shell: { icon: Terminal, chip: "bg-zinc-100 text-zinc-700 border-zinc-200", label: "Shell" },
  tool_call: { icon: Wrench, chip: neutral, label: "Tool call" },
  test: { icon: FlaskConical, chip: "bg-amber-50 text-amber-700 border-amber-100", label: "Test" },
  retry: { icon: RotateCcw, chip: "bg-amber-50 text-amber-600 border-amber-100", label: "Retry" },
  warning: { icon: TriangleAlert, chip: "bg-amber-50 text-amber-600 border-amber-100", label: "Warning" },
  error: { icon: CircleX, chip: "bg-red-50 text-red-600 border-red-100", label: "Error" },
  success: { icon: CircleCheckBig, chip: "bg-emerald-50 text-emerald-600 border-emerald-100", label: "Success" },
  final_output: {
    icon: MessageSquareText,
    chip: "bg-emerald-50 text-emerald-600 border-emerald-100",
    label: "Final output",
  },
}
