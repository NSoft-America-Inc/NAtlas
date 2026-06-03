import React from 'react'
import { FileText, RefreshCw, Settings as SettingsIcon, Brain, BookOpen, Sparkles, BarChart3, Bell, X } from 'lucide-react'
import { useUIStore } from '@renderer/store/ui'
import { Separator } from '@renderer/components/ui/separator'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@renderer/components/ui/resizable'
import { useQuery } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { activeTab, setActiveTab } = useUIStore()
  const [isBannerDismissed, setIsBannerDismissed] = React.useState(false)

  const { data: updateInfo } = useQuery({
    queryKey: ['checkUpdate'],
    queryFn: api.checkUpdate,
    refetchInterval: 300_000 // 5분
  })

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
    { id: 'documents' as const, label: 'Documents', icon: FileText },
    { id: 'wiki' as const, label: 'Wiki', icon: BookOpen },
    { id: 'query' as const, label: 'Query', icon: Sparkles },
    { id: 'update' as const, label: 'Update', icon: RefreshCw },
    { id: 'settings' as const, label: 'Settings', icon: SettingsIcon },
  ]

  // Enforce dark class on Mount
  React.useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <div className="w-screen h-screen bg-background text-foreground overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        {/* Premium Sidebar */}
        <ResizablePanel 
          defaultSize="16%" 
          minSize="12%" 
          maxSize="25%" 
          className="bg-card/45 flex flex-col justify-between select-none h-full"
        >
          <div>
            {/* Brand/Logo header */}
            <div className="flex items-center gap-2.5 px-5 py-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-inner">
                <Brain className="w-4 h-4 animate-pulse text-indigo-400" />
              </div>
              <div className="truncate">
                <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-slate-200 via-indigo-200 to-indigo-400 bg-clip-text text-transparent truncate">
                  NAtlas
                </h1>
                <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-medium truncate">
                  NSoft Sidecar
                </p>
              </div>
            </div>

            <Separator className="bg-border/60 mx-auto w-[calc(100%-2rem)]" />

            {/* Navigation Links */}
            <nav className="px-3 py-4 space-y-1.5">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 border ${
                      isActive
                        ? 'bg-accent/70 text-accent-foreground border-accent-foreground/20 shadow-md shadow-black/30'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : ''}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border/40 bg-muted/10">
            <div className="flex flex-col gap-0.5 truncate">
              <span className="text-[10px] text-muted-foreground font-medium truncate">NSoft America Inc.</span>
              <span className="text-[9px] text-muted-foreground/60 truncate">
                Phase 2 {updateInfo?.current_version ? `v${updateInfo.current_version}` : 'v1.0.0-beta.1'}
              </span>
            </div>
          </div>
        </ResizablePanel>

        {/* Resizable drag line */}
        <ResizableHandle withHandle className="bg-border/60 hover:bg-indigo-500/50 transition-colors" />

        {/* Main Content Area */}
        <ResizablePanel defaultSize="84%" className="flex flex-col h-full bg-background/95 overflow-hidden">
          {updateInfo?.has_update && !isBannerDismissed && (
            <div className="flex items-center justify-between px-5 py-3.5 bg-indigo-950/45 border-b border-indigo-500/20 text-indigo-200 select-none animate-in slide-in-from-top duration-300 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Bell className="w-4 h-4 text-indigo-400 animate-bounce shrink-0" />
                <span className="text-xs font-medium truncate">
                  NAtlas의 새로운 버전(<span className="text-indigo-300 font-semibold">{updateInfo.latest_version}</span>)이 준비되었습니다. (현재 버전: {updateInfo.current_version})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (window.electron && (window.electron as any).openExternal) {
                      (window.electron as any).openExternal(updateInfo.release_url)
                    }
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold tracking-wide transition-all shadow-inner shadow-white/10"
                >
                  지금 업데이트
                </button>
                <button
                  onClick={() => setIsBannerDismissed(true)}
                  className="p-1 hover:bg-indigo-900/60 rounded text-indigo-400 hover:text-indigo-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {children}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export default Layout
