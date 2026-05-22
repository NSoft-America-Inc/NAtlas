import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { api } from '@renderer/lib/api'
import { useUIStore } from '@renderer/store/ui'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Badge } from '@renderer/components/ui/badge'
import {
  Sparkles,
  Search,
  Trash2,
  AlertCircle,
  Loader2,
  User,
  Folder,
  Tag,
  ArrowRight,
  ExternalLink,
  History,
  FileCheck,
  ClipboardList,
  BookOpen,
  FileText
} from 'lucide-react'
import { TaskHistoryItem } from '@renderer/lib/types'

interface TaskResult {
  query: string
  answer: string
  project: string | null
  user: string | null
  slug: string | null
  citations: string[]
}

export function Query() {
  const [input, setInput] = useState('')
  const [currentTask, setCurrentTask] = useState<TaskResult | null>(null)
  const [historyList, setHistoryList] = useState<TaskHistoryItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { setActiveTab, setSelectedWikiPath } = useUIStore()

  // 1. Fetch system status (to check local settings & availability)
  const { data: status, isLoading: isStatusLoading } = useQuery({
    queryKey: ['swarmvault-status'],
    queryFn: api.getSwarmVaultStatus,
    refetchInterval: 10_000,
  })

  // 2. Fetch documents (to map citations to real wiki paths)
  const { data: docsData } = useQuery({
    queryKey: ['documents'],
    queryFn: api.getDocuments,
    staleTime: 30_000,
  })

  // Load history from SQLite
  const fetchHistory = async () => {
    try {
      const data = await api.getTaskHistory()
      setHistoryList(data.slice().reverse()) // 최근 조회가 맨 위로 오도록 정렬
    } catch (err) {
      console.error('Failed to load task history:', err)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  // Inbound path parsing helper
  const parseCitationPath = (citPath: string) => {
    const relPath = citPath.startsWith('content/') ? citPath.substring(8) : citPath
    const parts = relPath.split('/')
    if (parts[0] === '01-Logs' && parts[1] === 'archive' && parts.length >= 5) {
      return {
        project: parts[2],
        user: parts[3],
        slug: parts[4],
        docType: parts[5]?.replace('.md', '') || null
      }
    }
    return null
  }

  // SwarmVault query mutation
  const queryMutation = useMutation({
    mutationFn: (question: string) => api.querySwarmVault(question),
    onSuccess: (data, question) => {
      setErrorMsg(null)
      const citations = data.citations || []
      let project: string | null = null
      let user: string | null = null
      let slug: string | null = null

      for (const cit of citations) {
        const parsed = parseCitationPath(cit)
        if (parsed?.slug) {
          project = parsed.project
          user = parsed.user
          slug = parsed.slug
          break
        }
      }

      setCurrentTask({
        query: question,
        answer: data.answer,
        project,
        user,
        slug,
        citations
      })

      fetchHistory() // 적재 완료 후 히스토리 동기화
    },
    onError: (error: any) => {
      setErrorMsg(error?.message || 'SwarmVault 질의 실행 중 오류가 발생했습니다.')
      setCurrentTask(null)
    }
  })

  const handleSearch = (textToSearch?: string) => {
    const searchText = (textToSearch || input).trim()
    if (!searchText || queryMutation.isPending) return

    if (!textToSearch) {
      setInput('')
    } else {
      setInput(searchText)
    }

    queryMutation.mutate(searchText)
  }

  const handleClearHistory = async () => {
    try {
      await api.clearTaskHistory()
      setHistoryList([])
      setCurrentTask(null)
    } catch (err: any) {
      console.error('Failed to clear task history in DB:', err)
    }
  }

  const navigateToDocument = (path: string) => {
    setSelectedWikiPath(path)
    setActiveTab('wiki')
  }

  // Get matching order/report/knowledge/wiki files from docsData
  const getTaskFiles = (slug: string) => {
    if (!docsData?.files) return { order: null, report: null, knowledge: null }
    const taskFiles = docsData.files.filter(f => f.slug === slug)

    return {
      order: taskFiles.find(f => f.doc_type === 'order') || null,
      report: taskFiles.find(f => f.doc_type === 'report') || null,
      knowledge: taskFiles.find(f => f.doc_type === 'wiki') || taskFiles.find(f => f.doc_type === 'knowledge' || (!['order', 'report'].includes(f.doc_type || ''))) || null
    }
  }

  const isSwarmVaultOk = status?.swarmvault?.ok && status?.llmwiki?.ok

  const matchedFiles = currentTask?.slug ? getTaskFiles(currentTask.slug) : null

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card/25 flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-indigo-300 bg-clip-text text-transparent">
            Task Spec Explorer
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            [작업계획서 + 완료보고서 + LLMWiki 지식문서] 3종 연계 작업 명세 및 히스토리 탐색기
          </p>
        </div>
        {historyList.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="h-9 px-3 text-xs bg-muted/40 hover:bg-rose-950/20 hover:text-rose-400 hover:border-rose-900/40 border-border transition-all"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            조회 이력 비우기
          </Button>
        )}
      </div>

      {/* Constraints check */}
      {!isSwarmVaultOk && !isStatusLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card/[0.01]">
          <div className="max-w-md p-8 border border-rose-900/30 rounded-2xl bg-rose-950/5 shadow-xl flex flex-col items-center gap-5">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-rose-900/10 text-rose-400 border border-rose-500/20 shadow-inner">
              <AlertCircle className="w-7 h-7 text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-rose-400">SwarmVault 컴파일 필요</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                현재 SwarmVault 벡터 인덱스가 존재하지 않거나 빌드되지 않았습니다.
                <strong>Update</strong> 탭으로 이동하여 [업데이트 실행]을 수행하여 인덱스를 컴파일해 주세요.
              </p>
            </div>
            <Button
              onClick={() => setActiveTab('update')}
              className="bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800/40 text-slate-200 text-xs font-semibold px-5 py-2.5 rounded-lg shadow-lg transition-all flex items-center gap-1.5"
            >
              업데이트 탭으로 이동
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="p-6 border-b border-border bg-card/10 flex-shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSearch()
              }}
              className="flex items-center gap-2 max-w-4xl mx-auto"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="프로젝트명, 담당자 이름(developer-a), 또는 작업 키워드(memo)를 입력하고 작업 명세를 탐색해 보세요..."
                  disabled={queryMutation.isPending}
                  className="pl-10 h-11 text-xs bg-muted/20 border-border focus-visible:ring-indigo-500/50 rounded-xl"
                />
              </div>
              <Button
                type="submit"
                disabled={!input.trim() || queryMutation.isPending}
                className="h-11 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                {queryMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>조회 중...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>작업 탐색</span>
                  </>
                )}
              </Button>
            </form>

            {/* Quick Chips */}
            {!currentTask && !queryMutation.isPending && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4">
                <span className="text-[10px] font-bold text-indigo-400/80 tracking-wider uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> 추천 키워드:
                </span>
                {['memo', 'developer-a', 'feat-delete', 'nstack', 'timer'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleSearch(tag)}
                    className="text-[11px] px-3 py-1.5 rounded-full bg-indigo-950/20 border border-indigo-900/30 hover:border-indigo-500/30 hover:bg-indigo-950/40 text-slate-300 font-medium transition-all"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 px-6 py-6">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Error Box */}
              {errorMsg && (
                <div className="p-4 border border-rose-900/40 bg-rose-950/10 text-rose-400 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">조회 중 문제 발생:</span> {errorMsg}
                  </div>
                </div>
              )}

              {/* Skeleton loading during query */}
              {queryMutation.isPending && (
                <div className="border border-border/80 rounded-2xl bg-card/40 p-6 space-y-6 shadow-md animate-pulse">
                  <div className="flex justify-between items-center pb-4 border-b border-border/40">
                    <div className="flex gap-2">
                      <div className="h-5 bg-muted rounded w-20" />
                      <div className="h-5 bg-muted rounded w-24" />
                    </div>
                    <div className="h-4 bg-muted rounded w-32" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-11/12" />
                    <div className="h-4 bg-muted rounded w-9/12" />
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-border/40">
                    <div className="h-9 bg-muted rounded w-28" />
                    <div className="h-9 bg-muted rounded w-28" />
                  </div>
                </div>
              )}

              {/* Real Search Result Card */}
              {currentTask && !queryMutation.isPending && (
                <div className="border border-border rounded-2xl bg-card shadow-lg hover:shadow-indigo-500/[0.02] transition-all overflow-hidden flex flex-col">
                  {/* Card Header */}
                  <div className="px-6 py-4 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {currentTask.project ? (
                        <Badge variant="secondary" className="bg-indigo-950 text-indigo-400 border border-indigo-900/60 font-semibold px-2.5 py-0.5 text-xs flex items-center gap-1">
                          <Folder className="w-3.5 h-3.5" />
                          {currentTask.project}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border text-xs px-2.5 py-0.5">
                          프로젝트 미정
                        </Badge>
                      )}

                      {currentTask.user ? (
                        <Badge variant="secondary" className="bg-emerald-950 text-emerald-400 border border-emerald-900/60 font-semibold px-2.5 py-0.5 text-xs flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {currentTask.user}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border text-xs px-2.5 py-0.5">
                          담당자 미정
                        </Badge>
                      )}
                    </div>

                    {currentTask.slug && (
                      <span className="text-xs font-mono text-indigo-300 font-bold bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Tag className="w-3 h-3 text-indigo-400" />
                        {currentTask.slug}
                      </span>
                    )}
                  </div>

                  {/* Card Content - Markdown Q&A */}
                  <div className="px-6 py-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest mb-3.5">
                        작업 히스토리 요약 및 상태 명세
                      </h4>
                      <div className="markdown-body text-sm leading-relaxed text-slate-300">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                        >
                          {currentTask.answer}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Action buttons to go to order.md / report.md / knowledge.md */}
                    <div className="mt-8 pt-5 border-t border-border/80">
                      <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        연계 마크다운 산출물
                      </h5>

                      <div className="flex flex-wrap gap-3">
                        {/* Order File */}
                        {matchedFiles?.order ? (
                          <Button
                            onClick={() => navigateToDocument(matchedFiles.order!.path)}
                            className="bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900 border border-indigo-800/60 shadow-md text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                          >
                            <ClipboardList className="w-4 h-4 text-indigo-400" />
                            작업계획서 (order.md)
                            <ExternalLink className="w-3 h-3 text-indigo-400/70" />
                          </Button>
                        ) : (
                          <Button
                            disabled
                            className="bg-muted/10 text-muted-foreground border border-border/40 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
                          >
                            <ClipboardList className="w-4 h-4 opacity-55" />
                            계획서 없음 (order.md)
                          </Button>
                        )}

                        {/* Report File */}
                        {matchedFiles?.report ? (
                          <Button
                            onClick={() => navigateToDocument(matchedFiles.report!.path)}
                            className="bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 border border-emerald-800/60 shadow-md text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                          >
                            <FileCheck className="w-4 h-4 text-emerald-400" />
                            완료보고서 (report.md)
                            <ExternalLink className="w-3 h-3 text-emerald-400/70" />
                          </Button>
                        ) : (
                          <Button
                            disabled
                            className="bg-muted/10 text-muted-foreground border border-border/40 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
                          >
                            <FileCheck className="w-4 h-4 opacity-55" />
                            보고서 없음 (report.md)
                          </Button>
                        )}

                        {/* Knowledge or general markdown File */}
                        {matchedFiles?.knowledge ? (
                          <Button
                            onClick={() => navigateToDocument(matchedFiles.knowledge!.path)}
                            className="bg-purple-950/60 text-purple-300 hover:bg-purple-900 border border-purple-800/60 shadow-md text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5"
                          >
                            <BookOpen className="w-4 h-4 text-purple-400" />
                            지식문서 (LLMWiki)
                            <ExternalLink className="w-3 h-3 text-purple-400/70" />
                          </Button>
                        ) : (
                          <Button
                            disabled
                            className="bg-muted/10 text-muted-foreground border border-border/40 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5"
                          >
                            <BookOpen className="w-4 h-4 opacity-55" />
                            지식문서 없음
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Queries Timeline section */}
              {historyList.length > 0 && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-xs font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-2">
                    <History className="w-4 h-4" />
                    최근 조회한 작업 명세 히스토리
                  </h3>

                  <div className="overflow-hidden border border-border bg-card/35 rounded-2xl">
                    <div className="divide-y divide-border/60">
                      {historyList.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleSearch(item.query_text)}
                          className="px-5 py-3.5 hover:bg-muted/40 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1.5 max-w-lg">
                            <p className="font-bold text-foreground line-clamp-1 hover:text-indigo-400 transition-colors">
                              {item.query_text}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.project && (
                                <span className="bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                  <Folder className="w-2.5 h-2.5" />
                                  {item.project}
                                </span>
                              )}
                              {item.user_name && (
                                <span className="bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                                  <User className="w-2.5 h-2.5" />
                                  {item.user_name}
                                </span>
                              )}
                              {item.task_slug !== 'unknown' && (
                                <span className="bg-muted border border-border text-slate-300 font-mono text-[9px] px-1.5 py-0.5 rounded">
                                  {item.task_slug}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground text-[10px] sm:text-right shrink-0">
                            <span>{new Date(item.created_at).toLocaleString('ko-KR', { hour12: false })}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Initial empty state */}
              {!currentTask && !queryMutation.isPending && historyList.length === 0 && (
                <div className="py-20 text-center select-none">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-900/10 text-indigo-400 border border-indigo-500/20 shadow-inner mx-auto mb-6">
                    <Search className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">작업 명세 탐색을 시작해 보세요</h3>
                  <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                    프로젝트(memo, nstack), 담당자(developer-a) 또는 작업 내용을 검색하면 SwarmVault 벡터 데이터로부터 최적화된 마크다운 산출물 3종 세트가 매칭됩니다.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

export default Query
