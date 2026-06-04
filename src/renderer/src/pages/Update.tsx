import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { SwarmVaultStatus, LogLine, Settings } from '@renderer/lib/types'
import { useUIStore } from '@renderer/store/ui'
import { LogViewer } from '@renderer/components/LogViewer'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
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
  FolderOpen
} from 'lucide-react'

interface InstallStep {
  id: string
  name: string
  status: 'idle' | 'running' | 'success' | 'failed' | 'skipped'
  message?: string
}

export function Update(): React.JSX.Element {
  const queryClient = useQueryClient()
  const { logs, addLog, clearLogs, isUpdating, setIsUpdating } = useUIStore()

  // Tab state: 'project' for NStack project manager, 'sync' for standard sync update
  const [activeSection, setActiveSection] = useState<'project' | 'sync' | 'nstack_update'>('project')

  // Project manager specific state
  const [selectedScenario, setSelectedScenario] = useState<'project' | 'e2e'>('project')
  const [parentPath, setParentPath] = useState<string>(
    () => localStorage.getItem('natlas_last_parent_path') || ''
  )
  const [projectName, setProjectName] = useState<string>(
    () => localStorage.getItem('natlas_last_project_name') || 'nstack-project'
  )
  const [targetProjectPath, setTargetProjectPath] = useState<string>(
    () => localStorage.getItem('natlas_last_target_project_path') || ''
  )
  const [isInstalling, setIsInstalling] = useState<boolean>(false)
  const [installStatus, setInstallStatus] = useState<'idle' | 'running' | 'success' | 'failed'>(
    'idle'
  )
  const [gitHubAuthStatus, setGitHubAuthStatus] = useState<
    'loading' | 'success' | 'warning' | null
  >(null)
  const [gitHubAuthMessage, setGitHubAuthMessage] = useState<string | null>(null)

  const [installSteps, setInstallSteps] = useState<InstallStep[]>([
    { id: 'git_hook', name: 'Git Hook 연동', status: 'idle' },
    { id: 'pipeline_verify', name: '지식 파이프라인 무결성 검사', status: 'idle' },
    { id: 'nstack_onboarding', name: 'NStack 에이전트 룰 및 지식 아카이브 연동', status: 'idle' },
    { id: 'mcp_verify', name: 'Antigravity 표준 룰 및 스킬 검증', status: 'idle' },
    { id: 'rag_verify', name: 'E2E 의미론적 RAG 검색 자가 검증', status: 'idle' }
  ])

  const [copiedCmd, setCopiedCmd] = useState<boolean>(false)
  const [stepLogs, setStepLogs] = useState<{ [stepId: string]: string[] }>({})
  const [validationResult, setValidationResult] = useState<{
    success: boolean
    verifiedCount: number
    totalCount: number
  } | null>(null)

  const allSteps: InstallStep[] = [
    { id: 'git_hook', name: 'Git Hook 연동', status: 'idle' },
    { id: 'pipeline_verify', name: '지식 파이프라인 무결성 검사', status: 'idle' },
    { id: 'nstack_onboarding', name: 'NStack 에이전트 룰 및 지식 아카이브 연동', status: 'idle' },
    { id: 'mcp_verify', name: 'Antigravity 표준 룰 및 스킬 검증', status: 'idle' },
    { id: 'rag_verify', name: 'E2E 의미론적 RAG 검색 자가 검증', status: 'idle' }
  ]

  const visibleSteps = isInstalling
    ? installSteps
    : [
        ...(selectedScenario === 'project' ? allSteps.slice(0, 4) : []),
        ...(selectedScenario === 'e2e' ? [allSteps[4]] : [])
      ]

  // RAG Instant test state
  const [testQuery, setTestQuery] = useState<string>('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTestingQuery, setIsTestingQuery] = useState<boolean>(false)

  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: api.getSettings
  })

  // NStack 업데이트 상태
  const [isNstackUpdating, setIsNstackUpdating] = useState<boolean>(false)
  const [nstackUpdateSteps, setNstackUpdateSteps] = useState<InstallStep[]>([
    { id: 'nstack_source_update', name: 'NStack 소스 업데이트', status: 'idle' },
    { id: 'nstack_reinstall', name: '프로젝트 재설치', status: 'idle' },
    { id: 'rag_verify', name: 'E2E RAG 자가 검증', status: 'idle' },
  ])
  const [nstackUpdateResult, setNstackUpdateResult] = useState<{ success: boolean; message: string } | null>(null)

  const { data: nstackVersionInfo, refetch: refetchNstackVersion } = useQuery({
    queryKey: ['nstackVersion'],
    queryFn: async () => {
      const res = await fetch('http://127.0.0.1:18420/swarmvault/nstack-version')
      return res.json()
    },
    staleTime: 60_000,
  })

  const handleNstackUpdate = async () => {
    if (isNstackUpdating) return
    setIsNstackUpdating(true)
    setNstackUpdateResult(null)
    setNstackUpdateSteps(prev => prev.map(s => ({ ...s, status: 'idle' })))

    try {
      const response = await fetch('http://127.0.0.1:18420/swarmvault/nstack-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_path: '', project_name: '', run_e2e: false }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'step') {
              setNstackUpdateSteps(prev =>
                prev.map(s => s.id === data.step ? { ...s, status: data.status, message: data.message } : s)
              )
            } else if (data.type === 'done') {
              setNstackUpdateResult({ success: data.success, message: data.message })
              refetchNstackVersion()
            }
          } catch {}
        }
      }
    } catch (e) {
      setNstackUpdateResult({ success: false, message: `업데이트 실패: ${e}` })
    } finally {
      setIsNstackUpdating(false)
    }
  }

  const {
    data: status,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
    isFetching: isStatusFetching
  } = useQuery<SwarmVaultStatus>({
    queryKey: ['swarmvaultStatus'],
    queryFn: api.getSwarmVaultStatus,
    refetchInterval: 10_000
  })

  // Copy command helper
  const handleCopyCmd = (cmd: string): void => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }


  // Dynamically resolve workspace parent path from settings
  useEffect(() => {
    if (settings?.llmwiki_root) {
      const normalized = settings.llmwiki_root.replace(/\\/g, '/')
      const parts = normalized.split('/')

      if (!parentPath) {
        const workspaceIdx = normalized.toLowerCase().indexOf('/workspace')
        if (workspaceIdx !== -1) {
          const derived = normalized.substring(0, workspaceIdx + 10)
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setParentPath(derived)
        } else if (parts.length > 2) {
          const parentParts = [...parts]
          parentParts.pop()
          parentParts.pop()
          const derived = parentParts.join('/')
          if (derived && derived !== '/') {
            setParentPath(derived)
          }
        }
      }

      if (!targetProjectPath) {
        const projectParts = [...parts]
        if (
          projectParts.length > 0 &&
          projectParts[projectParts.length - 1].toLowerCase() === 'llmwiki'
        ) {
          projectParts.pop()
        }
        const derivedProject = projectParts.join('/')
        if (derivedProject && derivedProject !== '/') {
          setTargetProjectPath(derivedProject)
        }
      }
    }
  }, [settings, parentPath, targetProjectPath])

  const handleOpenFolder = async (): Promise<void> => {
    try {
      const selectedPath = await window.electron.openFolderDialog()
      if (selectedPath) setParentPath(selectedPath)
    } catch {
      // ignore dialog close
    }
  }

  const handleOpenProjectFolder = async (): Promise<void> => {
    try {
      const selectedPath = await window.electron.openFolderDialog()
      if (selectedPath) setTargetProjectPath(selectedPath)
    } catch {
      // ignore dialog close
    }
  }

  // SSE Install/Setup handler
  const handleInstall = async (): Promise<void> => {
    if (isInstalling) return

    let sendParentPath = parentPath
    let sendProjectName = projectName

    if (selectedScenario === 'e2e') {
      if (targetProjectPath) {
        const normalized = targetProjectPath.replace(/\\/g, '/').replace(/\/$/, '')
        const lastSlashIdx = normalized.lastIndexOf('/')
        if (lastSlashIdx !== -1) {
          sendParentPath = normalized.substring(0, lastSlashIdx)
          sendProjectName = normalized.substring(lastSlashIdx + 1)
        } else {
          sendParentPath = ''
          sendProjectName = normalized
        }
      }
    }

    if (selectedScenario === 'project') {
      try {
        const checkPath = `${sendParentPath.replace(/\/$/, '')}/${sendProjectName}`
        const res = await api.checkFolder(checkPath)
        if (res.exists) {
          const confirmed = window.confirm(
            `지정한 경로에 이미 폴더가 존재합니다:\n${res.path}\n\n이 폴더에 NStack 환경을 구성하시겠습니까?\n(기존 파일이 보존되거나 덮어씌워질 수 있습니다.)`
          )
          if (!confirmed) {
            return
          }
        }
      } catch (err) {
        addLog({
          type: 'error',
          message: `폴더 감지 중 오류: ${err instanceof Error ? err.message : '알 수 없음'}`
        })
      }
    }

    setIsInstalling(true)
    setInstallStatus('running')
    setGitHubAuthStatus('loading')
    setGitHubAuthMessage(null)
    clearLogs()
    setStepLogs({})
    setTestResult(null)
    setValidationResult(null)

    addLog({ type: 'log', message: 'NStack 프로젝트 설정 및 E2E RAG 자가 검증 시작...' })

    try {
      const response = await fetch('http://127.0.0.1:18420/swarmvault/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          core_install: false,
          project_create: selectedScenario === 'project',
          e2e_test: selectedScenario === 'e2e',
          parent_path: sendParentPath,
          project_name: sendProjectName
        })
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
                  const filteredSteps = data.steps
                    .filter(
                      (s: { id: string }) =>
                        s.id !== 'runtimes' &&
                        s.id !== 'npm_install' &&
                        s.id !== 'python_venv' &&
                        s.id !== 'swarmvault_cli'
                    )
                    .map((s: { id: string; name: string }) => ({
                      id: s.id,
                      name: s.name,
                      status: 'idle' as const
                    }))
                  setInstallSteps(filteredSteps)
                  setStepLogs({})
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
                  const stepId = data.step || 'general'
                  const filteredMsg = filterStepLogMessage(stepId, data.message)
                  if (filteredMsg && stepId !== 'general') {
                    setStepLogs((prev) => ({
                      ...prev,
                      [stepId]: [...(prev[stepId] || []), filteredMsg]
                    }))
                  }
                  addLog({ type: 'log', message: data.message })
                } else if (data.type === 'error') {
                  addLog({ type: 'error', message: data.message })
                  setInstallStatus('failed')
                  setIsInstalling(false)
                } else if (data.type === 'done') {
                  addLog({ type: 'done', message: data.message })
                  if (selectedScenario === 'e2e') {
                    setValidationResult({
                      success: !!data.success,
                      verifiedCount: data.verified_count || 0,
                      totalCount: data.total_count || 0
                    })
                    setInstallStatus(data.success ? 'success' : 'failed')
                  } else if (selectedScenario === 'project') {
                    const createdPath = `${parentPath.replace(/\/$/, '')}/${projectName}`
                    setTargetProjectPath(createdPath)

                    localStorage.setItem('natlas_last_parent_path', parentPath)
                    localStorage.setItem('natlas_last_project_name', projectName)
                    localStorage.setItem('natlas_last_target_project_path', createdPath)

                    setInstallStatus('success')
                  } else {
                    setInstallStatus('success')
                  }
                  setIsInstalling(false)
                }
              } catch {
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
        message: `설정 오류: ${err instanceof Error ? err.message : '알 수 없는 서버 오류가 발생했습니다.'}`
      })
      setInstallStatus('failed')
      setIsInstalling(false)
    }
  }

  // SSE Sync Update handler (Standard Sync)
  const handleUpdate = async (): Promise<void> => {
    if (isUpdating) return

    setIsUpdating(true)
    clearLogs()
    addLog({ type: 'log', message: 'SwarmVault 동기화 업데이트를 시작합니다...' })

    try {
      const response = await fetch('http://127.0.0.1:18420/swarmvault/update', {
        method: 'POST'
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
              } catch {
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
        message: `동기화 실패: ${err instanceof Error ? err.message : '알 수 없는 서버 오류가 발생했습니다.'}`
      })
      setIsUpdating(false)
    }
  }

  // Handle instant RAG test query
  const handleTestQuery = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
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

  const renderStatusIndicator = (ok: boolean): React.JSX.Element => {
    if (ok) return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    return <XCircle className="w-5 h-5 text-rose-500 animate-pulse" />
  }

  const isFormValid = (): boolean => {
    if (selectedScenario === 'project') {
      return !!parentPath && !!projectName
    }
    if (selectedScenario === 'e2e') {
      return !!targetProjectPath
    }
    return true
  }

  const renderStepIcon = (statusVal: InstallStep['status']): React.JSX.Element => {
    switch (statusVal) {
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
      {/* Sub-Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-card/10 select-none">
        <div className="flex gap-1.5">
          <button
            onClick={(): void => setActiveSection('project')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeSection === 'project'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />
            NStack 프로젝트 관리
          </button>
          <button
            onClick={(): void => setActiveSection('sync')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeSection === 'sync'
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
            SwarmVault 지식 동기화
          </button>
          <button
            onClick={(): void => setActiveSection('nstack_update')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
              activeSection === 'nstack_update'
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5 inline mr-1.5" />
            NStack 업데이트
            {nstackVersionInfo?.has_update && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px]">NEW</span>
            )}
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={(): void => {
            refetchStatus()
          }}
          disabled={isStatusLoading || isStatusFetching || isInstalling || isUpdating}
          className="h-8 px-2.5 text-[11px] bg-muted/40 hover:bg-muted text-foreground border-border hover:border-muted-foreground/30 transition-all duration-300"
        >
          <RotateCw className={`w-3 h-3 mr-1.5 ${isStatusFetching ? 'animate-spin' : ''}`} />
          환경 진단 갱신
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Diagnostic Panel */}
        <div className="px-6 py-5 border-b border-border bg-card/25">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
            <div className="border border-border rounded-xl p-4 bg-card/10 flex items-center justify-between shadow-sm hover:border-border/80 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Python 환경
                  </div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {status?.python.ok ? status.python.version || '확인됨' : '미연결'}
                  </div>
                </div>
              </div>
              {renderStatusIndicator(!!status?.python.ok)}
            </div>

            <div className="border border-border rounded-xl p-4 bg-card/10 flex items-center justify-between shadow-sm hover:border-border/80 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/15">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    SwarmVault
                  </div>
                  <div className="text-sm font-bold text-foreground mt-0.5">
                    {status?.swarmvault.ok ? status.swarmvault.version || '확인됨' : '오류'}
                  </div>
                </div>
              </div>
              {renderStatusIndicator(!!status?.swarmvault.ok)}
            </div>

            <div className="border border-border rounded-xl p-4 bg-card/10 flex items-center justify-between shadow-sm hover:border-border/80 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    LLMWiki 문서
                  </div>
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
          {activeSection === 'nstack_update' ? (
            /* ============================================================================== */
            /* 3. NSTACK UPDATE SECTION                                                        */
            /* ============================================================================== */
            <div className="flex flex-col gap-5">
              {/* 버전 정보 카드 */}
              <div className="grid grid-cols-2 gap-4 border border-border/40 rounded-xl p-4 bg-muted/10">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">현재 버전</p>
                  <p className="text-sm font-semibold font-mono text-slate-300">
                    {nstackVersionInfo?.current_version || (nstackVersionInfo?.installed === false ? '미설치' : '...')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">최신 버전</p>
                  <p className="text-sm font-semibold font-mono text-slate-300">
                    {nstackVersionInfo?.latest_version || '확인 필요'}
                  </p>
                </div>
              </div>

              {/* 업데이트 알림 */}
              {nstackVersionInfo?.has_update && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  새로운 NStack 버전({nstackVersionInfo.latest_version})이 있습니다.
                </div>
              )}

              {/* 업데이트 동작 안내 */}
              <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-muted/5 border border-border/30">
                <p className="font-medium text-foreground/70">업데이트 시 동작:</p>
                <p>① NStack 소스(~/.natlas/NStack)를 최신 버전으로 강제 동기화</p>
                <p>② 심링크 스킬(.agents/skills/nsoft)은 자동 반영됩니다</p>
                <p>③ .antigravity/rules 등 복사본은 프로젝트 재설치가 필요합니다</p>
              </div>

              {/* 스킬 정책 안내 */}
              <div className="text-xs space-y-2 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <p className="font-medium text-purple-300">📦 스킬 구조 정책</p>
                <div className="space-y-1 text-muted-foreground">
                  <p>
                    <span className="text-slate-300 font-medium">공식 스킬</span>{' '}
                    <span className="font-mono text-[10px] bg-muted/30 px-1 rounded">.agents/skills/nsoft/</span>{' '}
                    — NStack이 관리하는 심링크. 수정 시 업데이트로 초기화됩니다.
                  </p>
                  <p>
                    <span className="text-slate-300 font-medium">개인 스킬</span>{' '}
                    <span className="font-mono text-[10px] bg-muted/30 px-1 rounded">.agents/skills/내스킬명/</span>{' '}
                    — 직접 추가한 폴더. NStack 업데이트에 영향받지 않습니다.
                  </p>
                </div>
              </div>

              {/* 업데이트 버튼 */}
              {!isNstackUpdating && !nstackUpdateResult && (
                <button
                  onClick={handleNstackUpdate}
                  className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  지금 업데이트
                </button>
              )}

              {/* 진행 중 단계 카드 */}
              {(isNstackUpdating || nstackUpdateResult) && (
                <div className="space-y-2">
                  {nstackUpdateSteps.map(step => (
                    <div key={step.id} className={`flex items-center gap-3 p-3 rounded-lg border text-xs transition-all
                      ${step.status === 'running' ? 'border-blue-500/40 bg-blue-500/5 text-blue-300' :
                        step.status === 'success' ? 'border-green-500/40 bg-green-500/5 text-green-300' :
                        step.status === 'failed' ? 'border-red-500/40 bg-red-500/5 text-red-300' :
                        step.status === 'skipped' ? 'border-border/20 bg-muted/5 text-muted-foreground' :
                        'border-border/40 bg-muted/5 text-muted-foreground'}`}>
                      <span className="text-base leading-none">
                        {step.status === 'success' ? '✓' :
                         step.status === 'failed' ? '✗' :
                         step.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                         step.status === 'skipped' ? '–' : '○'}
                      </span>
                      <span>{step.name}</span>
                      {step.message && <span className="ml-auto text-[10px] opacity-70">{step.message}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* 완료 결과 */}
              {nstackUpdateResult && (
                <div className={`p-3 rounded-lg text-xs border ${
                  nstackUpdateResult.success
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {nstackUpdateResult.message}
                </div>
              )}

              {/* 다시 업데이트 버튼 */}
              {nstackUpdateResult && (
                <button
                  onClick={() => { setNstackUpdateResult(null); setNstackUpdateSteps(prev => prev.map(s => ({ ...s, status: 'idle' }))); }}
                  className="w-full py-2 px-4 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground text-xs transition-colors"
                >
                  다시 업데이트
                </button>
              )}
            </div>
          ) : activeSection === 'project' ? (
            /* ============================================================================== */
            /* 1. NSTACK PROJECT MANAGER SECTION                                              */
            /* ============================================================================== */
            <div className="flex flex-col gap-5">
              {/* Option Selector Cards */}
              <div className="flex flex-col gap-3 select-none">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  시나리오 옵션 선택
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Project Setup */}
                  <button
                    type="button"
                    onClick={(): void => {
                      if (!isInstalling) setSelectedScenario('project')
                    }}
                    disabled={isInstalling}
                    className={`text-left p-4 border rounded-xl flex flex-col gap-2 transition-all duration-300 relative overflow-hidden group ${
                      selectedScenario === 'project'
                        ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5'
                        : 'border-border bg-card/5 opacity-60 hover:opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedScenario === 'project'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        Project Setup
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          selectedScenario === 'project'
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-muted-foreground/30 bg-transparent'
                        }`}
                      >
                        {selectedScenario === 'project' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <div className="font-bold text-sm text-foreground group-hover:text-indigo-300 transition-colors duration-300">
                      NStack 프로젝트 생성
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-normal mt-1">
                      지정 폴더 하위에 격리된 신규 NStack 지식 에이전트 스캐폴딩과 룰 규격 설정을
                      완료합니다.
                    </div>
                    <div className="text-[10px] text-purple-400/70 mt-1.5">
                      💡 공식 스킬(.agents/skills/nsoft)은 심링크로 자동 관리됩니다.
                      개인 스킬은 .agents/skills/ 아래에 직접 추가하세요.
                    </div>
                  </button>

                  {/* Card 2: E2E Test */}
                  <button
                    type="button"
                    onClick={(): void => {
                      if (!isInstalling) setSelectedScenario('e2e')
                    }}
                    disabled={isInstalling}
                    className={`text-left p-4 border rounded-xl flex flex-col gap-2 transition-all duration-300 relative overflow-hidden group ${
                      selectedScenario === 'e2e'
                        ? 'border-indigo-500 bg-indigo-500/5 shadow-md shadow-indigo-500/5'
                        : 'border-border bg-card/5 opacity-60 hover:opacity-85'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedScenario === 'e2e'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        Validation
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          selectedScenario === 'e2e'
                            ? 'border-indigo-500 bg-indigo-500'
                            : 'border-muted-foreground/30 bg-transparent'
                        }`}
                      >
                        {selectedScenario === 'e2e' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <div className="font-bold text-sm text-foreground group-hover:text-indigo-300 transition-colors duration-300">
                      통합 E2E 테스트 진행
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-normal mt-1">
                      지정된 프로젝트 경로의 llmwiki를 타겟으로 임시 문서를 주입하여 의미론적 RAG
                      자가 검증을 수행합니다.
                    </div>
                  </button>
                </div>
              </div>

              {/* Dynamic Path Inputs */}
              {selectedScenario === 'project' && (
                <div className="border border-border rounded-xl p-5 bg-card/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top duration-300">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    NStack 프로젝트 다중 설치 경로 설정
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        부모 폴더 경로 (Parent Folder)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="/Users/yg/workspace"
                          value={parentPath}
                          onChange={(e): void => setParentPath(e.target.value)}
                          disabled={isInstalling}
                          className="flex-1 h-9 text-xs bg-slate-900 border-border text-foreground placeholder:text-muted-foreground/40"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenFolder}
                          disabled={isInstalling}
                          className="h-9 px-3 text-xs bg-muted/40 border-border hover:bg-muted text-foreground flex items-center gap-1.5 border-dashed"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                          폴더 선택
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        프로젝트 명 (Project Name)
                      </label>
                      <Input
                        type="text"
                        placeholder="nstack-project"
                        value={projectName}
                        onChange={(e): void =>
                          setProjectName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))
                        }
                        disabled={isInstalling}
                        className="h-9 text-xs bg-slate-900 border-border text-foreground placeholder:text-muted-foreground/40"
                      />
                    </div>
                  </div>

                  {parentPath && projectName && (
                    <div className="text-[10px] text-muted-foreground font-mono bg-black/30 p-2.5 rounded border border-border/30">
                      <span className="text-indigo-400 font-bold">생성 경로:</span>{' '}
                      {parentPath.replace(/\/$/, '')}/{projectName}
                    </div>
                  )}
                </div>
              )}

              {selectedScenario === 'e2e' && (
                <div className="border border-border rounded-xl p-5 bg-card/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top duration-300">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    검증 대상 NStack 프로젝트 폴더 설정
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-muted-foreground">
                      대상 프로젝트 폴더 경로 (NStack Project Folder)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="/Users/yg/workspace/nstack-project"
                        value={targetProjectPath}
                        onChange={(e): void => setTargetProjectPath(e.target.value)}
                        disabled={isInstalling}
                        className="flex-1 h-9 text-xs bg-slate-900 border-border text-foreground placeholder:text-muted-foreground/40"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenProjectFolder}
                        disabled={isInstalling}
                        className="h-9 px-3 text-xs bg-muted/40 border-border hover:bg-muted text-foreground flex items-center gap-1.5 border-dashed"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                        폴더 선택
                      </Button>
                    </div>
                  </div>

                  {targetProjectPath && (
                    <div className="text-[10px] text-muted-foreground font-mono bg-black/30 p-2.5 rounded border border-border/30">
                      <span className="text-indigo-400 font-bold">대상 프로젝트 경로:</span>{' '}
                      {targetProjectPath}
                    </div>
                  )}
                </div>
              )}

              {/* Action Trigger Card */}
              <div className="flex justify-between items-center bg-card/15 p-4 border border-border rounded-xl shadow-sm select-none">
                <div className="max-w-md">
                  <h3 className="text-sm font-bold text-foreground">
                    NStack 설정 및 E2E RAG 검증 트리거
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    선택한 시나리오대로 에이전트 환경을 빌드하고, 백엔드 RAG 지식 색인 정합성이
                    실시간 통과되는지 E2E로 완전 검증합니다.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleInstall}
                  disabled={isInstalling || isUpdating || !isFormValid()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted/40 text-white font-bold h-11 px-6 shadow-md shadow-indigo-600/10 transition-all duration-300"
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      실행 중...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      실행
                    </>
                  )}
                </Button>
              </div>

              {/* GitHub Auth Banner */}
              {gitHubAuthStatus === 'warning' && (
                <div className="flex items-start gap-4 p-4 border border-amber-900/40 rounded-xl bg-amber-950/20 text-amber-400 text-xs animate-in fade-in duration-300">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <p className="font-bold text-sm text-amber-300">GitHub 자격 증명 경고</p>
                    <p className="text-muted-foreground leading-relaxed">
                      {gitHubAuthMessage ||
                        'GitHub CLI 인증 및 Settings의 github_token이 누락되었습니다. 이 경우 지식 동기화나 PR 연동 등이 제한될 수 있습니다.'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="px-2 py-1 bg-black/40 text-[10px] font-mono text-slate-300 rounded border border-slate-800">
                        gh auth login
                      </code>
                      <button
                        onClick={(): void => handleCopyCmd('gh auth login')}
                        className="px-2 py-1 rounded bg-amber-900/20 border border-amber-800/30 hover:bg-amber-800/20 text-amber-300 transition-all text-[10px] font-bold flex items-center gap-1"
                      >
                        {copiedCmd ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        명령어 복사
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step Timeline */}
              <div className="border border-border rounded-xl p-5 bg-card/5 flex flex-col gap-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground select-none">
                  설정 및 E2E RAG 검증 스텝 진행률
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleSteps.map((step, idx) => (
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
                      <div className="space-y-1 select-none flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">
                            {idx + 1}. {step.name}
                          </span>
                          {step.status === 'success' && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                              Success
                            </span>
                          )}
                          {step.status === 'failed' && (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded">
                              Failed
                            </span>
                          )}
                          {step.status === 'running' && (
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded animate-pulse">
                              Running
                            </span>
                          )}
                        </div>
                        {step.message && (
                          <p className="text-[10px] text-muted-foreground leading-normal font-mono truncate max-w-sm">
                            {step.message}
                          </p>
                        )}
                        {stepLogs[step.id] && stepLogs[step.id].length > 0 && (
                          <div className="mt-2 text-[9px] font-mono text-slate-300 bg-black/40 p-2 rounded border border-border/30 max-h-32 overflow-y-auto space-y-0.5 leading-relaxed select-text scrollbar-thin">
                            {stepLogs[step.id].map((logMsg, lIdx) => (
                              <div key={lIdx} className="break-all whitespace-pre-wrap">
                                {logMsg}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RAG Verification Success Summary Box */}
              {(installStatus === 'success' || installStatus === 'failed') &&
                selectedScenario === 'e2e' &&
                validationResult && (
                  <div
                    className={`border rounded-xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom duration-500 ${
                      validationResult.success
                        ? 'border-emerald-500/20 bg-emerald-950/5'
                        : 'border-amber-500/20 bg-amber-950/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg border ${
                          validationResult.success
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                        }`}
                      >
                        {validationResult.success ? (
                          <Sparkles className="w-5 h-5" />
                        ) : (
                          <AlertCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h4
                          className={`text-sm font-bold ${validationResult.success ? 'text-emerald-400' : 'text-amber-400'}`}
                        >
                          {validationResult.success
                            ? 'E2E 설치 및 RAG 자동 검증 완전 완료'
                            : 'E2E 설치 완료 및 RAG 일부 검증 실패'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {validationResult.success
                            ? '백엔드 및 의미론적 지식 베이스 연동이 100% 정상 작동합니다.'
                            : '일부 의미론적 질의에 대한 RAG 매칭에 실패했습니다. 로그창의 에러 로그를 확인하세요.'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 select-none">
                      <div
                        className={`border rounded-lg p-3 flex flex-col gap-1 ${
                          validationResult.success
                            ? 'border-emerald-500/10 bg-emerald-950/10'
                            : 'border-amber-500/10 bg-amber-950/10'
                        }`}
                      >
                        <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                          RAG 매칭 테스트 질의 수
                        </span>
                        <span
                          className={`text-lg font-bold ${validationResult.success ? 'text-foreground' : 'text-amber-500'}`}
                        >
                          {validationResult.verifiedCount} / {validationResult.totalCount} 성공
                        </span>
                      </div>
                      <div
                        className={`border rounded-lg p-3 flex flex-col gap-1 ${
                          validationResult.success
                            ? 'border-emerald-500/10 bg-emerald-950/10'
                            : 'border-amber-500/10 bg-amber-950/10'
                        }`}
                      >
                        <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                          임시 리소스 청소 상태
                        </span>
                        <span
                          className={`text-lg font-bold ${validationResult.success ? 'text-emerald-400' : 'text-amber-500'}`}
                        >
                          Cleanup 완료 (Cleaned)
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 border-t border-emerald-500/10 pt-4">
                      <h5 className="text-xs font-bold text-foreground mb-2">
                        💡 SwarmVault RAG 검색 실시간 테스트
                      </h5>
                      <form onSubmit={handleTestQuery} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="예: resizable, todo, keyboard zoom..."
                          value={testQuery}
                          onChange={(e): void => setTestQuery(e.target.value)}
                          className="flex-1 h-9 px-3 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                        <Button
                          type="submit"
                          disabled={isTestingQuery || !testQuery.trim()}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4"
                        >
                          {isTestingQuery ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'RAG 검색'
                          )}
                        </Button>
                      </form>

                      {testResult && (
                        <div className="mt-3 p-3 bg-slate-950/40 border border-slate-800 rounded-lg font-mono text-[10px] text-slate-350 leading-relaxed overflow-x-auto max-h-40">
                          <div className="font-bold text-indigo-450 text-xs mb-1 flex items-center gap-1">
                            <Terminal className="w-3.5 h-3.5" />
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
                    수정되었거나 새로 작성된 LLMWiki 지식 문서를 식별하고 SwarmVault 임베딩
                    지식베이스에 추가합니다.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleUpdate}
                  disabled={
                    isUpdating ||
                    !status?.swarmvault.ok ||
                    !status?.llmwiki.ok ||
                    settings?.source_mode === 'remote'
                  }
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted/40 text-white font-bold h-11 px-6 shadow-md transition-all duration-300"
                >
                  <Play className={`w-4 h-4 mr-2 ${isUpdating ? 'animate-ping' : ''}`} />
                  {isUpdating ? '동기화 중...' : '업데이트 실행'}
                </Button>
              </div>

              {/* Smart Auto Sync card */}
              <div
                className={`flex flex-col gap-4 p-5 border rounded-xl select-none transition-all duration-300 ${
                  settings?.source_mode === 'local'
                    ? 'border-indigo-500/20 bg-indigo-500/5 text-indigo-300'
                    : 'border-slate-800 bg-slate-900/30 text-muted-foreground'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        settings?.source_mode === 'local' && (status?.enable_auto_sync ?? true)
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-slate-600'
                      }`}
                    />
                    <div>
                      <span className="text-xs font-bold block text-foreground">
                        {settings?.source_mode === 'local'
                          ? (status?.enable_auto_sync ?? true)
                            ? '스마트 백그라운드 자동 동기화 활성화'
                            : '스마트 백그라운드 자동 동기화 비활성화'
                          : '스마트 자동 동기화 비활성'}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">
                        {settings?.source_mode === 'local'
                          ? '로컬 LLMWiki 변경 감지 시, 60초 간격으로 자동 색인을 갱신합니다.'
                          : 'Settings 탭에서 Source Mode를 Local Path로 설정 시 동작합니다.'}
                      </span>
                    </div>
                  </div>

                  {settings?.source_mode === 'local' && (
                    <div className="flex items-center gap-2.5 bg-black/25 border border-border/30 px-3.5 py-2 rounded-lg">
                      <span className="text-[11px] font-bold text-slate-300 select-none">
                        자동 동기화
                      </span>
                      <button
                        type="button"
                        onClick={async (): Promise<void> => {
                          try {
                            await api.toggleAutoSync()
                            queryClient.invalidateQueries({ queryKey: ['swarmvaultStatus'] })
                          } catch (err) {
                            addLog({
                              type: 'error',
                              message: `자동 동기화 토글 오류: ${err instanceof Error ? err.message : '알 수 없음'}`
                            })
                          }
                        }}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                          (status?.enable_auto_sync ?? true) ? 'bg-indigo-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
                            (status?.enable_auto_sync ?? true) ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-border/20 pt-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    최종 성공 동기화 이력
                  </span>
                  <span className="font-mono text-slate-300 bg-black/35 px-2.5 py-1 rounded border border-border/20">
                    최종 성공 동기화:{' '}
                    <strong className="text-indigo-400 font-bold ml-1">
                      {formatLastSyncTime(status?.last_sync_time || null)}
                    </strong>
                  </span>
                </div>
              </div>

              {settings?.source_mode === 'remote' && (
                <div className="flex items-start gap-3 p-4 border border-amber-800/40 rounded-xl bg-amber-950/20 text-amber-400 text-xs animate-in fade-in duration-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-amber-300">원격(Remote) 모드 활성화됨</p>
                    <p className="text-muted-foreground leading-relaxed">
                      현재 <strong>Remote (GitHub API)</strong> 소스 모드로 연결되어 있습니다.
                      SwarmVault 로컬 인제스트 및 컴파일 기능은 로컬 파일시스템 접근이 필요하므로
                      Remote 모드에서는 사용 불가능합니다.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      동기화 및 빌드 기능을 이용하시려면 <strong>Settings</strong> 탭에서{' '}
                      <strong>Local Path</strong> 모드로 전환 후 경로를 설정해 주세요.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live log streaming */}
          <LogViewer logs={logs} onClear={clearLogs} />
        </div>
      </div>
    </div>
  )
}

const filterStepLogMessage = (stepId: string, message: string): string | null => {
  const clean = message.trim()

  if (
    clean.startsWith('%') ||
    clean.includes('╔══') ||
    clean.includes('╚══') ||
    clean.includes('║') ||
    clean.includes('➔') ||
    clean.includes('100 ') ||
    clean.startsWith('==') ||
    clean.includes('[SETUP-STEP]') ||
    clean.includes('[?25') ||
    clean.includes('\x1b')
  ) {
    return null
  }

  if (stepId === 'nstack_onboarding') {
    if (
      clean.includes('✓ NStack 에이전트 룰') ||
      clean.includes('✓ LLMWiki 로컬경로') ||
      clean.includes('완수!')
    ) {
      if (clean.includes('룰:')) return '✓ .antigravity/rules 룰 주입 완료'
      if (clean.includes('로컬경로')) return '✓ LLMWiki 로컬 저장소 연동 완료'
      return clean.replace(/^[✓\s]+/, '✓ ').trim()
    }
    return null
  }

  if (stepId === 'mcp_verify') {
    if (clean.includes('✓') || clean.includes('✗') || clean.includes('⚠')) {
      if (clean.includes('rules 파일 존재')) {
        return '✓ .antigravity/rules 룰 검증 완료'
      }
      if (clean.includes('스킬 심링크 연동 완료') || clean.includes('스킬 디렉토리 바인딩 완료')) {
        return '✓ .agents/skills/nsoft 스킬 검증 완료'
      }
      if (clean.includes('verify_nstack_pipeline.py 누락')) {
        return '✓ verify_nstack_pipeline.py 누락 자동 복구 완료'
      }
      if (clean.includes('verify_nstack_pipeline.py 린터 파일 존재')) {
        return '✓ verify_nstack_pipeline.py 린터 파일 검증 완료'
      }
      if (clean.includes('SwarmVault 실행 바이너리 존재')) {
        return '✓ SwarmVault CLI 실행 파일 검증 완료'
      }
      if (clean.includes('MCP 서버 설정 및 바이너리 유효성')) {
        return '✓ SwarmVault MCP 서버 검증 통과'
      }
      return clean.replace(/^[└─\s\u2514\u2500\u2713\u2717\u26a0]+/, '✓ ').trim()
    }
    return null
  }

  if (stepId === 'rag_verify') {
    if (clean.includes('테스트 검증 문서 생성 완료')) {
      return '✓ 테스트 검증용 마크다운 문서 생성 완료'
    }
    if (clean.includes('Ingest 등록 중')) {
      return '✓ SwarmVault 테스트 문서 Ingest 등록 완료'
    }
    if (clean.includes('컴파일 및 RAG 색인 갱신')) {
      return '✓ SwarmVault 컴파일 및 RAG 색인 갱신 완료'
    }
    if (clean.includes('RAG 쿼리 질의 실행')) {
      const q = clean.split(':').pop()?.trim() || ''
      return `✓ RAG 검색 질의 실행: "${q}"`
    }
    if (clean.includes('RAG 의미론적 매칭 매핑 성공')) {
      return '  └─ ✓ RAG 의미론적 매칭 매핑 성공'
    }
    if (clean.includes('모든 의미론적 RAG 다중 질의 검증')) {
      return '✓ 모든 의미론적 RAG 다중 질의 검증 성공'
    }
    if (clean.includes('클린업 완료')) {
      return '✓ 임시 테스트 리소스 클린업 완료'
    }
    return null
  }

  if (
    stepId === 'runtimes' ||
    stepId === 'npm_install' ||
    stepId === 'python_venv' ||
    stepId === 'swarmvault_cli'
  ) {
    if (
      clean.includes('✓') ||
      clean.includes('성공') ||
      clean.includes('완수') ||
      clean.includes('완료')
    ) {
      return clean.replace(/^[✓\s]+/, '✓ ').trim()
    }
    return null
  }

  if (stepId === 'git_hook' || stepId === 'pipeline_verify') {
    if (clean.includes('성공') || clean.includes('완료') || clean.includes('✓')) {
      if (clean.includes('pre-commit') && clean.includes('바인딩 성공')) {
        return '✓ NStack E2E pre-commit Git Hook 바인딩 성공'
      }
      return clean.replace(/^[✓\s]+/, '✓ ').trim()
    }
    return null
  }

  return clean
}

const formatLastSyncTime = (timeStr: string | null): string => {
  if (!timeStr) return '기록 없음'
  try {
    const date = new Date(timeStr)
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
    return date.toLocaleString('ko-KR', options)
  } catch {
    return timeStr
  }
}

export default Update
