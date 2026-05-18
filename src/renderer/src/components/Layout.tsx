import React from 'react'
import { FileText, RefreshCw, Settings as SettingsIcon, Brain } from 'lucide-react'
import { useUIStore } from '@renderer/store/ui'
import { Separator } from '@renderer/components/ui/separator'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { activeTab, setActiveTab } = useUIStore()

  const tabs = [
    { id: 'documents' as const, label: 'Documents', icon: FileText },
    { id: 'update' as const, label: 'Update', icon: RefreshCw },
    { id: 'settings' as const, label: 'Settings', icon: SettingsIcon },
  ]

  // Enforce dark class on Mount
  React.useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <div className="flex w-screen h-screen bg-background text-foreground overflow-hidden">
      {/* Premium Sidebar */}
      <aside className="w-[200px] border-r border-border bg-card/45 flex flex-col justify-between select-none">
        <div>
          {/* Brand/Logo header */}
          <div className="flex items-center gap-2.5 px-5 py-6">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-inner">
              <Brain className="w-4 h-4 animate-pulse text-indigo-400" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-slate-200 via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                NAtlas
              </h1>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase font-medium">
                NSoft Sidecar
              </p>
            </div>
          </div>

          <Separator className="bg-border/60 mx-4 w-[168px]" />

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
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : ''}`} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/40 bg-muted/10">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground font-medium">NSoft America Inc.</span>
            <span className="text-[9px] text-muted-foreground/60">Phase 1 MVP v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-background/95 overflow-hidden">
        {children}
      </main>
    </div>
  )
}

export default Layout
