import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import {
  History,
  Search,
  Filter,
  User,
  Briefcase,
  FileText,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  X,
} from 'lucide-react'
import { VariableSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'
import { cn } from '@/lib/utils'
import { getActivityLogs, formatAction, formatEntityType, parseActivityDetails } from '@/lib/activityLogger'
import type { ActivityLog, EntityType, ActionType } from '@/types'

/** Height of each activity row in pixels */
const ROW_HEIGHT = 72
/** Height of date header in pixels */
const HEADER_HEIGHT = 40
/** Threshold for enabling virtualization */
const VIRTUALIZATION_THRESHOLD = 100

type FlatListItem =
  | { type: 'date'; date: string }
  | { type: 'log'; log: ActivityLog }

const ENTITY_ICONS: Record<EntityType, typeof User> = {
  client: User,
  case: Briefcase,
  document: FileText,
  deadline: Calendar,
}

const ACTION_ICONS: Record<ActionType, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
}

const ACTION_COLORS: Record<ActionType, string> = {
  create: 'text-emerald-400 bg-emerald-400/10',
  update: 'text-blue-400 bg-blue-400/10',
  delete: 'text-red-400 bg-red-400/10',
}

// Memoized activity log item component
interface ActivityLogItemProps {
  log: ActivityLog
  getLogDescription: (log: ActivityLog) => string
  formatTime: (dateStr: string) => string
}

const ActivityLogItem = memo(function ActivityLogItem({
  log,
  getLogDescription,
  formatTime,
}: ActivityLogItemProps) {
  const EntityIcon = ENTITY_ICONS[log.entity_type]
  const ActionIcon = ACTION_ICONS[log.action]
  const actionColor = ACTION_COLORS[log.action]

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-surface-highlight/50 transition-colors border-b border-border-dark last:border-b-0">
      {/* Action Icon */}
      <div className={cn('p-2 rounded-lg', actionColor)}>
        <ActionIcon className="size-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <EntityIcon className="size-4 text-gray-500" />
          <span className="text-sm text-gray-500">
            {formatEntityType(log.entity_type)}
          </span>
        </div>
        <p className="text-white text-sm">
          {getLogDescription(log)}
        </p>
      </div>

      {/* Time */}
      <div className="text-sm text-gray-500 shrink-0">
        {formatTime(log.created_at)}
      </div>
    </div>
  )
})

