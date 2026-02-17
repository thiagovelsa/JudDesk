import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CalendarHeaderProps {
  currentDate: Date
  onDateChange: (date: Date) => void
}

export function CalendarHeader({ currentDate, onDateChange }: CalendarHeaderProps) {
  const handlePrevMonth = () => {
    onDateChange(subMonths(currentDate, 1))
  }

  const handleNextMonth = () => {
    onDateChange(addMonths(currentDate, 1))
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
          title="Mês anterior"
        >
          <ChevronLeft className="size-5 text-gray-400" />
        </button>

        <button
          onClick={handleToday}
          className="px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-surface-highlight rounded-lg transition-colors"
        >
          Hoje
        </button>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
          title="Próximo mês"
        >
          <ChevronRight className="size-5 text-gray-400" />
        </button>
      </div>

      <h2 className="text-xl font-semibold text-white capitalize">
        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
      </h2>

      <div className="w-[140px]" />
    </div>
  )
}
