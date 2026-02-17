import { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, Briefcase, FileText, Calendar, Loader2, X } from 'lucide-react'
import { useSearchStore } from '@/stores/searchStore'
import { getSearchResultPath } from '@/lib/globalSearch'
import type { EntityType, SearchResult } from '@/types'
import { cn } from '@/lib/utils'

const ICONS: Record<EntityType, typeof User> = {
  client: User,
  case: Briefcase,
  document: FileText,
  deadline: Calendar,
}

const TYPE_LABELS: Record<EntityType, string> = {
  client: 'Clientes',
  case: 'Casos',
  document: 'Documentos',
  deadline: 'Prazos',
}

export default function SearchBar() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const {
    query,
    results,
    isOpen,
    loading,
    selectedIndex,
    setQuery,
    search,
    clear,
    setOpen,
    selectNext,
    selectPrevious,
  } = useSearchStore()

  // Group results by type
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = []
      }
      acc[result.type].push(result)
      return acc
    },
    {} as Record<EntityType, SearchResult[]>
  )

  // Debounced search
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value)

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      if (value.trim()) {
        setOpen(true)
        debounceTimerRef.current = setTimeout(() => {
          search()
        }, 300)
      } else {
        setOpen(false)
      }
    },
    [setQuery, setOpen, search]
  )

  // Handle result selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      const path = getSearchResultPath(result)
      navigate(path)
      clear()
    },
    [navigate, clear]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          selectNext()
          break
        case 'ArrowUp':
          e.preventDefault()
          selectPrevious()
          break
        case 'Enter':
          e.preventDefault()
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelect(results[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          clear()
          inputRef.current?.blur()
          break
      }
    },
    [isOpen, selectedIndex, results, selectNext, selectPrevious, handleSelect, clear]
  )

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setOpen])

  // Get flat index for a result
  const getFlatIndex = (type: EntityType, indexInGroup: number): number => {
    let flatIndex = 0
    const types: EntityType[] = ['client', 'case', 'document', 'deadline']

    for (const t of types) {
      if (t === type) {
        return flatIndex + indexInGroup
      }
      flatIndex += (groupedResults[t]?.length || 0)
    }
    return flatIndex
  }

  return (
    <div ref={containerRef} className="relative max-w-md w-full">
      {/* Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="size-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="size-5 text-gray-400" />
          )}
        </div>
        <input
          ref={inputRef}
          id="global-search"
          name="search"
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar clientes, casos, documentos..."
          className="block w-full pl-10 pr-8 py-[var(--search-input-py)] border border-border-dark rounded-lg leading-5 bg-surface-highlight text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
        />
        {query && (
          <button
            onClick={clear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white motion-hover"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (query.trim() || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-dark border border-border-dark rounded-lg shadow-xl overflow-hidden z-50 max-h-96 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="p-4 text-center text-gray-400">
              <Loader2 className="size-5 animate-spin mx-auto mb-2" />
              Buscando...
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <div className="p-4 text-center text-gray-400">
              Nenhum resultado encontrado para "{query}"
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {(['client', 'case', 'document', 'deadline'] as EntityType[]).map(
                (type) => {
                  const typeResults = groupedResults[type]
                  if (!typeResults?.length) return null

                  const Icon = ICONS[type]

                  return (
                    <div key={type}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {TYPE_LABELS[type]}
                      </div>
                      {typeResults.map((result, idx) => {
                        const flatIndex = getFlatIndex(type, idx)
                        const isSelected = flatIndex === selectedIndex

                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() =>
                              useSearchStore.setState({ selectedIndex: flatIndex })
                            }
                            className={cn(
                              'w-full px-3 py-[var(--search-item-py)] flex items-center gap-3 text-left transition-colors motion-hover',
                              isSelected
                                ? 'bg-primary/20 text-white'
                                : 'text-gray-300 hover:bg-surface-highlight'
                            )}
                          >
                            <Icon className="size-4 text-gray-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">
                                {result.title}
                              </div>
                              {result.subtitle && (
                                <div className="text-xs text-gray-500 truncate">
                                  {result.subtitle}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                }
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
