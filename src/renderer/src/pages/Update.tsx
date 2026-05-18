import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { SwarmVaultStatus, LogLine } from '@renderer/lib/types'
import { useUIStore } from '@renderer/store/ui'
import { LogViewer } from '@renderer/components/LogViewer'
import { Button } from '@renderer/components/ui/button'
import {
  Cpu,
  Database,
  FileCheck,
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
} from 'lucide-react'


export function Update() {
  const queryClient = useQueryClient()
  const { logs, addLog, clearLogs, isUpdating, setIsUpdating } = useUIStore()

  const { data: status, isLoading: isStatusLoading, refetch: refetchStatus, isFetching: isStatusFetching } = useQuery<SwarmVaultStatus>({
    queryKey: ['swarmvaultStatus'],
    queryFn: api.getSwarmVaultStatus,
    refetchInterval: 10_000, // Refresh status every 10 seconds
  })

  // SSE Sync Update handler
  const handleUpdate = async () => {
    if (isUpdating) return

    setIsUpdating(true)
    clearLogs()
    addLog({ type: 'log', message: 'SwarmVault 동기화 업데이트를 시작합니다...' })

    try {
      const response = await fetch('http://localhost:18420/swarmvault/update', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        
        // Save the last partial chunk back to the buffer
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const logData = JSON.parse(line.slice(6)) as LogLine
                addLog(logData)

                // If done or error signal is received
                if (logData.type === 'done' || logData.type === 'error') {
                  setIsUpdating(false)
                }
              } catch (e) {
                // Handle parsing error quietly or log it
              }
            }
          }
        }
      }

      // Flush remaining buffer
      if (buffer.startsWith('data: ')) {
        try {
          const logData = JSON.parse(buffer.slice(6)) as LogLine
          addLog(logData)
        } catch {
          // Quiet catch
        }
      }

      // Re-fetch documents and status when done
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['swarmvaultStatus'] })
    } catch (err) {
      addLog({
        type: 'error',
        message: `동기화 실패: ${err instanceof Error ? err.message : '알 수 없는 서버 오류가 발생했습니다.'}`,
      })
      setIsUpdating(false)
    }
  }

  // Render Status Badge helper
  const renderStatusIndicator = (ok: boolean) => {
    if (ok) return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    return <XCircle className="w-5 h-5 text-rose-500 animate-pulse" />
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background select-text">
      {/* Header Panel */}
      <div className="px-6 py-5 border-b border-border bg-card/25 flex flex-col gap-4">
        <div className="flex items-center justify-between select-none">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              SwarmVault Sync Update
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              LLMWiki 지식을 로컬 SwarmVault 벡터 DB로 컴파일하고 백업을 동기화합니다.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStatus()}
            disabled={isStatusLoading || isStatusFetching || isUpdating}
            className="h-9 px-3 text-xs bg-muted/40 hover:bg-muted text-foreground border-border hover:border-muted-foreground/30 transition-all duration-300"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${isStatusFetching ? 'animate-spin' : ''}`} />
            상태 갱신
          </Button>
        </div>

        {/* System Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
          {/* Python Environment */}
          <div className="border border-border rounded-xl p-4 bg-card/10 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Python 환경</div>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  {status?.python.ok ? status.python.version || '확인됨' : '미연결'}
                </div>
              </div>
            </div>
            {renderStatusIndicator(!!status?.python.ok)}
          </div>

          {/* SwarmVault Binary */}
          <div className="border border-border rounded-xl p-4 bg-card/10 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/15">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SwarmVault</div>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  {status?.swarmvault.ok ? status.swarmvault.version || '확인됨' : '오류'}
                </div>
              </div>
            </div>
            {renderStatusIndicator(!!status?.swarmvault.ok)}
          </div>

          {/* LLMWiki Content Folder */}
          <div className="border border-border rounded-xl p-4 bg-card/10 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">LLMWiki 문서</div>
                <div className="text-sm font-bold text-foreground mt-0.5">
                  {status?.llmwiki.ok ? `${status.llmwiki.file_count}개 파일` : '비활성'}
                </div>
              </div>
            </div>
            {renderStatusIndicator(!!status?.llmwiki.ok)}
          </div>
        </div>
      </div>

      {/* Action and Log Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
        <div className="flex justify-between items-center bg-card/15 p-4 border border-border rounded-xl shadow-sm select-none">
          <div className="max-w-md">
            <h3 className="text-sm font-bold text-foreground">인덱싱 및 동기화 수행</h3>
            <p className="text-xs text-muted-foreground mt-1">
              수정되었거나 새로 작성된 LLMWiki 지식 문서를 식별하고 SwarmVault 임베딩 지식베이스에 추가합니다.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleUpdate}
            disabled={isUpdating || !status?.swarmvault.ok || !status?.llmwiki.ok}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted/40 text-white font-bold h-11 px-6 shadow-md transition-all duration-300"
          >
            <Play className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-ping' : ''}`} />
            {isUpdating ? '동기화 중...' : '업데이트 실행'}
          </Button>
        </div>

        {/* Live log streaming */}
        <LogViewer logs={logs} onClear={clearLogs} />
      </div>
    </div>
  )
}

export default Update
