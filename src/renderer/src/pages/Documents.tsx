import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@renderer/lib/api'
import { DocumentsResponse } from '@renderer/lib/types'
import { StatusBadge } from '@renderer/components/StatusBadge'
import { useUIStore } from '@renderer/store/ui'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@renderer/components/ui/table'
import { Search, RefreshCw, AlertCircle } from 'lucide-react'

export function Documents() {
  const { setActiveTab } = useUIStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'indexed' | 'modified' | 'new'>('all')

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DocumentsResponse>({
    queryKey: ['documents'],
    queryFn: api.getDocuments,
    refetchInterval: 30_000,
  })

  // Client-side search and status filter
  const filteredFiles = data?.files.filter((file) => {
    const matchesSearch = file.path.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' ? true : file.status === statusFilter
    return matchesSearch && matchesStatus
  }) || []

  // Helper to format ISO date to relative string or readable form
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMins < 1) return '방금 전'
      if (diffMins < 60) return `${diffMins}분 전`
      if (diffHours < 24) return `${diffHours}시간 전`
      if (diffDays < 7) return `${diffDays}일 전`
      
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return isoString
    }
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
        <div className="max-w-md p-6 border border-rose-800/40 rounded-xl bg-rose-950/20 shadow-lg flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
          <h2 className="text-lg font-bold text-rose-400">오류가 발생했습니다</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {error instanceof Error ? error.message : 'LLMWiki 경로를 찾을 수 없습니다.'}
            <br />
            Settings 탭에서 LLMWiki 루트 경로를 올바르게 설정해주세요.
          </p>
          <Button
            onClick={() => setActiveTab('settings')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all duration-300"
          >
            Settings 탭으로 이동
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background select-text">
      {/* Header Panel */}
      <div className="px-6 py-5 border-b border-border bg-card/25 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Documents
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              LLMWiki content 파일 및 인덱싱 상태를 실시간 모니터링합니다. (30초 자동 갱신)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
            className="h-9 px-3 text-xs bg-muted/40 hover:bg-muted text-foreground border-border hover:border-muted-foreground/30 transition-all duration-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        {/* Filter and Search controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground select-none pointer-events-none" />
            <Input
              type="text"
              placeholder="파일 경로로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/20 border-border focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-muted/20 border border-border p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
            {(['all', 'indexed', 'modified', 'new'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${
                  statusFilter === filter
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {filter === 'all'
                  ? '전체'
                  : filter === 'indexed'
                  ? '인덱싱됨'
                  : filter === 'modified'
                  ? '수정됨'
                  : '미인덱싱'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="border border-border rounded-xl overflow-hidden bg-card/10 shadow-sm">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[120px]">상태</TableHead>
                  <TableHead>경로</TableHead>
                  <TableHead className="w-[150px] text-right">수정일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx} className="hover:bg-transparent">
                    <TableCell>
                      <div className="h-6 w-20 bg-muted/60 animate-pulse rounded" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-3/4 bg-muted/60 animate-pulse rounded" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="h-4 w-16 ml-auto bg-muted/60 animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl bg-card/5">
            <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">조건에 맞는 파일이 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              검색 필터 조건을 다시 확인하시거나 Settings 탭에서 LLMWiki 폴더 경로를 확인해 보세요.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card/10 shadow-sm">
            <Table>
              <TableHeader className="bg-muted/30 select-none">
                <TableRow className="border-b border-border">
                  <TableHead className="w-[120px] font-semibold text-muted-foreground">상태</TableHead>
                  <TableHead className="font-semibold text-muted-foreground">경로</TableHead>
                  <TableHead className="w-[150px] text-right font-semibold text-muted-foreground">수정일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiles.map((file, idx) => (
                  <TableRow key={idx} className="border-b border-border/60 hover:bg-muted/20 transition-colors duration-150">
                    <TableCell className="py-3">
                      <StatusBadge status={file.status} />
                    </TableCell>
                    <TableCell className="font-medium text-xs break-all py-3 font-mono text-slate-200">
                      {file.path}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground py-3 select-none">
                      {formatTime(file.modified_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Summary Footer bar */}
      {data?.summary && (
        <div className="px-6 py-3 border-t border-border bg-card/35 flex items-center justify-between text-xs select-none">
          <div className="text-muted-foreground font-semibold">
            총 <span className="text-foreground font-bold">{data.summary.total}</span>개 파일
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-emerald-400 font-bold">{data.summary.indexed}</span>
              <span className="text-muted-foreground">인덱싱됨</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-amber-400 font-bold">{data.summary.modified}</span>
              <span className="text-muted-foreground">수정됨</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-rose-400 font-bold">{data.summary.new}</span>
              <span className="text-muted-foreground">미인덱싱</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Documents
