import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { Settings as SettingsType } from '@renderer/lib/types'
import { useUIStore } from '@renderer/store/ui'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { FolderOpen, Save, Settings as SettingsIcon, CheckCircle2, AlertCircle, RefreshCw, Bell } from 'lucide-react'

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
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateCheckMessage, setUpdateCheckMessage] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  const { data: currentSettings, isLoading } = useQuery<SettingsType>({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })

  const { data: updateInfo } = useQuery({
    queryKey: ['checkUpdate'],
    queryFn: api.checkUpdate,
    staleTime: 300_000,
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
    const autoSync = currentSettings?.enable_auto_sync ?? true
    if (sourceMode === 'remote') {
      if (!githubToken.trim()) {
        setSaveError('GitHub Token을 입력해주세요.')
        return
      }
      saveMutation.mutate({
        source_mode: 'remote',
        github_token: githubToken.trim(),
        llmwiki_root: '',
        enable_auto_sync: autoSync
      })
    } else {
      if (!llmwikiRoot.trim()) {
        setSaveError('LLMWiki 루트 경로를 입력해주세요.')
        return
      }
      saveMutation.mutate({
        source_mode: 'local',
        github_token: '',
        llmwiki_root: llmwikiRoot.trim(),
        enable_auto_sync: autoSync
      })
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

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true)
    setUpdateCheckMessage(null)
    try {
      const result = await queryClient.fetchQuery({
        queryKey: ['checkUpdate'],
        queryFn: api.checkUpdate,
      })
      if (result.has_update) {
        setUpdateCheckMessage({
          type: 'info',
          text: `새로운 버전(v${result.latest_version})이 준비되었습니다. 아래 [지금 업데이트 설치] 버튼을 눌러 다운로드 페이지로 이동할 수 있습니다.`
        })
      } else {
        setUpdateCheckMessage({
          type: 'success',
          text: `현재 최신 버전(v${result.current_version})을 사용 중입니다.`
        })
      }
    } catch (err) {
      setUpdateCheckMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '업데이트 확인 중 오류가 발생했습니다.'
      })
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const handleDownloadUpdate = () => {
    if (updateInfo?.release_url && window.electron && (window.electron as any).openExternal) {
      (window.electron as any).openExternal(updateInfo.release_url)
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

        {/* Application Update Card */}
        <div className="border border-border rounded-xl bg-card/10 p-6 space-y-6 shadow-sm mt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 select-none">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground select-none">애플리케이션 업데이트</h3>
              <p className="text-xs text-muted-foreground mt-1 select-none">
                현재 설치된 NAtlas 버전을 확인하고 최신 배포 버전으로 업데이트할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border border-border/40 rounded-lg p-4 bg-muted/10">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider select-none">현재 버전</p>
              <p className="text-sm font-semibold font-mono text-slate-300">
                v{updateInfo?.current_version || '1.0.0-beta.1'}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider select-none">최신 배포 버전</p>
              <p className="text-sm font-semibold font-mono text-indigo-300">
                {updateInfo?.latest_version ? `v${updateInfo.latest_version}` : '확인 필요'}
              </p>
            </div>
          </div>

          {updateCheckMessage && (
            <div className={`p-3 border rounded-lg text-xs flex items-start gap-2.5 ${
              updateCheckMessage.type === 'success' 
                ? 'border-emerald-800/40 bg-emerald-950/20 text-emerald-400 animate-in fade-in duration-200' 
                : updateCheckMessage.type === 'info' 
                  ? 'border-indigo-800/40 bg-indigo-950/20 text-indigo-300 animate-in fade-in duration-200'
                  : 'border-rose-800/40 bg-rose-950/20 text-rose-400 animate-in fade-in duration-200'
            }`}>
              {updateCheckMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
              {updateCheckMessage.type === 'info' && <Bell className="w-4 h-4 shrink-0 mt-0.5" />}
              {updateCheckMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{updateCheckMessage.text}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border/40 select-none">
            <Button
              variant="outline"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="bg-muted/20 hover:bg-muted text-foreground border-border h-10 px-5 transition-all duration-300 text-xs"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
              {isCheckingUpdate ? '업데이트 확인 중...' : '업데이트 확인'}
            </Button>
            {updateInfo?.has_update && (
              <Button
                onClick={handleDownloadUpdate}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-5 shadow-sm transition-all duration-300 text-xs animate-in zoom-in-95 duration-200"
              >
                지금 업데이트 다운로드
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
