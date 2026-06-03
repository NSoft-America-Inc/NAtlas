interface StatusBadgeProps {
  status: 'indexed' | 'modified' | 'new'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusLabels = {
    indexed: 'indexed',
    modified: 'modified (re-indexing required)',
    new: 'new'
  }

  const tooltipText = statusLabels[status] || ''

  switch (status) {
    case 'indexed':
      return (
        <div
          title={tooltipText}
          className="w-3.5 h-3.5 flex-shrink-0 rounded-full bg-emerald-500 border border-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.4)] hover:scale-125 hover:shadow-[0_0_12px_rgba(16,185,129,0.7)] transition-all duration-200 cursor-pointer"
        />
      )
    case 'modified':
      return (
        <div
          title={tooltipText}
          className="w-3.5 h-3.5 flex-shrink-0 rounded-full bg-amber-500 border border-amber-400/40 shadow-[0_0_8px_rgba(245,158,11,0.4)] hover:scale-125 hover:shadow-[0_0_12px_rgba(245,158,11,0.7)] transition-all duration-200 cursor-pointer animate-pulse"
        />
      )
    case 'new':
      return (
        <div
          title={tooltipText}
          className="w-3.5 h-3.5 flex-shrink-0 rounded-full bg-rose-500 border border-rose-400/40 shadow-[0_0_8px_rgba(244,63,94,0.4)] hover:scale-125 hover:shadow-[0_0_12px_rgba(244,63,94,0.7)] transition-all duration-200 cursor-pointer"
        />
      )
    default:
      return null
  }
}
export default StatusBadge
