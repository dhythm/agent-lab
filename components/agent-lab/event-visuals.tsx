import {
  Sparkles,
  FileCode,
  Search,
  Terminal,
  Pencil,
  TriangleAlert,
  RotateCcw,
  CircleCheckBig,
  type LucideIcon,
} from "lucide-react"
import type { EventType } from "@/lib/agent-lab-data"

export interface EventVisual {
  icon: LucideIcon
  /** classes for the small icon chip */
  chip: string
  label: string
}

export const eventVisuals: Record<EventType, EventVisual> = {
  thinking: {
    icon: Sparkles,
    chip: "bg-violet-50 text-violet-600 border-violet-100",
    label: "Thinking",
  },
  search: {
    icon: Search,
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
    label: "Search",
  },
  file: {
    icon: FileCode,
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
    label: "File",
  },
  shell: {
    icon: Terminal,
    chip: "bg-zinc-100 text-zinc-700 border-zinc-200",
    label: "Shell",
  },
  edit: {
    icon: Pencil,
    chip: "bg-zinc-100 text-zinc-600 border-zinc-200",
    label: "Edit",
  },
  "test-failure": {
    icon: TriangleAlert,
    chip: "bg-red-50 text-red-600 border-red-100",
    label: "Test failure",
  },
  retry: {
    icon: RotateCcw,
    chip: "bg-amber-50 text-amber-600 border-amber-100",
    label: "Retry",
  },
  success: {
    icon: CircleCheckBig,
    chip: "bg-emerald-50 text-emerald-600 border-emerald-100",
    label: "Success",
  },
}
