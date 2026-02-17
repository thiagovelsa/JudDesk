import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  AlertTriangle,
  Briefcase,
  FileText,
  UserPlus,
  Upload,
  CalendarCheck,
  MessageSquare,
  ArrowUp,
  History,
} from 'lucide-react'
import { DashboardSkeleton } from '@/components/dashboard'
import { Card, Badge, Button, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useClientStore } from '@/stores/clientStore'
import { useCaseStore } from '@/stores/caseStore'
import { useDeadlineStore } from '@/stores/deadlineStore'
import { useDocumentStore } from '@/stores/documentStore'
import type { Deadline } from '@/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const { clients, fetchClients } = useClientStore()
  const { cases, fetchCases } = useCaseStore()
  const { deadlines, fetchDeadlines } = useDeadlineStore()
  const { documents, fetchDocuments } = useDocumentStore()

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          fetchClients(),
          fetchCases(),
          fetchDeadlines(),
          fetchDocuments(),
        ])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [fetchClients, fetchCases, fetchDeadlines, fetchDocuments])

  const deadlineStats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const futureDate = new Date(today)
    futureDate.setDate(today.getDate() + 7)

    const upcoming: Deadline[] = []
    let overdueCount = 0
    let pendingCount = 0

    for (const d of deadlines) {
      if (d.completed) continue

      const dueDate = new Date(d.due_date)
      dueDate.setHours(0, 0, 0, 0)

      if (dueDate < today) {
        overdueCount++
      } else if (dueDate <= futureDate) {
        upcoming.push(d)
      }

      pendingCount++
    }

    upcoming.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

    return {
      upcoming,
      overdueCount,
      pendingCount,
      completedCount: deadlines.length - pendingCount,
    }
  }, [deadlines])

  const upcomingDeadlines = deadlineStats.upcoming
  const overdueCount = deadlineStats.overdueCount

  type ChangeType = 'positive' | 'negative' | 'neutral'

  const stats = [
    {
      label: 'Clientes Ativos',
      value: clients.length.toString(),
      change: clients.length > 0 ? `${clients.length} cadastrados` : undefined,
      changeType: 'positive' as ChangeType,
      icon: Users,
      iconColor: 'text-[var(--color-primary)]',
    },
    {
      label: 'Prazos Pendentes',
      value: deadlineStats.pendingCount.toString(),
      badge: overdueCount > 0 ? `${overdueCount} vencidos` : undefined,
      changeType: overdueCount > 0 ? 'negative' : 'neutral' as ChangeType,
      icon: AlertTriangle,
      iconColor: overdueCount > 0 ? 'text-[var(--color-urgent)]' : 'text-amber-400',
    },
    {
      label: 'Casos Ativos',
      value: cases.filter((c) => c.status === 'ativo').length.toString(),
      change: cases.length > 0 ? `${cases.length} total` : undefined,
      changeType: 'neutral' as ChangeType,
      icon: Briefcase,
      iconColor: 'text-[var(--color-success)]',
    },
    {
      label: 'Documentos',
      value: documents.length.toString(),
      changeType: 'neutral' as ChangeType,
      icon: FileText,
      iconColor: 'text-zinc-400',
    },
  ]

  const quickActions = [
    { icon: UserPlus, label: 'Novo Cliente', action: () => navigate('/clients') },
    { icon: Upload, label: 'Importar Doc', action: () => navigate('/documents') },
    { icon: CalendarCheck, label: 'Novo Prazo', action: () => navigate('/calendar') },
    { icon: MessageSquare, label: 'Assistente IA', action: () => navigate('/assistant') },
  ]

  const formatDeadlineDate = (deadline: Deadline) => {
    const date = new Date(deadline.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const deadlineDate = new Date(date)
    deadlineDate.setHours(0, 0, 0, 0)

    if (deadlineDate < today) return 'Vencido'
    if (deadlineDate.getTime() === today.getTime()) return 'Hoje'
    if (deadlineDate.getTime() === tomorrow.getTime()) return 'Amanha'
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const formatDeadlineTime = (deadline: Deadline) => {
    const date = new Date(deadline.due_date)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const getTimeStyle = (deadline: Deadline) => {
    const date = new Date(deadline.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deadlineDate = new Date(date)
    deadlineDate.setHours(0, 0, 0, 0)

    if (deadlineDate < today) return 'overdue'
    if (deadlineDate.getTime() === today.getTime()) return 'urgent'
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (deadlineDate.getTime() === tomorrow.getTime()) return 'warning'
    return null
  }

  const getPriorityBadgeVariant = (priority: Deadline['priority']) => {
    switch (priority) {
      case 'urgente': return 'danger'
      case 'alta': return 'warning'
      case 'normal': return 'info'
      case 'baixa': return 'neutral'
      default: return 'neutral'
    }
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="flex flex-col gap-6 stagger-children">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} hoverable className="relative overflow-hidden">
            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
              <stat.icon className={cn('size-20', stat.iconColor)} />
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm font-medium mb-1">{stat.label}</p>
            <div className="flex items-end gap-2">
              <p className="text-[var(--color-text-primary)] text-3xl font-bold">{stat.value}</p>
              {stat.change && (
                <span
                  className={cn(
                    'text-xs font-medium mb-1.5 flex items-center gap-0.5',
                    stat.changeType === 'positive' && 'text-[var(--color-success)]',
                    stat.changeType === 'negative' && 'text-[var(--color-urgent)]',
                    stat.changeType === 'neutral' && 'text-[var(--color-primary-light)]'
                  )}
                >
                  {stat.changeType === 'positive' && <ArrowUp className="size-3" />}
                  {stat.change}
                </span>
              )}
              {stat.badge && (
                <Badge variant="danger" size="sm">{stat.badge}</Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-[var(--color-text-primary)] text-lg font-semibold mb-3 px-1">Acoes Rapidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.action}
              className="flex flex-col items-center justify-center gap-3 p-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-strong)] transition-all duration-200 group card-hover"
            >
              <div className="p-3 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-border-subtle)]">
                <action.icon className="size-5" strokeWidth={1.5} />
              </div>
              <span className="text-[var(--color-text-primary)] text-sm font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deadlines Table */}
        <div className="flex flex-col gap-6">
          <Card padding="none" className="flex flex-col h-full">
            <div className="p-5 border-b border-[var(--color-border-default)] flex items-center justify-between">
              <h3 className="text-[var(--color-text-primary)] font-semibold flex items-center gap-2">
                <AlertTriangle className="size-5 text-[var(--color-urgent)]" />
                Prazos Proximos
              </h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
                Ver todos
              </Button>
            </div>
            <div className="overflow-x-auto flex-1">
              {upcomingDeadlines.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-bg-tertiary)] text-xs uppercase font-semibold text-[var(--color-text-secondary)] sticky top-0 z-10">
                    <tr>
                      <th className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">Data</th>
                      <th className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">Titulo</th>
                      <th className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">Prioridade</th>
                      <th className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] text-right">Acao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-default)]">
                    {upcomingDeadlines.slice(0, 5).map((deadline) => {
                      const timeStyle = getTimeStyle(deadline)
                      return (
                        <tr key={deadline.id} className="hover:bg-[var(--color-bg-tertiary)]/50 transition-colors">
                          <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] whitespace-nowrap font-mono">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'font-medium',
                                timeStyle === 'overdue' ? 'text-[var(--color-urgent)]' : 'text-[var(--color-text-primary)]'
                              )}>
                                {formatDeadlineDate(deadline)}
                              </span>
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded text-[10px] font-bold border',
                                  timeStyle === 'overdue' && 'bg-red-500/20 text-red-400 border-red-500/30',
                                  timeStyle === 'urgent' && 'bg-red-500/20 text-red-400 border-red-500/30',
                                  timeStyle === 'warning' && 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                                  !timeStyle && 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border-[var(--color-border-default)]'
                                )}
                              >
                                {formatDeadlineTime(deadline)}
                              </span>
                            </div>
                          </td>
                          <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] text-[var(--color-text-primary)] font-medium">{deadline.title}</td>
                          <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">
                            <Badge variant={getPriorityBadgeVariant(deadline.priority)}>
                              {deadline.priority === 'urgente' ? 'Urgente' :
                                deadline.priority === 'alta' ? 'Alta' :
                                  deadline.priority === 'normal' ? 'Normal' : 'Baixa'}
                            </Badge>
                          </td>
                          <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate('/calendar')}
                            >
                              Detalhes
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <EmptyState
                  icon={<CalendarCheck className="size-8" />}
                  title="Nenhum prazo proximo"
                  description="Voce nao tem prazos agendados para os proximos 7 dias."
                  action={{
                    label: 'Adicionar prazo',
                    onClick: () => navigate('/calendar')
                  }}
                />
              )}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {/* Summary Stats */}
          <Card className="flex-1">
            <h3 className="text-[var(--color-text-primary)] font-semibold mb-4 flex items-center gap-2">
              <History className="size-5 text-[var(--color-text-muted)]" />
              Resumo do Sistema
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)]/50 rounded-xl border border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-primary-muted)]">
                    <Users className="size-4 text-[var(--color-primary)]" />
                  </div>
                  <span className="text-[var(--color-text-secondary)] text-sm">Clientes</span>
                </div>
                <span className="text-[var(--color-text-primary)] font-bold">{clients.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)]/50 rounded-xl border border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-success)]/10">
                    <Briefcase className="size-4 text-[var(--color-success)]" />
                  </div>
                  <span className="text-[var(--color-text-secondary)] text-sm">Casos Ativos</span>
                </div>
                <span className="text-[var(--color-text-primary)] font-bold">{cases.filter((c) => c.status === 'ativo').length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)]/50 rounded-xl border border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <AlertTriangle className="size-4 text-amber-400" />
                  </div>
                  <span className="text-[var(--color-text-secondary)] text-sm">Prazos Pendentes</span>
                </div>
                <span className="text-[var(--color-text-primary)] font-bold">{deadlines.filter((d) => !d.completed).length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)]/50 rounded-xl border border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-500/10">
                    <FileText className="size-4 text-zinc-400" />
                  </div>
                  <span className="text-[var(--color-text-secondary)] text-sm">Documentos</span>
                </div>
                <span className="text-[var(--color-text-primary)] font-bold">{documents.length}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
