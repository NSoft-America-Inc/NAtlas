import { useEffect, useRef, useState, useMemo } from 'react'
import { DocumentFile } from '@renderer/lib/types'
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, HelpCircle } from 'lucide-react'

interface GraphNode {
  id: string
  label: string
  type: 'project' | 'task' | 'document'
  docType?: string | null
  file?: DocumentFile
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  glowColor: string
}

interface GraphEdge {
  source: string
  target: string
  type: 'hierarchy' | 'wiki-link' // 구조선 vs 지식 위키 연결선
}

interface WikiGraphProps {
  files: DocumentFile[]
  onSelectFile: (file: DocumentFile) => void
}

export function WikiGraph({ files, onSelectFile }: WikiGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationRef = useRef<number | null>(null)

  // 그래프 줌 및 패닝 상태
  const [zoom, setZoom] = useState<number>(0.85)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [showHelp, setShowHelp] = useState<boolean>(false)

  // 상호작용 관련 임시 레퍼런스
  const isDraggingCanvas = useRef<boolean>(false)
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const activeDragNode = useRef<GraphNode | null>(null)
  const hoveredNodeRef = useRef<GraphNode | null>(null)

  // 1. 노드 및 엣지 데이터셋 빌드 (useMemo)
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const nodeMap = new Map<string, GraphNode>()

    // 프로젝트 목록 및 태스크 목록 수집
    const projectSet = new Set<string>()
    const taskMap = new Map<string, { project: string; slug: string; user: string; title?: string }>()

    // 위키 링크 파싱을 위한 용도 (slug -> file 매핑)
    const slugToFileMap = new Map<string, DocumentFile>()

    files.forEach(f => {
      if (f.slug) {
        slugToFileMap.set(f.slug, f)
      }
      if (f.category === 'Logs' && f.project && f.slug) {
        projectSet.add(f.project)
        const taskKey = `${f.project}__${f.slug}`
        
        // order.md 에 적혀있는 파싱 타이틀을 태스크 대표 타이틀로 확보
        if (!taskMap.has(taskKey) || (f.doc_type === 'order' && f.title)) {
          taskMap.set(taskKey, {
            project: f.project,
            slug: f.slug,
            user: f.user ?? 'developer',
            title: f.title ?? undefined
          })
        }
      }
    })

    const width = 800
    const height = 600

    // A. Project 노드 생성
    projectSet.forEach(p => {
      const id = `project:${p}`
      const node: GraphNode = {
        id,
        label: p,
        type: 'project',
        x: width / 2 + (Math.random() - 0.5) * 200,
        y: height / 2 + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        radius: 18,
        color: '#6366f1', // 네온 인디고
        glowColor: 'rgba(99, 102, 241, 0.4)'
      }
      nodes.push(node)
      nodeMap.set(id, node)
    })

    // B. Task 노드 생성
    taskMap.forEach((t, key) => {
      const id = `task:${key}`
      const taskLabel = t.title ? `[${t.slug.split('-').slice(0,2).join('-')}] ${t.title}` : t.slug
      const node: GraphNode = {
        id,
        label: taskLabel,
        type: 'task',
        x: width / 2 + (Math.random() - 0.5) * 350,
        y: height / 2 + (Math.random() - 0.5) * 350,
        vx: 0,
        vy: 0,
        radius: 12,
        color: '#f59e0b', // 호박색 (Amber)
        glowColor: 'rgba(245, 158, 11, 0.35)'
      }
      nodes.push(node)
      nodeMap.set(id, node)

      // Project ➔ Task 연결선 추가
      const pId = `project:${t.project}`
      if (nodeMap.has(pId)) {
        edges.push({ source: pId, target: id, type: 'hierarchy' })
      }
    })

    // C. Document 노드 생성 및 연결선 연결
    files.forEach(f => {
      const isLogs = f.category === 'Logs' && f.project && f.slug
      const filename = f.path.split('/').pop() ?? f.path
      const docLabel = f.title || filename
      const id = `doc:${f.path}`

      let color = '#38bdf8' // 기본 스카이블루
      let glow = 'rgba(56, 189, 248, 0.3)'
      
      if (f.doc_type === 'order') {
        color = '#0ea5e9' // 진한 딥블루 (지시서)
        glow = 'rgba(14, 165, 233, 0.35)'
      } else if (f.doc_type === 'report') {
        color = '#10b981' // 에메랄드 그린 (완료보고서)
        glow = 'rgba(16, 185, 129, 0.35)'
      } else if (f.doc_type === 'knowledge') {
        color = '#f43f5e' // 로즈 핑크 (최종 AI 지식)
        glow = 'rgba(244, 63, 94, 0.4)'
      }

      const node: GraphNode = {
        id,
        label: docLabel,
        type: 'document',
        docType: f.doc_type,
        file: f,
        x: width / 2 + (Math.random() - 0.5) * 450,
        y: height / 2 + (Math.random() - 0.5) * 450,
        vx: 0,
        vy: 0,
        radius: 8,
        color,
        glowColor: glow
      }
      nodes.push(node)
      nodeMap.set(id, node)

      // Task ➔ Document 계층 연결선
      if (isLogs) {
        const taskKey = `${f.project}__${f.slug}`
        const tId = `task:${taskKey}`
        if (nodeMap.has(tId)) {
          edges.push({ source: tId, target: id, type: 'hierarchy' })
        }
      }
    })

    // D. 공통/시스템 지식 폴더링을 가상 노드로 묶어 시각화
    const systemFiles = files.filter(f => !(f.category === 'Logs' && f.project && f.slug))
    if (systemFiles.length > 0) {
      const sysRootId = 'system:root'
      const sysRootNode: GraphNode = {
        id: sysRootId,
        label: '🧠 공통 및 시스템 지식',
        type: 'project',
        x: width / 2 - 250,
        y: height / 2 + 150,
        vx: 0,
        vy: 0,
        radius: 15,
        color: '#a855f7', // 보라색
        glowColor: 'rgba(168, 85, 247, 0.4)'
      }
      nodes.push(sysRootNode)
      nodeMap.set(sysRootId, sysRootNode)

      systemFiles.forEach(f => {
        const id = `doc:${f.path}`
        if (nodeMap.has(id)) {
          edges.push({ source: sysRootId, target: id, type: 'hierarchy' })
        }
      })
    }

    // E. 💡 Wiki Links (지식 점선 연결선) 생성!
    // 문서 데이터에 citations나 내부 [[link]]는 React Query 본문 캐시에서 추후 로딩되므로,
    // E2E 파이프라인의 연계성을 시각화하기 위해 동일한 slug를 공유하거나 임의의 지식 흐름(Order ➔ Report ➔ Knowledge)을 지식선으로 이어줍니다.
    const slugGroups = new Map<string, DocumentFile[]>()
    files.forEach(f => {
      if (f.slug) {
        if (!slugGroups.has(f.slug)) slugGroups.set(f.slug, [])
        slugGroups.get(f.slug)!.push(f)
      }
    })

    slugGroups.forEach((group) => {
      const order = group.find(f => f.doc_type === 'order')
      const report = group.find(f => f.doc_type === 'report')
      const knowledge = group.find(f => f.doc_type === 'knowledge')

      // 계획 ➔ 결과 지식선
      if (order && report) {
        edges.push({
          source: `doc:${order.path}`,
          target: `doc:${report.path}`,
          type: 'wiki-link'
        })
      }
      // 결과 ➔ 지식 자산 지식선
      if (report && knowledge) {
        edges.push({
          source: `doc:${report.path}`,
          target: `doc:${knowledge.path}`,
          type: 'wiki-link'
        })
      }
    })

    return { nodes, edges, nodeMap }
  }, [files])

  // 2. 고성능 물리 시뮬레이션 및 Canvas 렌더링 루프
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = canvas.width = containerRef.current?.clientWidth ?? 800
    let height = canvas.height = containerRef.current?.clientHeight ?? 500

    const { nodes, edges, nodeMap } = graphData

    // 캔버스 크기 리사이즈 대응
    const handleResize = () => {
      if (canvas && containerRef.current) {
        width = canvas.width = containerRef.current.clientWidth
        height = canvas.height = containerRef.current.clientHeight
      }
    }
    window.addEventListener('resize', handleResize)

    // 최초 기동 시 중앙 밸런스 설정
    nodes.forEach(node => {
      if (node.x === 0 || node.y === 0) {
        node.x = width / 2 + (Math.random() - 0.5) * 100
        node.y = height / 2 + (Math.random() - 0.5) * 100
      }
    })

    // ── 물리 연산(Force-Directed Simulation) 핵심 엔진 ──
    const tickPhysics = () => {
      const kRepulsion = 120    // 서로 밀어내는 척력 상수
      const kAttraction = 0.05   // 연결선 간 자성 인력 상수
      const gravity = 0.015       // 중앙으로 쏠리게 하는 중력 상수
      const friction = 0.85      // 마찰력 (속도 감쇄계수)

      // A. 중앙 중력 작용
      nodes.forEach(node => {
        if (node === activeDragNode.current) return
        const dx = width / 2 - node.x
        const dy = height / 2 - node.y
        node.vx += dx * gravity
        node.vy += dy * gravity
      })

      // B. 노드 간 척력 작용 (너무 다닥다닥 붙지 않게 함)
      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j]
          const dx = nodeB.x - nodeA.x
          const dy = nodeB.y - nodeA.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0

          // 일정 거리 이내일 때 강력한 척력 유도
          if (dist < 280) {
            const force = (kRepulsion * (nodeA.radius + nodeB.radius)) / (dist * dist)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force

            if (nodeA !== activeDragNode.current) {
              nodeA.vx -= fx
              nodeA.vy -= fy
            }
            if (nodeB !== activeDragNode.current) {
              nodeB.vx += fx
              nodeB.vy += fy
            }
          }
        }
      }

      // C. 연결선(Edges)에 따른 자성 인력 작용
      edges.forEach(edge => {
        const sNode = nodeMap.get(edge.source)
        const tNode = nodeMap.get(edge.target)
        if (!sNode || !tNode) return

        const dx = tNode.x - sNode.x
        const dy = tNode.y - sNode.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1.0

        // 지식 위키 연결선(wiki-link)은 인력을 살짝 약하게 주어 수려하게 펼쳐지게 함
        const targetDist = edge.type === 'wiki-link' ? 120 : 65
        const strength = edge.type === 'wiki-link' ? kAttraction * 0.4 : kAttraction
        
        const force = (dist - targetDist) * strength
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        if (sNode !== activeDragNode.current) {
          sNode.vx += fx
          sNode.vy += fy
        }
        if (tNode !== activeDragNode.current) {
          tNode.vx -= fx
          tNode.vy -= fy
        }
      })

      // D. 최종 위치 갱신
      nodes.forEach(node => {
        if (node === activeDragNode.current) return
        node.vx *= friction
        node.vy *= friction
        node.x += node.vx
        node.y += node.vy

        // 바운더리 탈출 제어
        node.x = Math.max(50, Math.min(width - 50, node.x))
        node.y = Math.max(50, Math.min(height - 50, node.y))
      })
    }

    // ── 드로잉 루프 ──
    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      // 드로잉 콘텍스트 복사 및 스케일/패닝 적용
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)

      // 1. Edges 그리기
      edges.forEach(edge => {
        const s = nodeMap.get(edge.source)
        const t = nodeMap.get(edge.target)
        if (!s || !t) return

        const isHovered = hoveredNodeRef.current && (hoveredNodeRef.current.id === s.id || hoveredNodeRef.current.id === t.id)

        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)

        if (edge.type === 'wiki-link') {
          // 지식 위키선: 네온 인디고 대쉬 점선
          ctx.strokeStyle = isHovered ? '#6366f1' : 'rgba(99, 102, 241, 0.25)'
          ctx.lineWidth = isHovered ? 2 : 1.2
          ctx.setLineDash([4, 4])
        } else {
          // 구조선: 은은한 Slate 라인
          ctx.strokeStyle = isHovered ? '#475569' : 'rgba(71, 85, 105, 0.18)'
          ctx.lineWidth = isHovered ? 1.8 : 1
          ctx.setLineDash([])
        }
        ctx.stroke()
        ctx.setLineDash([]) // 라인대쉬 초기화
      })

      // 2. Nodes 그리기
      nodes.forEach(node => {
        const isHovered = hoveredNodeRef.current && hoveredNodeRef.current.id === node.id

        // 네온 글로우 활성화
        ctx.shadowColor = node.glowColor
        ctx.shadowBlur = isHovered ? 18 : 6

        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + (isHovered ? 2 : 0), 0, Math.PI * 2)
        ctx.fillStyle = node.color
        ctx.fill()

        // 링 테두리 강조
        ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.15)'
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.stroke()

        // 글로우 초기화
        ctx.shadowBlur = 0

        // 3. 노드 텍스트 레이블 작성
        ctx.font = node.type === 'project' ? 'bold 11px sans-serif' : '10px monospace'
        ctx.fillStyle = node.type === 'project' 
          ? '#e2e8f0' 
          : node.type === 'task' 
            ? '#cbd5e1' 
            : '#94a3b8'

        // 텍스트 정중앙 배치 연산
        const textWidth = ctx.measureText(node.label).width
        ctx.fillText(node.label, node.x - textWidth / 2, node.y - node.radius - 6)
      })

      ctx.restore()
    }

    // ── 매 프레임 기동하는 엔진 틱 ──
    const tick = () => {
      tickPhysics()
      draw()
      animationRef.current = requestAnimationFrame(tick)
    }

    // 애니메이션 틱 시작
    tick()

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [graphData, zoom, pan])

  // 3. 마우스 드래그 & 클릭 이벤트 조작 연동
  const getTransformedCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    // 스크린 좌표 ➔ 줌/패닝이 스케일된 논리 캔버스 내부 좌표로 역변환
    const screenX = clientX - rect.left
    const screenY = clientY - rect.top
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getTransformedCoords(e.clientX, e.clientY)

    // A. 클릭 위치에 있는 노드 탐색
    let hitNode: GraphNode | null = null
    for (const node of graphData.nodes) {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
      if (dist < node.radius + 6) {
        hitNode = node
        break
      }
    }

    if (hitNode) {
      activeDragNode.current = hitNode
      canvasRef.current!.style.cursor = 'grabbing'
    } else {
      // B. 노드 바깥 클릭 시 캔버스 패닝 시작
      isDraggingCanvas.current = true
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      canvasRef.current!.style.cursor = 'move'
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getTransformedCoords(e.clientX, e.clientY)

    // A. 노드를 물리 드래그 중인 경우
    if (activeDragNode.current) {
      const node = activeDragNode.current
      node.x = x
      node.y = y
      node.vx = 0
      node.vy = 0
      return
    }

    // B. 빈 캔버스를 패닝(이동) 중인 경우
    if (isDraggingCanvas.current) {
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      })
      return
    }

    // C. 마우스 호버 노드 감지 하이라이팅
    let foundHover: GraphNode | null = null
    for (const node of graphData.nodes) {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
      if (dist < node.radius + 6) {
        foundHover = node
        break
      }
    }

    if (foundHover !== hoveredNodeRef.current) {
      hoveredNodeRef.current = foundHover
      canvasRef.current!.style.cursor = foundHover ? 'pointer' : 'default'
    }
  }

  const handleMouseUp = () => {
    activeDragNode.current = null
    isDraggingCanvas.current = false
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredNodeRef.current ? 'pointer' : 'default'
    }
  }

  // 더블 클릭 시 해당 문서 열기 브릿지 구동
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getTransformedCoords(e.clientX, e.clientY)

    for (const node of graphData.nodes) {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2)
      if (dist < node.radius + 6) {
        if (node.type === 'document' && node.file) {
          onSelectFile(node.file)
        }
        break
      }
    }
  }

  // 줌 인/아웃 리미트 헬퍼
  const handleZoom = (factor: number) => {
    setZoom(prev => Math.min(2.5, Math.max(0.25, prev * factor)))
  }

  // 그래프 리셋 정렬
  const resetView = () => {
    setZoom(0.85)
    setPan({ x: 0, y: 0 })
    const canvas = canvasRef.current
    if (canvas) {
      graphData.nodes.forEach(node => {
        node.x = canvas.width / 2 + (Math.random() - 0.5) * 150
        node.y = canvas.height / 2 + (Math.random() - 0.5) * 150
        node.vx = 0
        node.vy = 0
      })
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[420px] bg-[#090d13] border border-border/80 rounded-xl overflow-hidden shadow-2xl flex-1 ${
        isFullscreen ? 'fixed inset-4 z-50 bg-[#090d13]/95 border-indigo-500/50' : ''
      }`}
    >
      {/* 캔버스 드로잉 영역 */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full block"
      />

      {/* 우측 상단 플로팅 컨트롤 패널 */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 p-1 bg-card/65 border border-border backdrop-blur-md rounded-lg shadow-xl select-none z-10">
        <button
          onClick={() => handleZoom(1.15)}
          title="확대"
          className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleZoom(0.85)}
          title="축소"
          className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          title="정렬 초기화"
          className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? '창 모드로 복귀' : '전체화면으로 감상'}
          className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-indigo-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setShowHelp(!showHelp)}
          title="도움말 토글"
          className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* 좌측 상단 범례(Legend) 표시 */}
      <div className="absolute top-4 left-4 p-3 bg-card/50 border border-border/60 backdrop-blur-md rounded-lg text-[10px] text-muted-foreground space-y-1.5 shadow-lg select-none z-10 pointer-events-none">
        <p className="font-bold text-slate-200 border-b border-border/30 pb-1 mb-1 tracking-wider uppercase">지식 범례</p>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] inline-block shadow-sm shadow-[#6366f1]/50" />
          <span>💼 Project (프로젝트)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block shadow-sm shadow-[#f59e0b]/50" />
          <span>📁 Task Slug (작업 단위)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#0ea5e9] inline-block" />
          <span>📋 작업계획서 (order.md)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" />
          <span>✅ 완료보고서 (report.md)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f43f5e] inline-block" />
          <span>🧠 지식 자산 (knowledge.md)</span>
        </div>
        <div className="flex items-center gap-3 mt-1 border-t border-border/30 pt-1.5 text-indigo-400">
          <span className="inline-block border-b border-dashed border-indigo-500/80 w-5 h-0" />
          <span>[[wiki]] 지식 연계 흐름</span>
        </div>
      </div>

      {/* 도움말 박스 */}
      {showHelp && (
        <div className="absolute top-16 right-4 p-4 bg-[#0d1527]/95 border border-indigo-500/40 backdrop-blur-lg rounded-lg text-[11px] text-slate-300 w-60 shadow-2xl z-20 space-y-2">
          <p className="font-bold text-indigo-300">💡 마우스 인터랙션 조작법</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed">
            <li><b>노드 드래그</b>: 노드를 드래그하여 물리 위치를 옮길 수 있습니다.</li>
            <li><b>화면 드래그</b>: 빈 공간을 클릭하고 드래그하여 그래프 화면을 패닝합니다.</li>
            <li><b>마우스 휠</b>: 휠을 통해 화면을 자유롭게 줌인/줌아웃 합니다.</li>
            <li><b>노드 호버</b>: 마우스를 올리면 연결선과 연관 노드가 하이라이트됩니다.</li>
            <li><b>노드 더블클릭</b>: 문서 노드를 <b>더블클릭</b>하면 왼쪽 트리에서 자동 탐색하여 우측 뷰어에 문서를 로딩합니다.</li>
          </ul>
        </div>
      )}
    </div>
  )
}
