import { DollarSign } from 'lucide-react'
import { formatCost, formatCostBRL } from '@/lib/costTracker'

interface MessageCostProps {
  costUsd: number
  showBrl?: boolean
}

export function MessageCost({ costUsd, showBrl = true }: MessageCostProps) {
  if (!costUsd || costUsd <= 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
      <DollarSign className="size-3" />
      <span>{formatCost(costUsd)}</span>
      {showBrl && (
        <span className="text-gray-600">({formatCostBRL(costUsd)})</span>
      )}
    </div>
  )
}
