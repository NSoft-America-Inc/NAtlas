import { Badge } from '@renderer/components/ui/badge'

interface StatusBadgeProps {
  status: 'indexed' | 'modified' | 'new'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'indexed':
      return (
        <Badge className="bg-emerald-950/80 text-emerald-400 border-emerald-800/60 hover:bg-emerald-950 shadow-sm transition-all duration-300">
          ✅ 인덱싱됨
        </Badge>
      )
    case 'modified':
      return (
        <Badge className="bg-amber-950/80 text-amber-400 border-amber-800/60 hover:bg-amber-950 shadow-sm transition-all duration-300">
          🟡 수정됨
        </Badge>
      )
    case 'new':
      return (
        <Badge variant="destructive" className="bg-rose-950/80 text-rose-400 border-rose-800/60 hover:bg-rose-950 shadow-sm transition-all duration-300">
          🔴 미인덱싱
        </Badge>
      )
    default:
      return null
  }
}
export default StatusBadge
