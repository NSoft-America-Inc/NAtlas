import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { Settings as SettingsType } from '@renderer/lib/types'
import { useUIStore } from '@renderer/store/ui'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { FolderOpen, Save, Settings as SettingsIcon, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

export function Settings() {
  const queryClient = useQueryClient()
  const { setSettings: setGlobalSettings } = useUIStore()
  const [llmwikiRoot, setLlmwikiRoot] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<'remote' | 'local'>('remote')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null)

  const { data: currentSettings, isLoading } = useQuery<SettingsType>({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })

  useEffect(() => {
    if (currentSettings) {
      setSourceMode((currentSettings.source_mode ?? 'remote') as 'remote' | 'local')
      setGithubToken(currentSettings.github_token ?? '')
      setLlmwikiRoot(currentSettings.llmwiki_root ?? '')
      setGlobalSettings(currentSettings)
    }
  }, [currentSettings, setGlobalSettings])

  const saveMutation = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: (data) => {
      if (data.ok) {
        setSaveSuccess(true)
        setSaveError(null)
        queryClient.invalidateQueries({ queryKey: ['settings'] })
        queryClient.invalidateQueries({ queryKey: ['documents'] })
        queryClient.invalidateQueries({ queryKey: ['swarmvaultStatus'] })
        setGlobalSettings({
          source_mode: sourceMode,
          github_token: sourceMode === 'remote' ? githubToken.trim() : '',
          llmwiki_root: sourceMode === 'local' ? llmwikiRoot.trim() : '',
        })
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.')
      setSaveSuccess(false)
    },
  })

  const handleOpenFolder = async () => {
    try {
      const selectedPath = await window.electron.openFolderDialog()
      if (selectedPath) setLlmwikiRoot(selectedPath)
    } catch {
      setSaveError('폴더 선택 대화상자를 열 수 없습니다.')
    }
  }

  const handleSave = () => {
    setSaveError(null)
    if (sourceMode === 'remote') {
      if (!githubToken.trim()) {
        setSaveError('GitHub Token을 입력해주세요.')
        return
      }
      saveMutation.mutate({ source_mode: 'remote', github_token: githubToken.trim(), llmwiki_root: '' })
    } else {
      if (!llmwikiRoot.trim()) {
        setSaveError('LLMWiki 루트 경로를 입력해주세요.')
        return
      }
      saveMutation.mutate({ source_mode: 'local', github_token: '', llmwiki_root: llmwikiRoot.trim() })
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)
    try {
      await queryClient.fetchQuery({ queryKey: ['documents'], queryFn: api.getDocuments })
      setSyncResult({ ok: true, message: '문서 목록을 성공적으로 갱신했습니다.' })
    } catch (err) {
      setSyncResult({ ok: false, message: err instanceof Error ? err.message : '동기화 중 오류가 발생했습니다.' })
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncResult(null), 3000)
    }
  }

  const isBusy = isLoading || saveMutation.isPending

  return (
    <div className="flex-1 flex flex-col h-full bg-background select-text">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card/25 flex flex-col gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            NAtlas 작동을 위한 시스템 및 환경 설정을 관리합니다.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-2xl">
        <div className="border border-border rounded-xl bg-card/10 p-6 space-y-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 select-none">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground select-none">LLMWiki 소스 설정</h3>
              <p className="text-xs text-muted-foreground mt-1 select-none">
                Remote 모드는 GitHub API로 직접 조회합니다. Local 모드는 로컬 경로를 읽습니다.
              </p>
            </div>
          </div>

          {/* Source Mode 토글 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
              LLMWiki 소스
            </label>
            <div className="flex gap-2">
              <Button
                variant={sourceMode === 'remote' ? 'default' : 'outline'}
                onClick={() => setSourceMode('remote')}
                className={`flex-1 text-xs h-9 select-none ${sourceMode === 'remote' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-muted/20 text-muted-foreground'}`}
              >
                Remote (GitHub)
              </Button>
              <Button
                variant={sourceMode === 'local' ? 'default' : 'outline'}
                onClick={() => setSourceMode('local')}
                className={`flex-1 text-xs h-9 select-none ${sourceMode === 'local' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-muted/20 text-muted-foreground'}`}
              >
                Local Path
              </Button>
            </div>
          </div>

          {/* Remote 모드 */}
          {sourceMode === 'remote' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                  Repository
                </label>
                <p className="font-mono text-xs text-slate-400 bg-muted/20 border border-border rounded-md px-3 py-2 select-all">
                  NSoft-America-Inc/NSoft-LLMWiki
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                  GitHub Token
                </label>
                <Input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  disabled={isBusy}
                  className="bg-muted/20 border-border focus-visible:ring-indigo-500/50 font-mono text-xs text-slate-200"
                />
                <p className="text-xs text-muted-foreground">
                  Private repo 접근용 GitHub Personal Access Token (repo 권한 필요)
                </p>
              </div>
            </div>
          )}

          {/* Local 모드 */}
          {sourceMode === 'local' && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                LLMWiki Root 경로
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={llmwikiRoot}
                  onChange={(e) => setLlmwikiRoot(e.target.value)}
                  placeholder="/Users/username/workspace/NSoft-LLMWiki"
                  disabled={isBusy}
                  className="flex-1 bg-muted/20 border-border focus-visible:ring-indigo-500/50 font-mono text-xs text-slate-200"
                />
                <Button
                  variant="outline"
                  onClick={handleOpenFolder}
                  disabled={isBusy}
                  className="bg-muted/40 hover:bg-muted text-foreground border-border select-none"
                >
                  <FolderOpen className="w-4 h-4 mr-1.5 text-indigo-400" />
                  폴더 선택
                </Button>
              </div>
            </div>
          )}

          {/* Feedback */}
          <div className="space-y-2 select-none">
            {saveSuccess && (
              <div className="flex items-center gap-2 p-3 border border-emerald-800/40 rounded-lg bg-emerald-950/20 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>설정이 성공적으로 저장되었습니다.</span>
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-2 p-3 border border-rose-800/40 rounded-lg bg-rose-950/20 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            {syncResult && (
              <div className={`flex items-center gap-2 p-3 border rounded-lg text-xs ${syncResult.ok ? 'border-emerald-800/40 bg-emerald-950/20 text-emerald-400' : 'border-rose-800/40 bg-rose-950/20 text-rose-400'}`}>
                {syncResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{syncResult.message}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 select-none pt-4 border-t border-border/40">
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={isBusy || isSyncing}
              className="bg-muted/20 hover:bg-muted text-foreground border-border h-10 px-5 transition-all duration-300"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? '동기화 중...' : '동기화'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isBusy || (sourceMode === 'local' && !llmwikiRoot.trim())}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted/40 text-white font-bold h-10 px-5 shadow-sm transition-all duration-300"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? '저장 중...' : '설정 저장'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