export default function ActivityHistory() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [entityFilter, setEntityFilter] = useState<EntityType | 'all'>('all')
  const [actionFilter, setActionFilter] = useState<ActionType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: {
        entityType?: EntityType
        limit?: number
      } = {
        limit: 500,
      }

      if (entityFilter !== 'all') {
        filters.entityType = entityFilter
      }

      const data = await getActivityLogs(filters)
      setLogs(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [entityFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Filter logs by action and search (memoized)
  const filteredLogs = useMemo(() => logs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) {
      return false
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const entityName = log.entity_name?.toLowerCase() || ''
      const details = parseActivityDetails(log)
      const detailsStr = JSON.stringify(details).toLowerCase()
      if (!entityName.includes(query) && !detailsStr.includes(query)) {
        return false
      }
    }
    return true
  }), [logs, actionFilter, searchQuery])

  // Group logs by date (memoized)
  const groupedLogs = useMemo(() => filteredLogs.reduce(
    (acc, log) => {
      const date = new Date(log.created_at).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(log)
      return acc
    },
    {} as Record<string, ActivityLog[]>
  ), [filteredLogs])

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getLogDescription = useCallback((log: ActivityLog): string => {
    const action = formatAction(log.action)
    const entityType = formatEntityType(log.entity_type)
    const name = log.entity_name ? `"${log.entity_name}"` : `#${log.entity_id}`

    if (log.action === 'update' && log.details) {
      const details = parseActivityDetails(log)
      if (details && Object.keys(details).length > 0) {
        const fields = Object.keys(details).join(', ')
        return `${entityType} ${name} ${action.toLowerCase()} (${fields})`
      }
    }

    return `${entityType} ${name} ${action.toLowerCase()}`
  }, [])

  const formatTimeMemo = useCallback(formatTime, [])

  // Use virtualization only for large collections
  const useVirtualization = filteredLogs.length >= VIRTUALIZATION_THRESHOLD

  // Create flattened list for virtualization (date headers + log items)
  const flatList = useMemo((): FlatListItem[] => {
    const items: FlatListItem[] = []
    Object.entries(groupedLogs).forEach(([date, dayLogs]) => {
      items.push({ type: 'date', date })
      dayLogs.forEach((log) => {
        items.push({ type: 'log', log })
      })
    })
    return items
  }, [groupedLogs])

  // Row renderer for virtualized list
  const VirtualizedRow = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = flatList[index]

      if (item.type === 'date') {
        return (
          <div style={style} className="px-4">
            <h2 className="text-sm font-medium text-gray-400 pt-4 capitalize">{item.date}</h2>
          </div>
        )
      }

      return (
        <div style={style} className="bg-surface-dark">
          <ActivityLogItem
            log={item.log}
            getLogDescription={getLogDescription}
            formatTime={formatTimeMemo}
          />
        </div>
      )
    },
    [flatList, getLogDescription, formatTimeMemo]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Historico de Atividades</h1>
          <p className="text-gray-400 text-sm mt-1">
            Acompanhe todas as alteracoes realizadas no sistema
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            showFilters
              ? 'bg-primary text-white'
              : 'bg-surface-dark border border-border-dark text-gray-300 hover:bg-surface-highlight'
          )}
        >
          <Filter className="size-4" />
          Filtros
          {(entityFilter !== 'all' || actionFilter !== 'all') && (
            <span className="size-2 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-surface-dark border border-border-dark rounded-xl p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-gray-400 mb-1.5">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                <input
                  id="history-search"
                  name="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="w-full pl-10 pr-3 py-2 bg-background-dark border border-border-dark rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Entity Type Filter */}
            <div className="min-w-[150px]">
              <label className="block text-sm text-gray-400 mb-1.5">Tipo</label>
              <div className="relative">
                <select
                  id="entity-filter"
                  name="entityFilter"
                  value={entityFilter}
                  onChange={(e) => setEntityFilter(e.target.value as EntityType | 'all')}
                  className="w-full appearance-none px-3 py-2 pr-8 bg-background-dark border border-border-dark rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm cursor-pointer"
                >
                  <option value="all">Todos</option>
                  <option value="client">Clientes</option>
                  <option value="case">Casos</option>
                  <option value="document">Documentos</option>
                  <option value="deadline">Prazos</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Action Filter */}
            <div className="min-w-[150px]">
              <label className="block text-sm text-gray-400 mb-1.5">Acao</label>
              <div className="relative">
                <select
                  id="action-filter"
                  name="actionFilter"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value as ActionType | 'all')}
                  className="w-full appearance-none px-3 py-2 pr-8 bg-background-dark border border-border-dark rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm cursor-pointer"
                >
                  <option value="all">Todas</option>
                  <option value="create">Criacao</option>
                  <option value="update">Edicao</option>
                  <option value="delete">Exclusao</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Clear Filters */}
            {(entityFilter !== 'all' || actionFilter !== 'all' || searchQuery) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setEntityFilter('all')
                    setActionFilter('all')
                    setSearchQuery('')
                  }}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 text-primary animate-spin" />
        </div>
      )}

      {/* Activity List */}
      {!loading && filteredLogs.length > 0 && (
        <>
          {/* Virtualized list for large collections */}
          {useVirtualization ? (
            <div className="h-[calc(100vh-16rem)] bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    height={height}
                    width={width}
                    itemCount={flatList.length}
                    itemSize={(index) => flatList[index].type === 'date' ? HEADER_HEIGHT : ROW_HEIGHT}
                  >
                    {VirtualizedRow}
                  </List>
                )}
              </AutoSizer>
            </div>
          ) : (
            /* Regular list for small collections */
            <div className="space-y-6">
              {Object.entries(groupedLogs).map(([date, dayLogs]) => (
                <div key={date}>
                  <h2 className="text-sm font-medium text-gray-400 mb-3 capitalize">{date}</h2>
                  <div className="bg-surface-dark border border-border-dark rounded-xl">
                    {dayLogs.map((log) => (
                      <ActivityLogItem
                        key={log.id}
                        log={log}
                        getLogDescription={getLogDescription}
                        formatTime={formatTimeMemo}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && filteredLogs.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="size-16 bg-surface-dark rounded-full flex items-center justify-center mx-auto mb-4">
            <History className="size-8 text-gray-500" />
          </div>
          <h3 className="text-white font-medium mb-1">Nenhuma atividade</h3>
          <p className="text-gray-400 text-sm">
            {searchQuery || entityFilter !== 'all' || actionFilter !== 'all'
              ? 'Nenhuma atividade corresponde aos filtros aplicados'
              : 'O historico de atividades aparecera aqui'}
          </p>
        </div>
      )}
    </div>
  )
}
