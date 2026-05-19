import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { api } from '@renderer/lib/api'
import { DocumentFile, DocumentsResponse } from '@renderer/lib/types'
import { StatusBadge } from '@renderer/components/StatusBadge'
import { useUIStore } from '@renderer/store/ui'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Search, RefreshCw, AlertCircle, X, FileText, Loader2 } from 'lucide-react'

// ── Markdown Viewer ───────────────────────────────────────────────────────────

function MarkdownViewer({ file, onClose }: { file: DocumentFile; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['doc-content', file.path],
    queryFn: () => api.getDocumentContent(file.path),
    staleTime: 60_000,
  })

  const filename = file.path.split('/').pop() ?? file.path

  return (
    <div className="flex flex-col h-full border-l border-border bg-[#0d1117]">
      {/* Viewer header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{filename}</p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">{file.path}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Markdown content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">불러오는 중...</span>
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 p-3 border border-rose-800/40 rounded-lg bg-rose-950/20 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error instanceof Error ? error.message : '문서를 불러올 수 없습니다.'}</span>
          </div>
        )}
        {data && (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {data.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Documents Page ────────────────────────────────────────────────────────────

export function Documents() {
  const { setActiveTab } = useUIStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'indexed' | 'modified' | 'new'>('all')
  const [selectedFile, setSelectedFile] = useState<DocumentFile | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DocumentsResponse>({
    queryKey: ['documents'],
    queryFn: api.getDocuments,
    refetchInterval: 30_000,
  })

  // Derive unique filter options from data
  const { categories, projects, users } = useMemo(() => {
    const files = data?.files ?? []
    return {
      categories: ['all', ...Array.from(new Set(files.map(f => f.category))).sort()],
      projects: ['all', ...Array.from(new Set(files.map(f => f.project).filter(Boolean) as string[])).sort()],
      users: ['all', ...Array.from(new Set(files.map(f => f.user).filter(Boolean) as string[])).sort()],
    }
  }, [data])

  // Apply filters
  const filteredFiles = useMemo(() => {
    return (data?.files ?? []).filter(file => {
      if (categoryFilter !== 'all' && file.category !== categoryFilter) return false
      if (projectFilter !== 'all' && file.project !== projectFilter) return false
      if (userFilter !== 'all' && file.user !== userFilter) return false
      if (statusFilter !== 'all' && file.status !== statusFilter) return false
      if (searchTerm && !file.path.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [data, categoryFilter, projectFilter, userFilter, statusFilter, searchTerm])

  const formatTime = (iso: string | null) => {
    if (!iso) return '-'
    try {
      const date = new Date(iso)
      const diffMs = Date.now() - date.getTime()
      const mins = Math.floor(diffMs / 60000)
      const hours = Math.floor(diffMs / 3600000)
      const days = Math.floor(diffMs / 86400000)
      if (mins < 1) return '방금 전'
      if (mins < 60) return `${mins}분 전`
      if (hours < 24) return `${hours}시간 전`
      if (days < 7) return `${days}일 전`
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    } catch { return '-' }
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
        <div className="max-w-md p-6 border border-rose-800/40 rounded-xl bg-rose-950/20 shadow-lg flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
          <h2 className="text-lg font-bold text-rose-400">오류가 발생했습니다</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {error instanceof Error ? error.message : 'LLMWiki에 접근할 수 없습니다.'}
          </p>
          <Button onClick={() => setActiveTab('settings')} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
            Settings 탭으로 이동
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-border bg-card/25 flex-shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Documents
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">LLMWiki 문서 탐색</p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-9 px-3 text-xs bg-muted/40 hover:bg-muted border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        {/* ── Filter dropdowns ── */}
        <div className="flex flex-wrap gap-2">
          {/* Category */}
          <Select value={categoryFilter} onValueChange={val => { setCategoryFilter(val); setProjectFilter('all'); setUserFilter('all') }}>
            <SelectTrigger className="h-8 w-32 text-xs bg-muted/20 border-border">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c === 'all' ? '전체 카테고리' : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Project — only meaningful for Logs */}
          <Select value={projectFilter} onValueChange={val => { setProjectFilter(val); setUserFilter('all') }}>
            <SelectTrigger className="h-8 w-32 text-xs bg-muted/20 border-border">
              <SelectValue placeholder="프로젝트" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p} value={p} className="text-xs">
                  {p === 'all' ? '전체 프로젝트' : p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User */}
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-8 w-36 text-xs bg-muted/20 border-border">
              <SelectValue placeholder="유저" />
            </SelectTrigger>
            <SelectContent>
              {users.map(u => (
                <SelectItem key={u} value={u} className="text-xs">
                  {u === 'all' ? '전체 유저' : u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <div className="flex items-center gap-1 bg-muted/20 border border-border px-1 rounded-md">
            {(['all', 'indexed', 'modified', 'new'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wide transition-all ${
                  statusFilter === f ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === 'all' ? '전체' : f === 'indexed' ? '인덱싱' : f === 'modified' ? '수정됨' : '미인덱싱'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="파일명 검색..."
              className="pl-8 h-8 text-xs bg-muted/20 border-border focus-visible:ring-indigo-500/50"
            />
          </div>
        </div>
      </div>

      {/* ── Main: list + viewer ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* File list */}
        <div className={`flex flex-col overflow-hidden transition-all duration-300 ${selectedFile ? 'w-[42%]' : 'w-full'}`}>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted/20 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl m-6">
                <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm font-semibold">조건에 맞는 파일이 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {filteredFiles.map((file) => {
                  const parts = file.path.split('/')
                  const filename = parts[parts.length - 1]
                  const isSelected = selectedFile?.path === file.path

                  // doc_type 뱃지 색상
                  const docTypeBadge = file.doc_type
                    ? {
                        order:     { bg: 'bg-indigo-500/15',  text: 'text-indigo-300',  label: 'order' },
                        report:    { bg: 'bg-amber-500/15',   text: 'text-amber-300',   label: 'report' },
                        knowledge: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', label: 'know' },
                      }[file.doc_type] ?? { bg: 'bg-muted/30', text: 'text-muted-foreground', label: file.doc_type }
                    : null

                  // primary display: slug이 있으면 slug, 없으면 filename
                  const displayName = file.slug ?? filename

                  return (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFile(isSelected ? null : file)}
                      className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors duration-150 select-none ${
                        isSelected
                          ? 'bg-indigo-900/25 border-l-2 border-l-indigo-500'
                          : 'hover:bg-muted/15 border-l-2 border-l-transparent'
                      }`}
                    >
                      <StatusBadge status={file.status} />

                      <div className="flex-1 min-w-0">
                        {/* Breadcrumb: category > project > user */}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                          <span className="text-indigo-400/80">{file.category}</span>
                          {file.project && <><span>/</span><span>{file.project}</span></>}
                          {file.user && <><span>/</span><span className="truncate max-w-[80px]">{file.user}</span></>}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          {docTypeBadge && (
                            <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${docTypeBadge.bg} ${docTypeBadge.text}`}>
                              {docTypeBadge.label}
                            </span>
                          )}
                          <p className="text-xs text-slate-200 font-medium truncate">{displayName}</p>
                        </div>
                      </div>

                      <span className="text-[11px] text-muted-foreground flex-shrink-0">
                        {formatTime(file.modified_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Markdown Viewer */}
        {selectedFile && (
          <div className="flex-1 overflow-hidden">
            <MarkdownViewer file={selectedFile} onClose={() => setSelectedFile(null)} />
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {data?.summary && (
        <div className="px-6 py-2.5 border-t border-border bg-card/35 flex items-center justify-between text-xs select-none flex-shrink-0">
          <span className="text-muted-foreground">
            총 <span className="text-foreground font-bold">{filteredFiles.length}</span>
            {filteredFiles.length !== data.summary.total && ` / ${data.summary.total}`}개 파일
          </span>
          <div className="flex items-center gap-4">
            <span><span className="text-emerald-400 font-bold">{data.summary.indexed}</span> <span className="text-muted-foreground">인덱싱됨</span></span>
            <span><span className="text-amber-400 font-bold">{data.summary.modified}</span> <span className="text-muted-foreground">수정됨</span></span>
            <span><span className="text-rose-400 font-bold">{data.summary.new}</span> <span className="text-muted-foreground">미인덱싱</span></span>
          </div>
        </div>
      )}
    </div>
  )
}

export default Documents
