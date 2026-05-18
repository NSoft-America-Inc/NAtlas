import { useEffect, useRef } from 'react'
import { LogLine } from '@renderer/lib/types'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { Trash2 } from 'lucide-react'

interface LogViewerProps {
  logs: LogLine[]
  onClear: () => void
}

export function LogViewer({ logs, onClear }: LogViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Automatically scroll to the bottom when new logs are added
    if (viewportRef.current) {
      const scrollContainer = viewportRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [logs])

  return (
    <div className="flex flex-col h-[400px] border border-border rounded-lg bg-card text-card-foreground shadow-inner overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">실시간 업데이트 로그</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          로그 비우기
        </Button>
      </div>
      <ScrollArea ref={viewportRef} className="flex-1 p-4 font-mono text-sm leading-relaxed overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs italic">
            실행 로그가 없습니다. 업데이트 실행 버튼을 눌러 작업을 시작하세요.
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log, index) => {
              let textClass = 'text-slate-300'
              if (log.type === 'error') textClass = 'text-rose-400 font-semibold'
              if (log.type === 'done') textClass = 'text-emerald-400 font-semibold'

              return (
                <div key={index} className={`whitespace-pre-wrap ${textClass}`}>
                  <span className="text-muted-foreground select-none mr-2 font-light">{`>`}</span>
                  {log.message}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

export default LogViewer
