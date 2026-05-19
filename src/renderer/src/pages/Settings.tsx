import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { Settings as SettingsType } from '@renderer/lib/types'
import { useUIStore } from '@renderer/store/ui'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { FolderOpen, Save, Settings as SettingsIcon, CheckCircle2, AlertCircle } from 'lucide-react'

export function Settings() {
  const queryClient = useQueryClient()
  const { setSettings: setGlobalSettings } = useUIStore()
  const [llmwikiRoot, setLlmwikiRoot] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [sourceMode, setSourceMode] = useState<'git' | 'local'>('git')
  const [gitRepoUrl, setGitRepoUrl] = useState('')
  const [isCloning, setIsCloning] = useState(false)
  const [cloneLogs, setCloneLogs] = useState<Array<{type: string; message: string}>>([])

  // Fetch current settings
  const { data: currentSettings, isLoading } = useQuery<SettingsType>({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  })

  // Set local state when query finishes loading
  useEffect(() => {
    if (currentSettings) {
      setSourceMode((currentSettings.source_mode ?? 'git') as 'git' | 'local')
      setGitRepoUrl(currentSettings.git_repo_url ?? '')
      setLlmwikiRoot(currentSettings.llmwiki_root)
      setGlobalSettings(currentSettings)
    }
  }, [currentSettings, setGlobalSettings])

  // Save Settings Mutation
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
          git_repo_url: sourceMode === 'git' ? gitRepoUrl.trim() : '',
          llmwiki_root: sourceMode === 'git' ? (currentSettings?.llmwiki_root || '') : llmwikiRoot.trim()
        })
        
        // Hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.')
      setSaveSuccess(false)
    },
  })

  // Handle open folder IPC dialog
  const handleOpenFolder = async () => {
    try {
      const selectedPath = await window.electron.openFolderDialog()
      if (selectedPath) {
        setLlmwikiRoot(selectedPath)
      }
    } catch (err) {
      setSaveError('폴더 선택 대화상자를 열 수 없습니다.')
    }
  }

  // Handle submit/save action
  const handleSave = () => {
    if (sourceMode === 'git') {
      if (!gitRepoUrl.trim()) {
        setSaveError('Git repo URL을 입력해주세요.')
        return
      }
      saveMutation.mutate({ source_mode: 'git', git_repo_url: gitRepoUrl.trim(), llmwiki_root: '' })
    } else {
      if (!llmwikiRoot.trim()) {
        setSaveError('LLMWiki 루트 경로를 입력해주세요.')
        return
      }
      saveMutation.mutate({ source_mode: 'local', git_repo_url: '', llmwiki_root: llmwikiRoot.trim() })
    }
  }

  const handleClone = async () => {
    setIsCloning(true)
    setCloneLogs([])
    setSaveError(null)

    try {
      const res = await api.cloneLLMWiki()
      if (!res.body) {
        throw new Error('응답 바디 스트림을 읽을 수 없습니다.')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const log = JSON.parse(line.slice(6))
            setCloneLogs(prev => [...prev, log])
            if (log.type === 'done' || log.type === 'error') {
              setIsCloning(false)
              if (log.type === 'done') {
                queryClient.invalidateQueries({ queryKey: ['settings'] })
                queryClient.invalidateQueries({ queryKey: ['documents'] })
                queryClient.invalidateQueries({ queryKey: ['swarmvaultStatus'] })
              }
              return
            }
          } catch (e) {
            console.error('SSE log parsing error:', e)
          }
        }
      }
    } catch (err) {
      setCloneLogs(prev => [...prev, { type: 'error', message: err instanceof Error ? err.message : '동기화 중 오류가 발생했습니다.' }])
    } finally {
      setIsCloning(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background select-text">
      {/* Header Panel */}
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

      {/* Settings Form Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-2xl">
        <div className="border border-border rounded-xl bg-card/10 p-6 space-y-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 select-none">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground select-none">LLMWiki 저장소 경로 설정</h3>
              <p className="text-xs text-muted-foreground mt-1 select-none">
                SwarmVault와 연동하기 위해 LLMWiki가 위치한 로컬 경로를 지정해 주세요.
                <br />
                해당 경로 내에 <code>content/</code> 폴더와 <code>swarmvault.config.json</code>이 있어야 합니다.
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
                variant={sourceMode === 'git' ? 'default' : 'outline'}
                onClick={() => setSourceMode('git')}
                className={`flex-1 text-xs h-9 select-none ${sourceMode === 'git' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-muted/20 text-muted-foreground'}`}
              >
                Git Repository
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

          {/* Git 모드 */}
          {sourceMode === 'git' && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                Git Repo URL
              </label>
              <Input
                type="text"
                value={gitRepoUrl}
                onChange={(e) => setGitRepoUrl(e.target.value)}
                placeholder="https://github.com/org/NSoft-LLMWiki.git"
                disabled={isLoading || saveMutation.isPending || isCloning}
                className="bg-muted/20 border-border focus-visible:ring-indigo-500/50 font-mono text-xs text-slate-200"
              />
              <p className="text-xs text-muted-foreground">
                저장 후 "동기화" 버튼으로 clone/pull을 실행하세요.
              </p>
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
                  disabled={isLoading || saveMutation.isPending}
                  className="flex-1 bg-muted/20 border-border focus-visible:ring-indigo-500/50 font-mono text-xs text-slate-200"
                />
                <Button
                  variant="outline"
                  onClick={handleOpenFolder}
                  disabled={isLoading || saveMutation.isPending}
                  className="bg-muted/40 hover:bg-muted text-foreground border-border select-none"
                >
                  <FolderOpen className="w-4 h-4 mr-1.5 text-indigo-400" />
                  폴더 선택
                </Button>
              </div>
            </div>
          )}

          {/* Clone 진행 로그 (Git 모드 전용) */}
          {sourceMode === 'git' && cloneLogs.length > 0 && (
            <div className="rounded-lg bg-black/40 border border-border p-3 space-y-1 max-h-40 overflow-y-auto">
              {cloneLogs.map((log, i) => (
                <p key={i} className={`text-xs font-mono ${log.type === 'error' ? 'text-rose-400' : log.type === 'done' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {'> '}{log.message}
                </p>
              ))}
            </div>
          )}

          {/* Feedback messages */}
          <div className="select-none">
            {saveSuccess && (
              <div className="flex items-center gap-2 p-3 border border-emerald-800/40 rounded-lg bg-emerald-950/20 text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>설정이 성공적으로 저장되었습니다.</span>
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-2 p-3 border border-rose-800/40 rounded-lg bg-rose-950/20 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 select-none pt-4 border-t border-border/40">
            {sourceMode === 'git' && (
              <Button
                onClick={handleClone}
                disabled={isLoading || saveMutation.isPending || isCloning || !gitRepoUrl.trim()}
                variant="outline"
                className="bg-muted/20 hover:bg-muted text-foreground border-border h-10 px-5 transition-all duration-300"
              >
                {isCloning ? '동기화 중...' : '동기화'}
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isLoading || saveMutation.isPending || isCloning || (sourceMode === 'git' ? !gitRepoUrl.trim() : !llmwikiRoot.trim())}
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
