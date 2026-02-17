import { ExternalLink, Globe } from 'lucide-react'
import type { WebSearchResult } from '@/lib/ai'

interface WebSearchResultsProps {
  results: WebSearchResult[]
}

export function WebSearchResults({ results }: WebSearchResultsProps) {
  if (!results || results.length === 0) return null

  return (
    <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
      <div className="flex items-center gap-2 text-sm text-blue-400 mb-2">
        <Globe className="size-4" />
        <span className="font-medium">Fontes consultadas ({results.length})</span>
      </div>

      <div className="space-y-2">
        {results.map((result, i) => (
          <a
            key={i}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 p-2 bg-zinc-900/50 rounded hover:bg-zinc-800/50 transition-colors group"
          >
            <ExternalLink className="size-4 text-gray-400 mt-0.5 shrink-0 group-hover:text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate group-hover:text-blue-300">
                {result.title}
              </p>
              {result.snippet && (
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                  {result.snippet}
                </p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
