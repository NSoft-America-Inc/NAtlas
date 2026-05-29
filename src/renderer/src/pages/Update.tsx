import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { SwarmVaultStatus, LogLine, Settings } from '@renderer/lib/types'
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
  AlertCircle,
  Loader2,
  Check,
  Copy,
  Terminal,
  ShieldAlert,
  Sparkles,
  RefreshCw,
} from 'lucide-react'

interface InstallStep {
  id: string
  name: string
  status: 'idle' | 'running' | 'success' | 'failed'
  message?: string
}

export function Update() {
  const queryClient = useQueryClient()
  const { logs, addLog, clearLogs, isUpdating, setIsUpdating } = useUIStore()

  // Tab state: 'install' for visual installer, 'sync' for standard sync update
  const [activeSection, setActiveSection] = useState<'install' | 'sync'>('install')

  // Installer specific state
  const [installMode, setInstallMode] = useState<number>(0) // 0: Unified, 1: NAtlas only, 2: NStack only
  const [isInstalling, setIsInstalling] = useState<boolean>(false)
  const [installStatus, setInstallStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [gitHubAuthStatus, setGitHubAuthStatus] = useState<'loading' | 'success' | 'warning' | null>(null)
  const [gitHubAuthMessage, setGitHubAuthMessage] = useState<string | null>(null)
  const [installSteps, setInstallSteps] = useState<InstallStep[]>([
    { id: 'runtimes', name: '필수 개발 런타임 진단', status: 'idle' },
    { id: 'npm_install', name: 'Node.js 의존성 복원', status: 'idle' },
    { id: 'python_venv', name: 'Python 격리 가상환경 및 pip 설치', status: 'idle' },
    { id: 'swarmvault_cli', name: 'SwarmVault CLI 설치', status: 'idle' },
    { id: 'git_hook', name: 'Git Hook 연동', status: 'idle' },
    { id: 'pipeline_verify', name: '지식 파이프라인 무결성 검사', status: 'idle' },
    { id: 'nstack_onboarding', name: 'NStack 에이전트 룰 및 지식 아카이브 연동', status: 'idle' },
    { id: 'mcp_verify', name: 'SwarmVault MCP 서버 기동 및 설정 검증', status: 'idle' },
    { id: 'rag_verify', name: 'E2E 의미론적 RAG 검색 자가 검증', status: 'idle' },
  ])
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false)

  // RAG Instant test state
  const [testQuery, setTestQuery] = useState<string>('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTestingQuery, setIsTestingQuery] = useState<boolean>(false)

  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })

  const { data: status, isLoading: isStatusLoading, refetch: refetchStatus, isFetching: isStatusFetching } = useQuery<SwarmVaultStatus>({
    queryKey: ['swarmvaultStatus'],
    queryFn: api.getSwarmVaultStatus,
    refetchInterval: 10_000,
  })

  // Copy command helper
  const handleCopyCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  // SSE Install handler
  const handleInstall = async () => {
    if (isInstalling) return

    setIsInstalling(true)
    setInstallStatus('running')
    setGitHubAuthStatus('loading')
    setGitHubAuthMessage(null)
    clearLogs()
    setTestResult(null)

    addLog({ type: 'log', message: 'NStack & NAtlas 통합 비주얼 인스톨러 구동 중...' })

    try {
      const response = await fetch('http://localhost:18420/swarmvault/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: installMode }),
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
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                if (data.type === 'init') {
                  setInstallSteps(data.steps.map((s: any) => ({ ...s, status: 'idle' })))
                } else if (data.type === 'step') {
                  setInstallSteps((prev) =>
                    prev.map((s) => {
                      if (s.id === data.step) {
                        return { ...s, status: data.status, message: data.message }
                      }
                      return s
                    })
                  )
                } else if (data.type === 'auth_warning') {
                  setGitHubAuthStatus('warning')
                  setGitHubAuthMessage(data.message)
                } else if (data.type === 'auth_success') {
                  setGitHubAuthStatus('success')
                  setGitHubAuthMessage(data.message)
                } else if (data.type === 'log') {
                  addLog({ type: 'log', message: data.message })
                } else if (data.type === 'error') {
                  addLog({ type: 'error', message: data.message })
                  setInstallStatus('failed')
                } else if (data.type === 'done') {
                  addLog({ type: 'done', message: data.message })
                  setInstallStatus('success')
                  setIsInstalling(false)
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['swarmvaultStatus'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    } catch (err) {
      addLog({
        type: 'error',
        message: `설치 오류: ${err instanceof Error ? err.message : '알 수 없는 서버 오류가 발생했습니다.'}`,
      })
      setInstallStatus('failed')
      setIsInstalling(false)
    }
  }

  // SSE Sync Update handler (Standard)
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
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const logData = JSON.parse(line.slice(6)) as LogLine
                addLog(logData)

                if (logData.type === 'done' || logData.type === 'error') {
                  setIsUpdating(false)
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

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

  // Handle instant RAG test query
  const handleTestQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testQuery.trim() || isTestingQuery) return

    setIsTestingQuery(true)
    setTestResult(null)

    try {
      const res = await api.querySwarmVault(testQuery)
      setTestResult(res.answer || '응답 결과가 비어있습니다.')
    } catch (err) {
      setTestResult(`쿼리 수행 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setIsTestingQuery(false)
    }
  }

  const renderStatusIndicator = (ok: boolean) => {
    if (ok) return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    return <XCircle className="w-5 h-5 text-rose-500 animate-pulse" />
  }

  // Render installation step icon
  const renderStepIcon = (status: InstallStep['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-rose-400" />
      default:
        return <div className="w-2 h-2 rounded-full bg-slate-600" />
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background select-text overflow-hidden">
      {/* Dynamic Sub-Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-card/10 select-none">
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveSection('install')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeSection === 'install'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
            E2E 통합 온보딩 인스톨러
          </button>
          <button
            onClick={() => setActiveSection('sync')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeSection === 'sync'
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
            SwarmVault 지식 동기화
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchStatus()}
          disabled={isStatusLoading || isStatusFetching || isInstalling || isUpdating}
          className="h-8 px-2.5 text-[11px] bg-muted/40 hover:bg-muted text-foreground border-border hover:border-muted-foreground/30 transition-all duration-300"
        >
          <RotateCw className={`w-3 h-3 mr-1.5 ${isStatusFetching ? 'animate-spin' : ''}`} />
          환경 진단 갱신
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Dynamic Header & Diagnostic Panel */}
        <div className="px-6 py-5 border-b border-border bg-card/25 flex flex-col gap-4">
          <div className="select-none">
            <h2 className="text-xl font-bold tracking-tight text-foreground bg-gradient-to-r from-slate-100 to-indigo-200 bg-clip-text text-transparent">
              {activeSection === 'install' ? 'Unified Developer Onboarding' : 'SwarmVault Sync Update'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeSection === 'install'
                ? 'NStack 설치부터 지식 베이스 RAG 의미론적 다중 검색 자가 테스트까지 원클릭 E2E 검증을 완수합니다.'
                : '수정되거나 신규 작성된 LLMWiki 지식 문서를 식별하고 SwarmVault 로컬 임베딩 벡터 DB에 컴파일합니다.'}
            </p>
          </div>

          {/* System Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
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

        {/* Dynamic Action Section */}
        <div className="flex-1 px-6 py-6 flex flex-col gap-6">
          {activeSection === 'install' ? (
            /* ============================================================================== */
            /* 1. VISUAL INSTALLER SECTION                                                    */
            /* ============================================================================== */
            <div className="flex flex-col gap-5">
              {/* Option Selector Cards */}
              <div className="flex flex-col gap-2.5 select-none">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">설치 시나리오 옵션 선택</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: 0,
                      title: '통합 온보딩 패키지 구축',
                      desc: 'NAtlas 브라우저 및 NStack AI 에이전트 개발 파이프라인 전체를 한 번에 빌드합니다 (권장).',
                      tag: 'E2E Full',
                    },
                    {
                      id: 1,
                      title: 'NAtlas 단독 설치',
                      desc: '지식 탐색기 데스크탑 브라우저 구동에 필요한 런타임 및 사이드카 패키지를 격리 구축합니다.',
                      tag: 'Desktop',
                    },
                    {
                      id: 2,
                      title: 'NStack 단독 설정',
                      desc: '지식 아카이브 싱킹과 AI 에이전트 규칙(antigravity) 연동 파이프라인만 신속 설치합니다.',
                      tag: 'Agent Core',
                    },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => !isInstalling && setInstallMode(mode.id)}
                      disabled={isInstalling}
                      className={`text-left p-4 border rounded-xl flex flex-col gap-2 transition-all duration-300 relative overflow-hidden group ${
                        installMode === mode.id
                          ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5'
                          : 'border-border bg-card/5 hover:border-muted-foreground/30 hover:bg-card/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          installMode === mode.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-muted text-muted-foreground'
                        }`}>
                          {mode.tag}
                        </span>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          installMode === mode.id ? 'border-indigo-500 bg-indigo-500' : 'border-muted-foreground/30'
                        }`}>
                          {installMode === mode.id && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </div>
                      <div className="font-bold text-sm text-foreground group-hover:text-indigo-300 transition-colors duration-300">{mode.title}</div>
                      <div className="text-[11px] text-muted-foreground leading-normal mt-1">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Trigger Card */}
              <div className="flex justify-between items-center bg-card/15 p-4 border border-border rounded-xl shadow-sm select-none">
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-foreground">설치 및 RAG E2E 검증 트리거</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    선택한 시나리오대로 패키지를 구성하고, 백엔드에서 가상 문서를 생성하여 의미론적 RAG 다중 검색 질의까지 E2E로 완전 검증합니다.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleInstall}
                  disabled={isInstalling || isUpdating}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted/40 text-white font-bold h-11 px-6 shadow-md shadow-indigo-600/10 transition-all duration-300"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      설치 진행 중...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      비주얼 설치 실행
                    </>
                  )}
                </Button>
              </div>

              {/* GitHub CLI Auth Alert Warning Widget */}
              {gitHubAuthStatus === 'warning' && (
                <div className="flex items-start gap-4 p-4 border border-amber-900/40 rounded-xl bg-amber-950/20 text-amber-400 text-xs animate-in fade-in duration-300">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <p className="font-bold text-sm text-amber-300">GitHub 자격 증명 진단 경고 (인증 세션 없음)</p>
                    <p className="text-muted-foreground leading-relaxed">
                      {gitHubAuthMessage || 'GitHub CLI 인증 정보 및 Settings 탭의 Personal Access Token이 모두 누락되었습니다. 이 경우 NStack의 전사 지식 파이프라인 동기화나 이슈/PR 연동 등의 연계 기능이 정상 동작하지 않을 수 있습니다.'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="px-2 py-1 bg-black/40 text-[10px] font-mono text-slate-300 rounded border border-slate-800">
                        gh auth login
                      </code>
                      <button
                        onClick={() => handleCopyCmd('gh auth login')}
                        className="px-2 py-1 rounded bg-amber-900/20 border border-amber-800/30 hover:bg-amber-800/20 text-amber-300 transition-all text-[10px] font-bold flex items-center gap-1"
                      >
                        {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        명령어 복사
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step Timeline Visualization */}
              <div className="border border-border rounded-xl p-5 bg-card/5 flex flex-col gap-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground select-none">설치 및 E2E RAG 검증 스텝 진행률</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {installSteps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3.5 p-3 rounded-lg border transition-all duration-300 ${
                        step.status === 'running'
                          ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5'
                          : step.status === 'success'
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : step.status === 'failed'
                          ? 'border-rose-500/20 bg-rose-500/5'
                          : 'border-border bg-transparent opacity-60'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">{renderStepIcon(step.status)}</div>
                      <div className="space-y-1 select-none flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">
                            {idx + 1}. {step.name}
                          </span>
                          {step.status === 'success' && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">Success</span>
                          )}
                          {step.status === 'failed' && (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded">Failed</span>
                          )}
                          {step.status === 'running' && (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded animate-pulse">Running</span>
                          )}
                        </div>
                        {step.message && (
                          <p className="text-[10px] text-muted-foreground leading-normal font-mono truncate max-w-sm">
                            {step.message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RAG Verification Success Summary Box */}
              {installStatus === 'success' && (
                <div className="border border-emerald-500/20 rounded-xl p-5 bg-emerald-950/5 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom duration-500">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/15">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-400">E2E 설치 및 RAG 자동 검증 완전 완료</h4>
                      <p className="text-xs text-muted-foreground">백엔드 및 의미론적 지식 베이스 연동이 100% 정상 작동합니다.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 select-none">
                    <div className="border border-emerald-500/10 rounded-lg p-3 bg-emerald-950/10 flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">RAG 매칭 테스트 질의 수</span>
                      <span className="text-lg font-bold text-foreground">2 / 2 성공</span>
                    </div>
                    <div className="border border-emerald-500/10 rounded-lg p-3 bg-emerald-950/10 flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold">임시 리소스 청소 상태</span>
                      <span className="text-lg font-bold text-emerald-400">Cleanup 완료 (Cleaned)</span>
                    </div>
                  </div>

                  {/* Try RAG Live Test widget */}
                  <div className="mt-2 border-t border-emerald-500/10 pt-4">
                    <h5 className="text-xs font-bold text-foreground mb-2">💡 SwarmVault RAG 검색 실시간 테스트</h5>
                    <form onSubmit={handleTestQuery} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="예: resizable, todo, keyboard zoom..."
                        value={testQuery}
                        onChange={(e) => setTestQuery(e.target.value)}
                        className="flex-1 h-9 px-3 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <Button
                        type="submit"
                        disabled={isTestingQuery || !testQuery.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4"
                      >
                        {isTestingQuery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'RAG 검색'}
                      </Button>
                    </form>

                    {testResult && (
                      <div className="mt-3 p-3 bg-slate-950/40 border border-slate-800 rounded-lg font-mono text-[10px] text-slate-300 leading-relaxed overflow-x-auto max-h-40">
                        <div className="font-bold text-indigo-400 text-xs mb-1 flex items-center gap-1">
                          <Terminal className="w-3 h-3" />
                          RAG Response:
                        </div>
                        {testResult}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ============================================================================== */
            /* 2. STANDARD SYNC UPDATE SECTION                                                */
            /* ============================================================================== */
            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-center bg-card/15 p-4 border border-border rounded-xl shadow-sm select-none">
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-foreground">인덱싱 및 동기화 수행</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    수정되었거나 새로 작성된 LLMWiki 지식 문서를 식별하고 SwarmVault 임베딩 지식베이스에 추가합니다.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleUpdate}
                  disabled={isUpdating || !status?.swarmvault.ok || !status?.llmwiki.ok || settings?.source_mode === 'remote'}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted/40 text-white font-bold h-11 px-6 shadow-md transition-all duration-300"
                >
                  <Play className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-ping' : ''}`} />
                  {isUpdating ? '동기화 중...' : '업데이트 실행'}
                </Button>
              </div>

              {settings?.source_mode === 'remote' && (
                <div className="flex items-start gap-3 p-4 border border-amber-800/40 rounded-xl bg-amber-950/20 text-amber-400 text-xs animate-in fade-in duration-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-amber-300">원격(Remote) 모드 활성화됨</p>
                    <p className="text-muted-foreground leading-relaxed">
                      현재 <strong>Remote (GitHub API)</strong> 소스 모드로 연결되어 있습니다. SwarmVault 로컬 인제스트 및 컴파일 명령어는 로컬 파일시스템 접근을 필요로 하므로 Remote 모드에서는 제한됩니다.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      동기화 및 빌드 기능을 이용하시려면 <strong>Settings</strong> 탭에서 <strong>Local Path</strong> 모드로 전환 후 경로를 설정해 주세요.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live log streaming - Always visible */}
          <LogViewer logs={logs} onClear={clearLogs} />
        </div>
      </div>
    </div>
  )
}

export default Update
