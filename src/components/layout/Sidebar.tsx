import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  MessageSquare,
  History,
  Settings,
  Scale,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Visão Geral' },
  { to: '/clients', icon: Users, label: 'Clientes' },
  { to: '/documents', icon: FileText, label: 'Documentos' },
  { to: '/calendar', icon: Calendar, label: 'Agenda' },
  { to: '/assistant', icon: MessageSquare, label: 'Assistente IA', beta: true },
  { to: '/history', icon: History, label: 'Histórico' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

export default function Sidebar() {
  const navigate = useNavigate()

  const handleNewCase = () => {
    navigate('/clients')
  }

  return (
    <aside className="w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border-subtle)] flex flex-col h-full shrink-0">
      <div className="flex flex-col h-full p-4">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-8 mt-2">
          <div className="rounded-lg size-10 flex items-center justify-center bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-primary)]">
            <Scale className="size-5" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <h1 className="font-display text-white text-lg font-semibold leading-tight tracking-tight">
              JurisDesk
            </h1>
            <p className="text-[var(--color-text-muted)] text-[10px] font-medium uppercase tracking-[0.08em] leading-normal">
              Gestao Juridica
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden motion-hover',
                  isActive
                    ? 'bg-[var(--color-primary-muted)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[var(--color-primary)] rounded-full" />
                  )}
                  <item.icon
                    className={cn(
                      'size-5 transition-colors duration-200 motion-hover',
                      isActive ? 'text-[var(--color-primary)]' : 'group-hover:text-[var(--color-text-primary)]'
                    )}
                    strokeWidth={1.5}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.beta && (
                    <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                      BETA
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* New Case Button */}
        <Button
          onClick={handleNewCase}
          className="mt-auto mb-4 w-full"
          leftIcon={<Plus className="size-4" />}
          title="Selecione um cliente para criar um novo caso"
        >
          Novo Caso
        </Button>

        {/* Status */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-bg-tertiary)]/50 border border-[var(--color-border-subtle)]">
          <div className="relative flex items-center justify-center">
            <div className="size-2 rounded-full bg-[var(--color-success)]" />
            <div className="absolute size-2 rounded-full bg-[var(--color-success)] animate-ping opacity-75" />
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">Sistema Online</span>
        </div>
      </div>
    </aside>
  )
}
