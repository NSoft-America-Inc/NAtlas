import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { api } from '@renderer/lib/api'
import { DocumentFile, DocumentsResponse } from '@renderer/lib/types'
import { StatusBadge } from '@renderer/components/StatusBadge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useUIStore } from '@renderer/store/ui'
import {
  Search,
  RefreshCw,
  AlertCircle,
  FileText,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  BookOpen,
  History,
  X,
  Loader2,
  Briefcase,
  Tag,
  ClipboardList,
  CheckCircle2,
  Brain,
  LayoutGrid,
  FolderTree,
  ExternalLink
} from 'lucide-react'
import { WikiGraph } from './WikiGraph'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@renderer/components/ui/resizable'

// ── Types ──
interface TreeNode {
  name: string
  path: string
  type: 'directory' | 'file'
  children?: TreeNode[]
  file?: DocumentFile
  // Logical view enhancements
  nodeKind?: 'project' | 'task' | 'doc-order' | 'doc-report' | 'doc-knowledge' | 'system-root' | 'system-dir'
  logicalLabel?: string
  issueUrl?: string | null
}

// Doc type → 논리 레이블/아이콘 매핑
const DOC_TYPE_META: Record<string, { label: string; icon: React.FC<{ className?: string }>; kind: TreeNode['nodeKind'] }> = {
  order:     { label: '작업계획서', icon: ClipboardList,  kind: 'doc-order' },
  report:    { label: '완료보고서',  icon: CheckCircle2,   kind: 'doc-report' },
  knowledge: { label: '지식문서',    icon: Brain,          kind: 'doc-knowledge' },
}
const DOC_TYPE_ORDER = ['order', 'report', 'knowledge']

// ── Markdown Wiki Viewer ──
interface WikiViewerProps {
  file: DocumentFile
  history: any[]
  onClose: () => void
  onWikiLinkClick: (slug: string) => void
  onSearchHistoryClick: (query: string) => void
}

