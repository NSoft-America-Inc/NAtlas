import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  BookOpen,
  TrendingUp,
  Layers,
  Users,
  Activity,
  Trash2,
  Calendar,
  ChevronRight,
  ChevronDown,
  Info
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { api } from '@renderer/lib/api'
import { useUIStore } from '@renderer/store/ui'
import { Separator } from '@renderer/components/ui/separator'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-white/10 bg-[hsl(var(--background)/0.88)] backdrop-blur-md shadow-2xl shadow-black/80 select-none">
      <div className="flex items-center gap-1.5 border-b border-white/5 pb-1 mb-1">
        <Calendar className="w-3 h-3 text-purple-400" />
        <span className="text-[11px] font-black text-slate-200 tracking-wider">{label} 지식 활동</span>
      </div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between items-center gap-6 text-[10.5px]">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 5px ${entry.color}` }}></span>
            <span className="text-slate-400">{entry.dataKey === 'queries' ? '지식 탐색 (Queries)' : 'SwarmVault 동기화'}</span>
          </div>
          <span className="font-black text-xs" style={{ color: entry.color }}>{entry.value} 회</span>
        </div>
      ))}
    </div>
  )
}


export function Dashboard(): React.JSX.Element {
  const { setActiveTab } = useUIStore()
  const queryClient = useQueryClient()
  const [isRotating, setIsRotating] = useState(false)

  // Interactive Chart States
  const [period, setPeriod] = useState<string>('2weeks')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // 1. Fetch Dashboard Stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboardStats', period],
    queryFn: () => api.getDashboardStats(period),
    refetchInterval: 30_000
  })

  // 2. Fetch Build/Sync Logs
  const { data: buildLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['buildLogs'],
    queryFn: api.getBuildLogs,
    refetchInterval: 30_000
  })

  // 3. Fetch SwarmVault Status for Wiki Doc Count
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['swarmvaultStatus'],
    queryFn: api.getSwarmVaultStatus,
    refetchInterval: 30_000
  })

  // 3-1. Fetch Documents to count recent new/modified files
  const { data: docsData } = useQuery({
    queryKey: ['documents'],
    queryFn: api.getDocuments,
    refetchInterval: 30_000
  })

  // 4. Clear Build Logs Mutation
  const clearLogsMutation = useMutation({
    mutationFn: api.clearBuildLogs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildLogs'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] })
    }
  })

  const totalWikiDocs = statusData?.llmwiki?.file_count ?? 0
  
  // Calculate dynamic days based on period for the "New Knowledge" metric card
  const daysLimit = period === '1week' ? 7 : period === '2weeks' ? 14 : period === '1month' ? 30 : 365
  const newDocsCount = docsData?.files?.filter((f: any) => {
    if (f.status !== 'new' && f.status !== 'modified') return false
    if (!f.modified_at) return true // fallback to true if no modification date is supplied
    const fileDate = new Date(f.modified_at)
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() - daysLimit)
    return fileDate >= limitDate
  }).length ?? 0
  const topActiveProject = stats?.top_projects?.[0]?.project ?? null
  const topActiveProjectCount = stats?.top_projects?.[0]?.count ?? 0

  const handleRefreshAll = async () => {
    setIsRotating(true)
    await Promise.all([
      refetchStats(),
      refetchLogs(),
      queryClient.invalidateQueries({ queryKey: ['swarmvaultStatus'] })
    ])
    setTimeout(() => setIsRotating(false), 800)
  }

  const isGlobalLoading = statsLoading || logsLoading || statusLoading

  // Recharts Area Chart for activity trend
  const renderTrendChart = () => {
    const trends = stats?.daily_trends ?? []
    if (trends.length === 0 || trends.every(t => t.queries === 0 && t.builds === 0)) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center border border-indigo-500/20 rounded-2xl bg-gradient-to-br from-indigo-950/10 via-background to-card/10 shadow-lg shadow-indigo-950/5 hover:border-indigo-500/30 transition-all duration-300 w-full relative overflow-hidden group">
          {/* Subtle neon glowing light in background */}
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500" />
          <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all duration-500" />
          
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-inner mb-4 animate-pulse">
            <Sparkles className="w-6 h-6 text-indigo-400" />
          </div>
          
          <h4 className="text-xs font-bold text-slate-200 tracking-tight">전사 지식 탐색 활성화 대기 중</h4>
          <p className="text-[11px] text-muted-foreground mt-2 max-w-sm leading-relaxed">
            아직 탐색 통계 데이터가 기록되지 않았습니다.<br />
            <strong className="text-indigo-300 font-semibold cursor-pointer hover:underline" onClick={() => setActiveTab('query')}>Task Spec Explorer</strong>에서 첫 번째 SwarmVault 검색 질의를 날려 실시간 지식 분석 시각화를 활성화해 보세요!
          </p>
          
          <button 
            onClick={() => setActiveTab('query')}
            className="mt-4 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-md shadow-indigo-950/40 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            첫 SwarmVault 질의 날리러 가기
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )
    }

    const xInterval = trends.length > 20 ? 4 : trends.length > 12 ? 1 : 0

    return (
      <div className="relative w-full h-full flex flex-col">
        {/* Legends */}
        <div className="flex gap-4 mb-2 justify-end text-[11px] font-medium px-1 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow shadow-indigo-500/50"></span>
            <span className="text-muted-foreground">지식 탐색 (Queries)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow shadow-purple-500/50"></span>
            <span className="text-muted-foreground">SwarmVault 동기화 (Builds)</span>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradQueries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                  <stop offset="65%" stopColor="#6366f1" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBuilds" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} />
                  <stop offset="65%" stopColor="#a855f7" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <filter id="glowIndigo" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glowPurple" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'rgba(148,163,184,0.65)', fontSize: 11, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                interval={xInterval}
              />
              <YAxis
                tick={{ fill: 'rgba(148,163,184,0.55)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'rgba(168,85,247,0.3)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="queries"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#gradQueries)"
                filter="url(#glowIndigo)"
                dot={{ r: 4, fill: '#1e1b4b', stroke: '#6366f1', strokeWidth: 1.8 }}
                activeDot={{ r: 6, fill: '#38bdf8', stroke: '#6366f1', strokeWidth: 2.5 }}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="builds"
                stroke="#a855f7"
                strokeWidth={2.5}
                fill="url(#gradBuilds)"
                filter="url(#glowPurple)"
                dot={{ r: 4, fill: '#3b0764', stroke: '#a855f7', strokeWidth: 1.8 }}
                activeDot={{ r: 6, fill: '#ec4899', stroke: '#a855f7', strokeWidth: 2.5 }}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden p-6 gap-6">
      {/* ── TOP HEADER SECTION ── */}
      <header className="flex justify-between items-center select-none flex-shrink-0">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <Activity className="w-5.5 h-5.5 text-indigo-400" />
            NAtlas Dashboard
          </h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            전사 지식 탐색 현황 및 SwarmVault 인덱싱 운영 데이터를 시각적으로 분석합니다.
          </p>
        </div>

        <button
          onClick={handleRefreshAll}
          disabled={isGlobalLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/80 bg-card/60 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:border-border transition-all duration-300 shadow shadow-black/10 select-none cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin text-indigo-400' : ''}`} />
          새로고침
        </button>
      </header>

      <Separator className="bg-border/40 flex-shrink-0" />

      {/* Main Container: Full Screen Flex Layout */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden min-h-0">
        
        {/* ── (1) Interactive Metrics Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
          {/* Metric Card: Total Queries */}
          <div 
            onClick={() => setActiveTab('query')}
            className="group border border-border/60 hover:border-indigo-500/50 bg-card/40 hover:bg-indigo-950/10 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-sm shadow-black/10 hover:shadow-indigo-950/20 active:scale-98 select-none"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">총 지식 탐색</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold tracking-tight">{stats?.total_queries ?? 0}</span>
              <span className="text-[10px] text-muted-foreground block mt-1 group-hover:text-indigo-300/80 transition-colors flex items-center gap-0.5 font-medium">
                Query 탭 바로가기 <ChevronRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>

          {/* Metric Card: Top Active Project */}
          <div 
            onClick={() => setActiveTab('query')}
            className="group border border-border/60 hover:border-purple-500/50 bg-card/40 hover:bg-purple-950/10 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-sm shadow-black/10 hover:shadow-purple-950/20 active:scale-98 select-none"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">가장 핫한 프로젝트</span>
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold tracking-tight truncate block max-w-full" title={topActiveProject ?? '이력 없음'}>
                {topActiveProject ?? '이력 없음'}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-1 group-hover:text-purple-300/80 transition-colors flex items-center gap-0.5 font-medium">
                {topActiveProject ? `${topActiveProjectCount}회 조회 (최고 빈도)` : '조회 이력 활성화 대기 중'} <ChevronRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>

          {/* Metric Card: Recent New Knowledge (Dynamic Period) */}
          <div 
            onClick={() => setActiveTab('wiki')}
            className="group border border-border/60 hover:border-emerald-500/50 bg-card/40 hover:bg-emerald-950/10 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-sm shadow-black/10 hover:shadow-emerald-950/20 active:scale-98 select-none"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                {period === '1week' ? '최근 7일 신규 지식' : period === '2weeks' ? '최근 14일 신규 지식' : period === '1month' ? '최근 30일 신규 지식' : '최근 1년 신규 지식'}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold tracking-tight">{newDocsCount}개 문서</span>
              <span className="text-[10px] text-muted-foreground block mt-1 group-hover:text-emerald-300/80 transition-colors flex items-center gap-0.5 font-medium">
                {period === '1week' ? '7일 이내' : period === '2weeks' ? '14일 이내' : period === '1month' ? '30일 이내' : '1년 이내'} 신규/수정 문서 확인 <ChevronRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>

          {/* Metric Card: Total Wiki Documents */}
          <div 
            onClick={() => setActiveTab('wiki')}
            className="group border border-border/60 hover:border-indigo-500/50 bg-card/40 hover:bg-indigo-950/10 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-sm shadow-black/10 hover:shadow-indigo-950/20 active:scale-98 select-none"
          >
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">전체 위키 문서</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold tracking-tight">{totalWikiDocs}</span>
              <span className="text-[10px] text-muted-foreground block mt-1 group-hover:text-indigo-300/80 transition-colors flex items-center gap-0.5 font-medium">
                Wiki 탭 바로가기 <ChevronRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>
        </div>

        {/* ── (2) Activity Line Chart Card ── */}
        <div className="border border-border/60 bg-card/25 shadow-sm shadow-black/15 overflow-hidden rounded-xl flex-[1.4] flex flex-col min-h-[260px]">
          <div className="p-5 pb-2 flex-shrink-0 select-none flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-indigo-400" />
                {period === '1week' ? '7일간 지식 활동 추이' : period === '2weeks' ? '14일간 지식 활동 추이' : period === '1month' ? '30일간 지식 활동 추이' : '1년간 지식 활동 추이'}
              </h3>
              <p className="text-xs text-muted-foreground/80 mt-1">
                {period === '1year' ? '월별' : '일별'} 검색 탐색 횟수와 SwarmVault 동기화 빈도의 상대 추이를 가시화합니다.
              </p>
            </div>

            <div className="relative w-32 select-none">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full h-8 px-3 rounded-lg border border-border/80 bg-card/60 hover:bg-muted/30 hover:border-indigo-500/50 flex items-center justify-between text-xs font-semibold text-foreground transition-all duration-300 shadow shadow-black/10 cursor-pointer active:scale-98"
              >
                <span>
                  {period === '1week' ? '1주' : period === '2weeks' ? '2주' : period === '1month' ? '1달' : '1년'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-indigo-400' : ''}`} />
              </button>

              {isDropdownOpen && (
                <>
                  {/* Backdrop overlay to close dropdown on clicking outside */}
                  <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  {/* Premium Glow Dropdown Menu */}
                  <div className="absolute right-0 mt-1.5 w-full rounded-xl border border-white/10 bg-background/90 backdrop-blur-md shadow-2xl shadow-black/90 p-1.5 z-50 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      { value: '1week', label: '1주' },
                      { value: '2weeks', label: '2주' },
                      { value: '1month', label: '1달' },
                      { value: '1year', label: '1년' }
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => {
                          setPeriod(item.value)
                          setIsDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                          period === item.value
                            ? 'bg-indigo-600 text-white shadow shadow-indigo-950/40'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex-1 flex items-center pb-5 pt-1 px-5 min-h-0">
            {isGlobalLoading ? (
              <div className="w-full flex flex-col items-center justify-center h-40 gap-2">
                <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin opacity-70" />
                <span className="text-xs text-muted-foreground animate-pulse">트렌드 데이터 불러오는 중...</span>
              </div>
            ) : (
              renderTrendChart()
            )}
          </div>
        </div>

        {/* ── (3) Bottom Grid: Top Rankings & Build Logs ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-[1] min-h-[200px]">
          {/* Top Projects Bar Chart */}
          <div className="border border-border/60 bg-card/25 shadow-sm shadow-black/15 overflow-hidden rounded-xl select-none h-full flex flex-col min-h-0">
            <div className="p-5 pb-3 flex-shrink-0">
              <h3 className="text-base font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-indigo-400" />
                많이 검색된 프로젝트 TOP 5
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto pb-4 pt-1 px-5 space-y-4">
              {isGlobalLoading ? (
                <div className="py-10 text-center text-xs text-muted-foreground">로딩 중...</div>
              ) : !stats?.top_projects || stats.top_projects.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground/60 border border-dashed border-border/20 rounded-lg">조회 이력이 없습니다.</div>
              ) : (
                stats.top_projects.map((proj, idx) => {
                  const maxCount = stats.top_projects[0]?.count ?? 1
                  const percentage = Math.round((proj.count / maxCount) * 100)
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-foreground/90 truncate max-w-[180px]">{proj.project}</span>
                        <span className="text-xs text-muted-foreground/80">{proj.count}회 조회</span>
                      </div>
                      <div className="w-full h-2.5 bg-muted/40 rounded-full overflow-hidden border border-border/10">
                        <div 
                          style={{ width: `${percentage}%` }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                        ></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Top Contributors Bar Chart */}
          <div className="border border-border/60 bg-card/25 shadow-sm shadow-black/15 overflow-hidden rounded-xl select-none h-full flex flex-col min-h-0">
            <div className="p-5 pb-3 flex-shrink-0">
              <h3 className="text-base font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-indigo-400" />
                많이 검색된 담당자 TOP 5
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto pb-4 pt-1 px-5 space-y-4">
              {isGlobalLoading ? (
                <div className="py-10 text-center text-xs text-muted-foreground">로딩 중...</div>
              ) : !stats?.top_contributors || stats.top_contributors.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground/60 border border-dashed border-border/20 rounded-lg">조회 이력이 없습니다.</div>
              ) : (
                stats.top_contributors.map((contrib, idx) => {
                  const maxCount = stats.top_contributors[0]?.count ?? 1
                  const percentage = Math.round((contrib.count / maxCount) * 100)
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-foreground/90 truncate max-w-[180px]">{contrib.user_name}</span>
                        <span className="text-xs text-muted-foreground/80">{contrib.count}회 조회</span>
                      </div>
                      <div className="w-full h-2.5 bg-muted/40 rounded-full overflow-hidden border border-border/10">
                        <div 
                          style={{ width: `${percentage}%` }}
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                        ></div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* 최근 동기화 빌드 로그 */}
          <div className="border border-border/60 bg-card/25 shadow-sm shadow-black/15 flex flex-col h-full overflow-hidden rounded-xl min-h-0">
            <div className="p-5 pb-3 flex-shrink-0 flex flex-row items-center justify-between border-b border-border/40 select-none">
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-purple-400 animate-pulse" />
                  최근 동기화 빌드 로그
                </h3>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  SwarmVault 동기화/컴파일 누적 이력
                </p>
              </div>

              {buildLogs && buildLogs.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("모든 빌드 동기화 로그를 영구 삭제하시겠습니까?")) {
                      clearLogsMutation.mutate()
                    }
                  }}
                  disabled={clearLogsMutation.isPending}
                  className="p-2 rounded-lg border border-border/40 bg-card/85 text-muted-foreground hover:text-red-400 hover:border-red-500/30 hover:bg-red-950/10 hover:shadow hover:shadow-red-950/20 active:scale-95 transition-all duration-200 cursor-pointer"
                  title="이력 전체 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/5 select-text text-xs leading-normal select-text selection:bg-indigo-500/30 selection:text-white">
              {isGlobalLoading ? (
                <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin opacity-50" />
                  <span>로그 데이터 로딩 중...</span>
                </div>
              ) : !buildLogs || buildLogs.length === 0 ? (
                <div className="py-20 text-center text-xs text-muted-foreground/60 border border-dashed border-border/20 rounded-xl flex flex-col items-center gap-3">
                  <Info className="w-6 h-6 opacity-30 text-indigo-400" />
                  <span className="font-medium text-center leading-normal">
                    기록된 빌드 로그가 없습니다.<br />
                    Update 탭에서 SwarmVault를 빌드해 보세요.
                  </span>
                </div>
              ) : (
                buildLogs.map((log) => {
                  const isDone = log.status === 'done'
                  
                  return (
                    <div 
                      key={log.id} 
                      className={`p-3 rounded-lg border transition-all duration-300 hover:scale-[1.01] hover:-translate-y-[0.5px] select-none ${
                        isDone 
                          ? 'border-emerald-500/20 bg-emerald-950/5 hover:border-emerald-500/40 hover:bg-emerald-950/10' 
                          : 'border-rose-500/20 bg-rose-950/5 hover:border-rose-500/40 hover:bg-rose-950/10'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1.5 font-bold">
                        <div className="flex items-center gap-1.5">
                          {isDone ? (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black tracking-wide uppercase">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {log.action}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-black tracking-wide uppercase">
                              <XCircle className="w-2.5 h-2.5" />
                              {log.action}
                            </span>
                          )}
                        </div>
                        
                        <span className="text-[10px] text-muted-foreground/60 font-semibold flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5 opacity-60" />
                          {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      
                      <p className="text-foreground/90 font-medium break-all whitespace-pre-wrap select-text">
                        {log.log_message || (isDone ? '작업이 성공적으로 수행되었습니다.' : '수행 중 예외 오류가 발생했습니다.')}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Dashboard
