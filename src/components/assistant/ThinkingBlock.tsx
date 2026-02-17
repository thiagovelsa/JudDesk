import { useState } from 'react'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThinkingBlockProps {
  content: string
}

const PREVIEW_LENGTH = 200

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)

  const preview = content.slice(0, PREVIEW_LENGTH)
  const hasMore = content.length > PREVIEW_LENGTH

  return (
    <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-purple-400 w-full text-left"
      >
        <Brain className="size-4 shrink-0" />
        <span className="font-medium">Raciocínio do Claude</span>
        {hasMore && (
          expanded
            ? <ChevronUp className="size-4 ml-auto shrink-0" />
            : <ChevronDown className="size-4 ml-auto shrink-0" />
        )}
      </button>

      <div
        className={cn(
          "mt-2 text-sm text-gray-300 whitespace-pre-wrap",
          !expanded && hasMore && "line-clamp-3"
        )}
      >
        {expanded ? content : preview}
        {!expanded && hasMore && "..."}
      </div>
    </div>
  )
}