function WikiViewer({ file, history, onClose, onWikiLinkClick, onSearchHistoryClick }: WikiViewerProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['doc-content', file.path],
    queryFn: () => api.getDocumentContent(file.path),
    staleTime: 60_000,
  })

  const filename = file.path.split('/').pop() ?? file.path

  const matchedHistory = useMemo(() => {
    if (!file.slug || !history) return []
    return history.filter(item => item.task_slug === file.slug)
  }, [file.slug, history])

  const processedContent = useMemo(() => {
    if (!data?.content) return ''
    // 기계 판독용 YAML Frontmatter 제거
    const cleaned = data.content.replace(/^---\s*\n(.*?)\n---\s*\n/s, '')
    return cleaned.replace(/\[\[([^\]]+)\]\]/g, '[$1](wiki://$1)')
  }, [data?.content])

  return (
    <div className="flex flex-col h-full border-l border-border bg-[#0d1117]">
      {/* Viewer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{filename}</p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">{file.path}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {file.issue_url && (
            <a
              href={file.issue_url}
              onClick={(e) => {
                e.preventDefault()
                if (window.electron && (window.electron as any).openExternal) {
                  (window.electron as any).openExternal(file.issue_url!)
                } else {
                  window.open(file.issue_url!, '_blank', 'noopener,noreferrer')
                }
              }}
              className="p-1.5 rounded hover:bg-muted/40 text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              title="GitHub Issue 열기"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">이슈 바로가기</span>
            </a>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Rendering */}
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
              components={{
                a: ({ href, children, ...props }) => {
                  if (href?.startsWith('wiki://')) {
                    const slug = href.replace('wiki://', '')
                    return (
                      <span
                        onClick={(e) => {
                          e.preventDefault()
                          onWikiLinkClick(decodeURIComponent(slug))
                        }}
                        className="text-indigo-400 font-bold border-b border-dashed border-indigo-400/50 hover:text-indigo-300 hover:border-indigo-300 cursor-pointer select-none transition-colors"
                      >
                        {children}
                      </span>
                    )
                  }
                  const isExternal = href?.startsWith('http://') || href?.startsWith('https://')
                  return (
                    <a
                      href={href}
                      onClick={(e) => {
                        if (isExternal) {
                          e.preventDefault()
                          if (window.electron && (window.electron as any).openExternal) {
                            (window.electron as any).openExternal(href!)
                          } else {
                            window.open(href!, '_blank', 'noopener,noreferrer')
                          }
                        }
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  )
                }
              }}
            >
              {processedContent}
            </ReactMarkdown>

            {/* 과거 연계 질의 히스토리 타임라인 */}
            {matchedHistory.length > 0 && (
              <div className="mt-12 pt-6 border-t border-border/80 select-none">
                <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  이 작업에 대한 탐색 이력 ({matchedHistory.length}건)
                </h5>
                <div className="space-y-3">
                  {matchedHistory.map(item => (
                    <div
                      key={item.id}
                      onClick={() => onSearchHistoryClick(item.query_text)}
                      className="p-3.5 rounded-xl border border-border/60 bg-muted/10 hover:bg-indigo-950/20 hover:border-indigo-500/30 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="font-semibold text-slate-300 hover:text-indigo-400 transition-colors line-clamp-1">
                          "{item.query_text}"
                        </p>
                        {item.user_name && (
                          <span className="text-[10px] text-muted-foreground">담당: {item.user_name}</span>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 shrink-0 font-mono">
                        {new Date(item.created_at).toLocaleString('ko-KR', { hour12: false })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Folder View TreeItem (Recursive, unchanged logic) ──
interface TreeItemProps {
  node: TreeNode
  level: number
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
  selectedFile: DocumentFile | null
  onSelectFile: (file: DocumentFile) => void
}

function TreeItem({ node, level, expandedFolders, toggleFolder, selectedFile, onSelectFile }: TreeItemProps) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedFile?.path === node.file?.path
  const paddingLeft = `${level * 12}px`

  if (node.type === 'directory') {
    return (
      <div className="select-none">
        <div
          onClick={() => toggleFolder(node.path)}
          style={{ paddingLeft }}
          className="flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-muted/10 text-xs font-semibold text-slate-300 hover:text-foreground transition-all duration-150"
        >
          <span className="text-muted-foreground/60">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <span className="text-indigo-400/70">
            {isExpanded ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
          </span>
          <span className="truncate">{node.name}</span>
        </div>

        {isExpanded && node.children && (
          <div className="space-y-0.5">
            {node.children.map(child => (
              <TreeItem
                key={child.path}
                node={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => node.file && onSelectFile(node.file)}
      style={{ paddingLeft: `${(level + 1) * 12}px` }}
      className={`flex items-center justify-between py-1.5 px-3.5 cursor-pointer text-xs transition-all duration-150 select-none ${
        isSelected
          ? 'bg-indigo-900/20 text-indigo-300 font-semibold border-r-2 border-r-indigo-500 shadow-inner'
          : 'hover:bg-muted/5 text-muted-foreground hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-muted-foreground/50'}`} />
        <span className="truncate font-mono">{node.name}</span>
      </div>
      {node.file && <StatusBadge status={node.file.status} />}
    </div>
  )
}

// ── Logical View TreeItem ──
function LogicalTreeItem({ node, level, expandedFolders, toggleFolder, selectedFile, onSelectFile }: TreeItemProps) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = node.file ? selectedFile?.path === node.file.path : false
  const paddingLeft = `${level * 14}px`

  if (node.type === 'directory') {
    // Project root
    if (node.nodeKind === 'project') {
      return (
        <div className="select-none mb-1">
          <div
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft }}
            className="flex items-center gap-2 py-1.5 px-2 cursor-pointer rounded-md hover:bg-indigo-950/30 transition-all duration-150 group"
          >
            <span className="text-muted-foreground/60">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            </span>
            <Briefcase className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div className="space-y-0.5 mt-0.5">
              {node.children.map(child => (
                <LogicalTreeItem
                  key={child.path}
                  node={child}
                  level={level + 1}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                  selectedFile={selectedFile}
                  onSelectFile={onSelectFile}
                />
              ))}
            </div>
          )}
        </div>
      )
    }

    // Task slug folder
    if (node.nodeKind === 'task') {
      return (
        <div className="select-none">
          <div
            onClick={() => toggleFolder(node.path)}
            style={{ paddingLeft }}
            className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-muted/10 transition-all duration-150 group"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-muted-foreground/50">
                {isExpanded ? <ChevronDown className="w-3 h-3 text-amber-400/70" /> : <ChevronRight className="w-3 h-3" />}
              </span>
              <Tag className="w-3 h-3 text-amber-400/80 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-300 group-hover:text-slate-100 truncate font-mono">{node.name}</span>
              {node.logicalLabel && (
                <span className="text-[9px] text-muted-foreground/50 ml-1 truncate hidden group-hover:block">{node.logicalLabel}</span>
              )}
            </div>
            {node.issueUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.electron && (window.electron as any).openExternal) {
                    (window.electron as any).openExternal(node.issueUrl!)
                  } else {
                    window.open(node.issueUrl!, '_blank', 'noopener,noreferrer')
                  }
                }}
                className="p-1 rounded text-muted-foreground/60 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors flex-shrink-0"
                title="GitHub Issue 열기"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          {isExpanded && node.children && (
            <div className="space-y-0.5">
              {node.children.map(child => (
                <LogicalTreeItem
                  key={child.path}
                  node={child}
                  level={level + 1}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                  selectedFile={selectedFile}
                  onSelectFile={onSelectFile}
                />
              ))}
            </div>
          )}
        </div>
      )
    }

    // System root / system dir
    const isSysRoot = node.nodeKind === 'system-root'
    return (
      <div className="select-none mt-2">
        <div
          onClick={() => toggleFolder(node.path)}
          style={{ paddingLeft }}
          className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-all duration-150 group ${isSysRoot ? 'rounded-md hover:bg-violet-950/30' : 'hover:bg-muted/10'}`}
        >
          <span className="text-muted-foreground/60">
            {isExpanded
              ? <ChevronDown className={`w-3.5 h-3.5 ${isSysRoot ? 'text-violet-400' : 'text-muted-foreground/60'}`} />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          </span>
          {isSysRoot
            ? <Brain className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            : isExpanded
              ? <FolderOpen className="w-3.5 h-3.5 text-violet-400/60 flex-shrink-0" />
              : <Folder className="w-3.5 h-3.5 text-violet-400/50 flex-shrink-0" />}
          <span className={`text-xs truncate ${isSysRoot ? 'font-bold text-violet-300 group-hover:text-violet-200' : 'font-semibold text-slate-400 group-hover:text-slate-200'}`}>
            {node.name}
          </span>
        </div>
        {isExpanded && node.children && (
          <div className="space-y-0.5">
            {node.children.map(child => (
              <LogicalTreeItem
                key={child.path}
                node={child}
                level={level + 1}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // File leaf — logical doc type rendering
  const meta = node.file?.doc_type ? DOC_TYPE_META[node.file.doc_type] : null
  const DocIcon = meta?.icon ?? FileText
  const docLabel = meta?.label ?? (node.file?.path.split('/').pop() ?? node.name)
  const fileIssueUrl = node.file?.issue_url

  return (
    <div
      onClick={() => node.file && onSelectFile(node.file)}
      style={{ paddingLeft: `${(level + 1) * 14}px` }}
      className={`flex items-center justify-between py-1.5 px-2 cursor-pointer text-xs transition-all duration-150 select-none rounded-sm ${
        isSelected
          ? 'bg-indigo-900/25 text-indigo-300 font-semibold border-r-2 border-r-indigo-500 shadow-inner'
          : 'hover:bg-muted/8 text-muted-foreground hover:text-slate-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <DocIcon className={`w-3.5 h-3.5 flex-shrink-0 ${
          isSelected ? 'text-indigo-400'
          : meta?.kind === 'doc-order' ? 'text-sky-400/70'
          : meta?.kind === 'doc-report' ? 'text-emerald-400/70'
          : meta?.kind === 'doc-knowledge' ? 'text-amber-400/60'
          : 'text-muted-foreground/50'
        }`} />
        <span className="truncate">{docLabel}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {fileIssueUrl && (
          <button
            onClick={() => {
              if (window.electron && (window.electron as any).openExternal) {
                (window.electron as any).openExternal(fileIssueUrl)
              } else {
                window.open(fileIssueUrl, '_blank', 'noopener,noreferrer')
              }
            }}
            className="p-1 rounded text-muted-foreground/60 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            title="GitHub Issue 열기"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
        {node.file && <StatusBadge status={node.file.status} />}
      </div>
    </div>
  )
}

// ── Main Wiki Page Component ──
export function Wiki() {
  const [searchTerm, setSearchTerm] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [docTypeFilter, setDocTypeFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('all')
  const [selectedFile, setSelectedFile] = useState<DocumentFile | null>(null)
  const [showGraph, setShowGraph] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [recentDocs, setRecentDocs] = useState<DocumentFile[]>([])
  const [refetchedPath, setRefetchedPath] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'project' | 'folder'>('project')

  // 날짜 검색 기한 필터 정밀 연산 헬퍼
  const checkDateMatch = (modifiedAt: string | null, filter: string) => {
    if (filter === 'all') return true
    if (!modifiedAt) return false
    
    try {
      const fileDate = new Date(modifiedAt)
      const diffMs = Date.now() - fileDate.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      
      if (filter === '1week') return diffDays <= 7
      if (filter === '2weeks') return diffDays <= 14
      if (filter === '1month') return diffDays <= 30
      if (filter === '3months') return diffDays <= 90
    } catch {
      return false
    }
    return true
  }

  const { selectedWikiPath, setSelectedWikiPath, setSearchQueryText, setActiveTab } = useUIStore()

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DocumentsResponse>({
    queryKey: ['documents'],
    queryFn: api.getDocuments,
    refetchInterval: 30_000,
  })

  // Dynamic filter options extraction
  const { projects, users } = useMemo(() => {
    const files = data?.files ?? []
    return {
      projects: ['all', ...Array.from(new Set(files.map(f => f.project).filter(Boolean) as string[])).sort()],
      users: ['all', ...Array.from(new Set(files.map(f => f.user).filter(Boolean) as string[])).sort()],
    }
  }, [data])

  // SQLite 작업 질의 이력 TanStack Query 호출
  const { data: historyData } = useQuery({
    queryKey: ['task-history'],
    queryFn: api.getTaskHistory,
    refetchInterval: 30_000,
  })

  const handleSearchHistoryClick = (queryText: string) => {
    setSearchQueryText(queryText)
    setActiveTab('query')
  }

  // Load recent documents from localStorage

  // Load recent documents from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('natlas_recent_wiki_docs')
    if (saved) {
      try { setRecentDocs(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

  const addRecentDoc = (file: DocumentFile) => {
    setRecentDocs(prev => {
      const filtered = prev.filter(d => d.path !== file.path)
      const next = [file, ...filtered].slice(0, 5)
      localStorage.setItem('natlas_recent_wiki_docs', JSON.stringify(next))
      return next
    })
  }

  // Pre-expand top-level folders on initial load
  useEffect(() => {
    if (data?.files && expandedFolders.size === 0) {
      const topFolders = new Set<string>()
      data.files.forEach(f => {
        const top = f.path.split('/')[0]
        if (top) topFolders.add(top)
      })
      setExpandedFolders(topFolders)
    }
  }, [data])

  // Reveal file in folder-view tree
  const revealFileInFolderTree = (filePath: string) => {
    const parts = filePath.split('/')
    const foldersToExpand: string[] = []
    for (let i = 1; i < parts.length; i++) {
      foldersToExpand.push(parts.slice(0, i).join('/'))
    }
    setExpandedFolders(prev => {
      const next = new Set(prev)
      foldersToExpand.forEach(f => next.add(f))
      return next
    })
  }

  // Reveal file in logical project tree: expand project + task nodes
  const revealFileInProjectTree = (file: DocumentFile) => {
    const toExpand: string[] = []
    if (file.project) {
      toExpand.push(`__project__${file.project}`)
      if (file.slug) {
        toExpand.push(`__task__${file.project}__${file.slug}`)
      }
    } else {
      // System file: expand system root + directory path
      toExpand.push('__system__')
      const parts = file.path.split('/')
      for (let i = 1; i < parts.length; i++) {
        toExpand.push(`__sysdir__${parts.slice(0, i).join('/')}`)
      }
    }
    setExpandedFolders(prev => {
      const next = new Set(prev)
      toExpand.forEach(k => next.add(k))
      return next
    })
  }

  const revealFileInTree = (file: DocumentFile) => {
    if (viewMode === 'project') {
      revealFileInProjectTree(file)
    } else {
      revealFileInFolderTree(file.path)
    }
  }

  // Cross-tab navigation bridge
  useEffect(() => {
    if (!selectedWikiPath || !data?.files) return

    const target = data.files.find(f => f.path === selectedWikiPath)
    if (target) {
      setSelectedFile(target)
      addRecentDoc(target)
      revealFileInTree(target)
      setSelectedWikiPath(null)
      setRefetchedPath(null)
    } else {
      if (refetchedPath !== selectedWikiPath) {
        setRefetchedPath(selectedWikiPath)
        refetch()
      } else {
        console.warn(`Bridge target file not found: ${selectedWikiPath}`)
        setSelectedWikiPath(null)
        setRefetchedPath(null)
      }
    }
  }, [selectedWikiPath, data?.files, refetch, setSelectedWikiPath, refetchedPath, viewMode])

  // ── Build hierarchical folder tree (Folder View) ──
  const folderTree = useMemo(() => {
    const files = data?.files ?? []
    const root: TreeNode = { name: 'Root', path: '', type: 'directory', children: [] }

    files.forEach(file => {
      if (searchTerm && !file.path.toLowerCase().includes(searchTerm.toLowerCase())) return
      if (projectFilter !== 'all' && file.project !== projectFilter) return
      if (userFilter !== 'all' && file.user !== userFilter) return
      if (docTypeFilter !== 'all' && file.doc_type !== docTypeFilter) return
      if (!checkDateMatch(file.modified_at, periodFilter)) return

      const parts = file.path.split('/')
      let current = root

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1
        const pathSoFar = parts.slice(0, index + 1).join('/')

        if (isLast) {
          current.children = current.children || []
          current.children.push({ name: part, path: file.path, type: 'file', file })
        } else {
          current.children = current.children || []
          let dirNode = current.children.find(c => c.name === part && c.type === 'directory')
          if (!dirNode) {
            dirNode = { name: part, path: pathSoFar, type: 'directory', children: [] }
            current.children.push(dirNode)
          }
          current = dirNode
        }
      })
    })

    const sortTree = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      nodes.forEach(n => { if (n.children) sortTree(n.children) })
    }

    if (root.children) sortTree(root.children)
    return root.children || []
  }, [data, searchTerm, projectFilter, userFilter, docTypeFilter, periodFilter])

  // ── Build logical project tree (Project View) ──
  const projectTree = useMemo((): TreeNode[] => {
    const files = data?.files ?? []

    // Partition: project files vs system/non-project files
    const projectFiles = files.filter(f => {
      if (searchTerm && !file_matches_search(f, searchTerm)) return false
      if (projectFilter !== 'all' && f.project !== projectFilter) return false
      if (userFilter !== 'all' && f.user !== userFilter) return false
      if (docTypeFilter !== 'all' && f.doc_type !== docTypeFilter) return false
      if (!checkDateMatch(f.modified_at, periodFilter)) return false
      return f.category === 'Logs' && f.project && f.slug
    })
    const systemFiles = files.filter(f => {
      if (searchTerm && !file_matches_search(f, searchTerm)) return false
      if (docTypeFilter !== 'all' && f.doc_type !== docTypeFilter) return false
      if (!checkDateMatch(f.modified_at, periodFilter)) return false
      return !(f.category === 'Logs' && f.project && f.slug)
    })

    // Group: project → slug → files
    const projectMap = new Map<string, Map<string, DocumentFile[]>>()
    projectFiles.forEach(f => {
      const pName = f.project!
      const sName = f.slug!
      if (!projectMap.has(pName)) projectMap.set(pName, new Map())
      const slugMap = projectMap.get(pName)!
      if (!slugMap.has(sName)) slugMap.set(sName, [])
      slugMap.get(sName)!.push(f)
    })

    // Build project nodes
    const projectNodes: TreeNode[] = []
    projectMap.forEach((slugMap, projectName) => {
      const taskNodes: TreeNode[] = []

      slugMap.forEach((taskFiles, slug) => {
        // Sort files by doc type order
        const sorted = [...taskFiles].sort((a, b) => {
          const ai = DOC_TYPE_ORDER.indexOf(a.doc_type ?? '')
          const bi = DOC_TYPE_ORDER.indexOf(b.doc_type ?? '')
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })

        // Developer name from user field
        const developer = taskFiles[0]?.user ?? null

        // order.md 또는 타 문서에서 title 및 issue_url 획득
        const orderFile = taskFiles.find(f => f.doc_type === 'order')
        const taskTitle = orderFile?.title || null
        const issueUrl = orderFile?.issue_url || taskFiles.find(f => f.issue_url)?.issue_url || null

        // 타이틀에서 불필요한 접두사 (feat:, fix:, 현재 작업:, [Order] 등) 제거하여 순수 작업내용 추출
        let cleanTitle = taskTitle;
        if (cleanTitle) {
          cleanTitle = cleanTitle.replace(/^(feat|fix|chore|refactor|docs|현재\s*작업)\s*:\s*/i, '');
          cleanTitle = cleanTitle.replace(/^\[[^\]]+\]\s*/, '');
          cleanTitle = cleanTitle.trim();
        }

        // 📁 작업내용 (작업자: 담당자) 형태로 표시 이름 다듬기
        let taskLabel = cleanTitle || slug
        if (developer) {
          taskLabel = `${taskLabel} (작업자: ${developer})`
        }

        const docNodes: TreeNode[] = sorted.map(f => {
          const meta = f.doc_type ? DOC_TYPE_META[f.doc_type] : null
          return {
            name: meta?.label ?? f.path.split('/').pop() ?? f.path,
            path: f.path,
            type: 'file',
            file: f,
            nodeKind: meta?.kind,
          }
        })

        taskNodes.push({
          name: taskLabel,
          path: `__task__${projectName}__${slug}`,
          type: 'directory',
          nodeKind: 'task',
          logicalLabel: developer ?? undefined,
          issueUrl: issueUrl,
          children: docNodes,
        })
      })

      // Sort tasks alphabetically
      taskNodes.sort((a, b) => a.name.localeCompare(b.name))

      projectNodes.push({
        name: projectName,
        path: `__project__${projectName}`,
        type: 'directory',
        nodeKind: 'project',
        children: taskNodes,
      })
    })

    // Sort projects alphabetically
    projectNodes.sort((a, b) => a.name.localeCompare(b.name))

    // Build system knowledge subtree (preserves physical directory structure)
    let systemNode: TreeNode | null = null
    if (systemFiles.length > 0) {
      const sysRoot: TreeNode = {
        name: '🧠 공통 및 시스템 지식',
        path: '__system__',
        type: 'directory',
        nodeKind: 'system-root',
        children: [],
      }

      systemFiles.forEach(f => {
        const parts = f.path.split('/')
        let current = sysRoot

        parts.forEach((part, index) => {
          const isLast = index === parts.length - 1
          const pathKey = `__sysdir__${parts.slice(0, index + 1).join('/')}`

          if (isLast) {
            current.children = current.children || []
            current.children.push({ name: part, path: f.path, type: 'file', file: f, nodeKind: undefined })
          } else {
            current.children = current.children || []
            let dirNode = current.children.find(c => c.path === pathKey && c.type === 'directory')
            if (!dirNode) {
              dirNode = { name: part, path: pathKey, type: 'directory', nodeKind: 'system-dir', children: [] }
              current.children.push(dirNode)
            }
            current = dirNode
          }
        })
      })

      systemNode = sysRoot
    }

    const result: TreeNode[] = [...projectNodes]
    if (systemNode) result.push(systemNode)
    return result
  }, [data, searchTerm, projectFilter, userFilter, docTypeFilter, periodFilter])

  // Helper: file matches search
  function file_matches_search(f: DocumentFile, term: string): boolean {
    const lower = term.toLowerCase()
    return (
      f.path.toLowerCase().includes(lower) ||
      (f.project?.toLowerCase().includes(lower) ?? false) ||
      (f.slug?.toLowerCase().includes(lower) ?? false) ||
      (f.user?.toLowerCase().includes(lower) ?? false)
    )
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) { next.delete(path) } else { next.add(path) }
      return next
    })
  }


  // Wiki Link Click Routing
  const handleWikiLinkClick = (slug: string) => {
    const files = data?.files ?? []
    const matching = files.filter(f => f.slug === slug)
    if (matching.length === 0) return
    const orderFile = matching.find(f => f.doc_type === 'order')
    const targetFile = orderFile || matching[0]
    setSelectedFile(targetFile)
    addRecentDoc(targetFile)
    revealFileInTree(targetFile)
  }

  const handleSelectFile = (file: DocumentFile, forceOpen?: boolean) => {
    setSelectedFile(prev => {
      if (prev?.path === file.path && !forceOpen) {
        return null
      }
      addRecentDoc(file)
      return file
    })
  }

  // When viewMode changes, re-expand appropriate keys for selectedFile
  useEffect(() => {
    if (selectedFile) revealFileInTree(selectedFile)
  }, [viewMode])

  const activeTree = viewMode === 'project' ? projectTree : folderTree
  const ActiveTreeItem = viewMode === 'project' ? LogicalTreeItem : TreeItem

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
        <div className="max-w-md p-6 border border-rose-800/40 rounded-xl bg-rose-950/20 shadow-lg flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-rose-500" />
          <h2 className="text-lg font-bold text-rose-400">오류가 발생했습니다</h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'LLMWiki에 접근할 수 없습니다.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card/25 flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Wiki Browser
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {viewMode === 'project' ? '프로젝트 중심 지식 탐색' : 'PARA 폴더 구조 탐색'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Segmented Control & Graph Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/30 border border-border rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('project')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  viewMode === 'project'
                    ? 'bg-indigo-600/80 text-white shadow-sm shadow-indigo-900/40'
                    : 'text-muted-foreground hover:text-slate-200 hover:bg-muted/30'
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                <span>프로젝트 뷰</span>
              </button>
              <button
                onClick={() => setViewMode('folder')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  viewMode === 'folder'
                    ? 'bg-slate-600/80 text-white shadow-sm shadow-slate-900/40'
                    : 'text-muted-foreground hover:text-slate-200 hover:bg-muted/30'
                }`}
              >
                <FolderTree className="w-3 h-3" />
                <span>폴더 뷰</span>
              </button>
            </div>

            {/* 지식 그래프 ON/OFF Toggle Button */}
            <button
              onClick={() => setShowGraph(!showGraph)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 shadow-lg ${
                showGraph
                  ? 'bg-indigo-950/40 border-indigo-500/80 text-indigo-300 shadow-indigo-500/10'
                  : 'bg-muted/20 border-border text-muted-foreground hover:text-slate-200 hover:bg-muted/40'
              }`}
            >
              <Brain className={`w-3.5 h-3.5 ${showGraph ? 'animate-pulse text-indigo-400' : ''}`} />
              <span>지식 그래프</span>
              <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${showGraph ? 'bg-indigo-400 animate-ping' : 'bg-muted-foreground/45'}`} />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-9 px-3 text-xs bg-muted/40 hover:bg-muted border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
          {/* Sidebar Panel */}
          <ResizablePanel
            defaultSize={22}
            minSize={15}
            maxSize={35}
            className="flex flex-col border-r border-border bg-card/10 overflow-hidden h-full"
          >
            {/* Quick Search & Faceted Filters */}
            <div className="p-3 border-b border-border bg-card/30 flex-shrink-0 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={viewMode === 'project' ? '프로젝트·슬러그·담당자 검색...' : '문서명 및 경로 검색...'}
                  className="pl-8 h-9 text-xs bg-muted/20 border-border focus-visible:ring-indigo-500/50"
                />
              </div>
              
              {/* Faceted Filter Bar */}
              {data?.files && (
                <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                  {/* Project Filter */}
                  <select
                    value={projectFilter}
                    onChange={e => setProjectFilter(e.target.value)}
                    className="h-7 px-1.5 py-0.5 rounded text-[10px] bg-muted/25 border border-border text-slate-300 font-medium focus:outline-none focus:border-indigo-500/50 cursor-pointer min-w-0"
                  >
                    <option value="all" className="bg-[#0d1117] text-slate-300">전체 프로젝트</option>
                    {projects.map(p => (
                      <option key={p} value={p} className="bg-[#0d1117] text-slate-300">{p}</option>
                    ))}
                  </select>

                  {/* User Filter */}
                  <select
                    value={userFilter}
                    onChange={e => setUserFilter(e.target.value)}
                    className="h-7 px-1.5 py-0.5 rounded text-[10px] bg-muted/25 border border-border text-slate-300 font-medium focus:outline-none focus:border-indigo-500/50 cursor-pointer min-w-0"
                  >
                    <option value="all" className="bg-[#0d1117] text-slate-300">전체 담당자</option>
                    {users.map(u => (
                      <option key={u} value={u} className="bg-[#0d1117] text-slate-300">{u}</option>
                    ))}
                  </select>

                  {/* Document Type Filter */}
                  <select
                    value={docTypeFilter}
                    onChange={e => setDocTypeFilter(e.target.value)}
                    className="h-7 px-1.5 py-0.5 rounded text-[10px] bg-muted/25 border border-border text-slate-300 font-medium focus:outline-none focus:border-indigo-500/50 cursor-pointer min-w-0"
                  >
                    <option value="all" className="bg-[#0d1117] text-slate-300">모든 문서</option>
                    <option value="order" className="bg-[#0d1117] text-sky-400">작업계획서</option>
                    <option value="report" className="bg-[#0d1117] text-emerald-400">완료보고서</option>
                    <option value="knowledge" className="bg-[#0d1117] text-amber-400">지식문서</option>
                  </select>

                  {/* Period Filter */}
                  <select
                    value={periodFilter}
                    onChange={e => setPeriodFilter(e.target.value)}
                    className="h-7 px-1.5 py-0.5 rounded text-[10px] bg-muted/25 border border-border text-slate-300 font-medium focus:outline-none focus:border-indigo-500/50 cursor-pointer min-w-0"
                  >
                    <option value="all" className="bg-[#0d1117] text-slate-300">전체 기간</option>
                    <option value="1week" className="bg-[#0d1117] text-slate-300">최근 1주</option>
                    <option value="2weeks" className="bg-[#0d1117] text-slate-300">최근 2주</option>
                    <option value="1month" className="bg-[#0d1117] text-slate-300">최근 1달</option>
                    <option value="3months" className="bg-[#0d1117] text-slate-300">최근 3달</option>
                  </select>
                </div>
              )}
            </div>

            {/* Recent Visit Docs */}
            {recentDocs.length > 0 && !searchTerm && (
              <div className="p-3 border-b border-border/60 bg-muted/5 flex-shrink-0 space-y-1.5 select-none">
                <p className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  최근 방문 문서
                </p>
                <div className="flex flex-wrap gap-1">
                  {recentDocs.map(doc => {
                    const label = doc.slug || doc.path.split('/').pop() || doc.path
                    return (
                      <button
                        key={doc.path}
                        onClick={() => handleSelectFile(doc)}
                        className={`text-[10px] px-2 py-1 rounded bg-muted/30 border border-border hover:bg-indigo-900/10 hover:border-indigo-500/30 transition-all font-mono truncate max-w-[140px] ${
                          selectedFile?.path === doc.path ? 'bg-indigo-900/20 border-indigo-500/50 text-indigo-300' : 'text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tree Area */}
            <div className="flex-1 overflow-y-auto py-2">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-6 bg-muted/20 animate-pulse rounded" />
                  ))}
                </div>
              ) : activeTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <BookOpen className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs">
                    {searchTerm ? '검색 결과가 없습니다.' : '문서가 없거나 인덱싱이 필요합니다.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5 pr-2 pb-4">
                  {activeTree.map(node => (
                    <ActiveTreeItem
                      key={node.path}
                      node={node}
                      level={0}
                      expandedFolders={expandedFolders}
                      toggleFolder={toggleFolder}
                      selectedFile={selectedFile}
                      onSelectFile={handleSelectFile}
                    />
                  ))}
                </div>
              )}
            </div>
          </ResizablePanel>

          {/* 서브 사이드바와 메인 내용 간의 비율 조정 리사이저 */}
          <ResizableHandle withHandle className="bg-border/60 hover:bg-indigo-500/50 transition-colors" />

          {/* Right Content Area */}
          <ResizablePanel defaultSize={78} className="h-full overflow-hidden">
            <ResizablePanelGroup orientation="horizontal" className="h-full w-full bg-[#0a0f1d]">
              {/* Main Document Viewer or Empty State */}
              <ResizablePanel defaultSize={60} minSize={30} className="h-full overflow-hidden">
                {selectedFile ? (
                  <WikiViewer
                    file={selectedFile}
                    history={historyData ?? []}
                    onClose={() => setSelectedFile(null)}
                    onWikiLinkClick={handleWikiLinkClick}
                    onSearchHistoryClick={handleSearchHistoryClick}
                  />
                ) : (
                  /* Beautiful Glassmorphic Empty State */
                  <div className="h-full w-full flex items-center justify-center p-8 bg-[#0b1019] relative overflow-hidden">
                    {/* Background ambient glow */}
                    <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />

                    <div className="max-w-2xl w-full p-8 border border-border/40 rounded-2xl bg-card/15 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center relative z-10 space-y-6">
                      {/* Logo / Icon with Pulse */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
                        <div className="w-16 h-16 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center shadow-lg relative z-10">
                          <Brain className="w-8 h-8 text-indigo-400 animate-pulse" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h2 className="text-2xl font-black bg-gradient-to-r from-slate-100 via-indigo-200 to-slate-300 bg-clip-text text-transparent">
                          NAtlas 전사 지식 브라우저
                        </h2>
                        <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                          NAtlas는 NSoft America의 전사 지식 탐색기입니다. SwarmVault 제어, 작업계획서(order), 완료보고서(report), 지식문서(wiki) 간의 연계와 지식 흐름을 하나의 유기적인 인터페이스로 통합 제공합니다.
                        </p>
                      </div>

                      {/* Feature Cards Grid */}
                      <div className="grid grid-cols-2 gap-4 w-full text-left pt-4">
                        <div className="p-4 border border-border/40 rounded-xl bg-card/10 backdrop-blur-md hover:border-indigo-500/20 hover:bg-indigo-950/5 transition-all duration-200 space-y-1.5 cursor-pointer" onClick={() => setViewMode('project')}>
                          <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                            <FolderTree className="w-3.5 h-3.5" />
                            프로젝트 / 폴더 뷰 탐색
                          </h4>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            좌측 트리 사이드바를 통해 프로젝트 단위 및 실제 물리 폴더 구조(PARA) 단위로 문서를 자유롭게 선택하여 열람할 수 있습니다.
                          </p>
                        </div>

                        <div className="p-4 border border-border/40 rounded-xl bg-card/10 backdrop-blur-md hover:border-emerald-500/20 hover:bg-emerald-950/5 transition-all duration-200 space-y-1.5 cursor-pointer" onClick={() => setShowGraph(true)}>
                          <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                            <Brain className="w-3.5 h-3.5" />
                            지식 네트워크 그래프
                          </h4>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            문서와 작업 간의 계층적 연계 구조와 `[[wiki]]` 링크를 통한 지식의 흐름을 네트워크 노드 그래프 형태로 시각화하여 탐색을 돕습니다.
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-4 flex items-center justify-center gap-3">
                        <button
                          onClick={() => setShowGraph(true)}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2"
                        >
                          <Brain className="w-4 h-4 animate-bounce" />
                          지식 네트워크 그래프 탐색 시작
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </ResizablePanel>

              {/* Graph Panel (ResizablePanel, shown when showGraph) */}
              {showGraph && (
                <>
                  <ResizableHandle withHandle className="bg-border/60 hover:bg-indigo-500/50 transition-colors" />
                  <ResizablePanel defaultSize={40} minSize={20} maxSize={70} className="h-full flex flex-col bg-[#0b0e14]/98">
                    {/* Graph Panel Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/40 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-indigo-400 animate-pulse" />
                        <div>
                          <h3 className="text-xs font-bold text-slate-200">지식 네트워크 그래프</h3>
                          <p className="text-[10px] text-muted-foreground">프로젝트 클릭 → 태스크 → 문서 순으로 탐색</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowGraph(false)}
                        className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                        title="그래프 닫기"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Graph Content */}
                    <div className="flex-1 min-h-0 w-full p-3 bg-[#090d13]">
                      <WikiGraph
                        files={data?.files ?? []}
                        history={historyData ?? []}
                        onSelectFile={(file) => handleSelectFile(file, true)}
                      />
                    </div>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

export default Wiki
