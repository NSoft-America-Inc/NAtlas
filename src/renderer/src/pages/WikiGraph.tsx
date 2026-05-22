import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { DocumentFile, TaskHistoryItem } from '@renderer/lib/types'
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, HelpCircle, Pause, Play } from 'lucide-react'

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
  issueUrl?: string | null
}

interface GraphEdge {
  source: string
  target: string
  type: 'hierarchy' | 'wiki-link'
}

interface WikiGraphProps {
  files: DocumentFile[]
  history: TaskHistoryItem[]
  onSelectFile: (file: DocumentFile, forceOpen?: boolean) => void
}

export function WikiGraph({ files, history, onSelectFile }: WikiGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationRef = useRef<number | null>(null)

  const [zoom, setZoom] = useState<number>(0.85)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [showHelp, setShowHelp] = useState<boolean>(false)
  const [isSimPaused, setIsSimPaused] = useState<boolean>(false)

  // Depth expansion
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  // 포커스된 프로젝트 (선택 시 다른 프로젝트 숨김)
  const [focusedProject, setFocusedProject] = useState<string | null>(null)
  const focusedProjectRef = useRef<string | null>(null)

  // HTML 오버레이 툴팁 (프로젝트 호버)
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    projectId: string;
    name: string;
    taskCount: number;
    orderCount: number;
    reportCount: number;
    wikiCount: number;
    recentTasks: string[];
  } | null>(null)

  // Physics alpha decay
  const alphaRef = useRef<number>(1.0)
  const isSimPausedRef = useRef<boolean>(false)
  const expandedNodesRef = useRef<Set<string>>(new Set())

  const isDraggingCanvas = useRef<boolean>(false)
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragStartPos = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 })
  const activeDragNode = useRef<GraphNode | null>(null)
  const hoveredNodeRef = useRef<GraphNode | null>(null)

  // ── 1. 전체 노드·엣지 데이터셋 빌드 (파일이 바뀔 때만 재계산) ──
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    const nodeMap = new Map<string, GraphNode>()
    const childrenMap = new Map<string, string[]>()   // parentId → [childId, ...]
    const parentMap = new Map<string, string>()        // childId → parentId

    const projectSet = new Set<string>()
    const taskMap = new Map<string, { project: string; slug: string; user: string; title?: string }>()
    const slugToFileMap = new Map<string, DocumentFile>()

    files.forEach(f => {
      if (f.slug) slugToFileMap.set(f.slug, f)
      if (f.category === 'Logs' && f.project && f.slug) {
        projectSet.add(f.project)
        const taskKey = `${f.project}__${f.slug}`
        if (!taskMap.has(taskKey) || (f.doc_type === 'order' && f.title)) {
          taskMap.set(taskKey, { project: f.project, slug: f.slug, user: f.user ?? 'developer', title: f.title ?? undefined })
        }
      }
    })

    const searchCountMap = new Map<string, number>()
    history.forEach(h => {
      if (h.task_slug) searchCountMap.set(h.task_slug, (searchCountMap.get(h.task_slug) ?? 0) + 1)
    })
    const projectSearchCountMap = new Map<string, number>()
    const slugToProject = new Map<string, string>()
    files.forEach(f => { if (f.slug && f.project) slugToProject.set(f.slug, f.project) })
    history.forEach(h => {
      const p = h.project || (h.task_slug ? slugToProject.get(h.task_slug) : null)
      if (p) projectSearchCountMap.set(p, (projectSearchCountMap.get(p) ?? 0) + 1)
    })

    const W = 800, H = 600

    // A. Project 노드 — 원형 배치
    const projectArr = Array.from(projectSet)
    projectArr.forEach((p, pi) => {
      const id = `project:${p}`
      const pSearchCount = projectSearchCountMap.get(p) ?? 0
      const radius = 20 + Math.min(12, pSearchCount * 2.0)
      const angle = (pi / projectArr.length) * 2 * Math.PI
      const dist = Math.min(W, H) * 0.28

      const node: GraphNode = {
        id, label: p, type: 'project',
        x: W / 2 + Math.cos(angle) * dist,
        y: H / 2 + Math.sin(angle) * dist,
        vx: 0, vy: 0, radius,
        color: '#6366f1',
        glowColor: `rgba(99, 102, 241, ${Math.min(0.9, 0.45 + pSearchCount * 0.12)})`
      }
      nodes.push(node)
      nodeMap.set(id, node)
      childrenMap.set(id, [])
    })

    // B. Task 노드 — 초기 위치는 부모 근처
    taskMap.forEach((t, key) => {
      const id = `task:${key}`
      const pId = `project:${t.project}`
      const parent = nodeMap.get(pId)
      const searchCount = searchCountMap.get(t.slug) ?? 0
      const radius = 13 + Math.min(9, searchCount * 2.5)
      const taskLabel = t.title ? `[${t.slug.split('-').slice(0,2).join('-')}] ${t.title}` : t.slug

      const taskFiles = files.filter(f => f.category === 'Logs' && f.project === t.project && f.slug === t.slug)
      const issueUrl = taskFiles.find(f => f.doc_type === 'order')?.issue_url || taskFiles.find(f => f.issue_url)?.issue_url || null

      const node: GraphNode = {
        id, label: taskLabel, type: 'task',
        x: (parent?.x ?? W / 2) + (Math.random() - 0.5) * 60,
        y: (parent?.y ?? H / 2) + (Math.random() - 0.5) * 60,
        vx: 0, vy: 0, radius,
        color: '#f59e0b',
        glowColor: `rgba(245, 158, 11, ${Math.min(0.85, 0.35 + searchCount * 0.15)})`,
        issueUrl
      }
      nodes.push(node)
      nodeMap.set(id, node)
      childrenMap.set(id, [])

      if (nodeMap.has(pId)) {
        edges.push({ source: pId, target: id, type: 'hierarchy' })
        childrenMap.get(pId)!.push(id)
        parentMap.set(id, pId)
      }
    })

    // C. Document 노드
    files.forEach(f => {
      const isLogs = f.category === 'Logs' && f.project && f.slug
      const id = `doc:${f.path}`

      let color = '#38bdf8', glow = 'rgba(56, 189, 248, 0.3)'
      if (f.doc_type === 'order')     { color = '#0ea5e9'; glow = 'rgba(14, 165, 233, 0.35)' }
      else if (f.doc_type === 'report')    { color = '#10b981'; glow = 'rgba(16, 185, 129, 0.35)' }
      else if (f.doc_type === 'knowledge') { color = '#f43f5e'; glow = 'rgba(244, 63, 94, 0.4)' }

      let parentId: string | null = null
      if (isLogs) {
        const taskKey = `${f.project}__${f.slug}`
        parentId = `task:${taskKey}`
      }

      const parentNode = parentId ? nodeMap.get(parentId) : null
      const node: GraphNode = {
        id,
        label: f.title || (f.path.split('/').pop() ?? f.path),
        type: 'document',
        docType: f.doc_type,
        file: f,
        x: (parentNode?.x ?? W / 2) + (Math.random() - 0.5) * 40,
        y: (parentNode?.y ?? H / 2) + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0, radius: 8,
        color, glowColor: glow,
        issueUrl: f.issue_url || null
      }
      nodes.push(node)
      nodeMap.set(id, node)

      if (parentId && nodeMap.has(parentId)) {
        edges.push({ source: parentId, target: id, type: 'hierarchy' })
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
        childrenMap.get(parentId)!.push(id)
        parentMap.set(id, parentId)
      }
    })

    // D. 공통/시스템 지식
    const systemFiles = files.filter(f => !(f.category === 'Logs' && f.project && f.slug))
    if (systemFiles.length > 0) {
      const sysRootId = 'system:root'
      const sysRootNode: GraphNode = {
        id: sysRootId, label: '🧠 공통 및 시스템 지식', type: 'project',
        x: W / 2 - 250, y: H / 2 + 150,
        vx: 0, vy: 0, radius: 15,
        color: '#a855f7', glowColor: 'rgba(168, 85, 247, 0.4)'
      }
      nodes.push(sysRootNode)
      nodeMap.set(sysRootId, sysRootNode)
      childrenMap.set(sysRootId, [])

      systemFiles.forEach(f => {
        const id = `doc:${f.path}`
        if (nodeMap.has(id)) {
          edges.push({ source: sysRootId, target: id, type: 'hierarchy' })
          childrenMap.get(sysRootId)!.push(id)
          parentMap.set(id, sysRootId)
        }
      })
    }

    // E. Wiki Link 연결선
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
      if (order && report) edges.push({ source: `doc:${order.path}`, target: `doc:${report.path}`, type: 'wiki-link' })
      if (report && knowledge) edges.push({ source: `doc:${report.path}`, target: `doc:${knowledge.path}`, type: 'wiki-link' })
    })

    // F. 프로젝트별 통계 (툴팁용)
    const projectStats = new Map<string, {
      taskCount: number; orderCount: number; reportCount: number; wikiCount: number; recentTasks: string[]
    }>()
    const projectSet2 = new Set(nodes.filter(n => n.type === 'project').map(n => n.label))
    projectSet2.forEach(p => {
      const pFiles = files.filter(f => f.category === 'Logs' && f.project === p)
      const slugSet = new Set(pFiles.map(f => f.slug).filter(Boolean))
      const recentTasks = Array.from(
        new Map(pFiles.filter(f => f.doc_type === 'order' && f.title)
          .map(f => [f.slug, f.title!])).values()
      ).slice(0, 4)
      projectStats.set(`project:${p}`, {
        taskCount: slugSet.size,
        orderCount: pFiles.filter(f => f.doc_type === 'order').length,
        reportCount: pFiles.filter(f => f.doc_type === 'report').length,
        wikiCount: pFiles.filter(f => f.doc_type === 'knowledge').length,
        recentTasks
      })
    })

    return { nodes, edges, nodeMap, childrenMap, parentMap, projectStats }
  }, [files, history])

  // ── 2. 보이는 노드/엣지 계산 ──
  const visibleData = useMemo(() => {
    const { nodes, edges, childrenMap, parentMap } = graphData
    const expanded = expandedNodesRef.current
    const focused = focusedProjectRef.current

    const visibleIds = new Set<string>()

    if (focused) {
      // 포커스 모드: 선택된 프로젝트만 표시
      visibleIds.add(focused)
    } else {
      // 기본: 모든 프로젝트 표시
      nodes.forEach(n => { if (n.type === 'project') visibleIds.add(n.id) })
    }

    // 확장된 노드의 자식 표시 (재귀)
    const addChildren = (parentId: string) => {
      const children = childrenMap.get(parentId) ?? []
      children.forEach(childId => {
        visibleIds.add(childId)
        if (expanded.has(childId)) addChildren(childId)
      })
    }
    expanded.forEach(id => addChildren(id))

    const visibleNodes = nodes.filter(n => visibleIds.has(n.id))
    const visibleNodeSet = new Set(visibleNodes.map(n => n.id))
    const visibleEdges = edges.filter(e =>
      visibleNodeSet.has(e.source) && visibleNodeSet.has(e.target)
    )

    const expandableIds = new Set<string>()
    nodes.forEach(n => {
      if ((n.type === 'project' || n.type === 'task') && (childrenMap.get(n.id)?.length ?? 0) > 0) {
        expandableIds.add(n.id)
      }
    })

    return { visibleNodes, visibleEdges, visibleNodeSet, expandableIds, parentMap }
  }, [graphData, expandedNodes, focusedProject])

  // ── 3. 물리 시뮬레이션 & Canvas 렌더링 루프 ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = canvas.width = containerRef.current?.clientWidth ?? 800
    let height = canvas.height = containerRef.current?.clientHeight ?? 500

    const resizeObserver = new ResizeObserver(() => {
      if (canvas && containerRef.current) {
        width = canvas.width = containerRef.current.clientWidth
        height = canvas.height = containerRef.current.clientHeight
      }
    })
    if (containerRef.current) resizeObserver.observe(containerRef.current)
    window.addEventListener('resize', () => {
      if (canvas && containerRef.current) {
        width = canvas.width = containerRef.current.clientWidth
        height = canvas.height = containerRef.current.clientHeight
      }
    })

    const tickPhysics = () => {
      const { visibleNodes, visibleEdges } = visibleData
      const alpha = alphaRef.current
      const kRepulsion = 130 * alpha
      const kAttraction = 0.06 * alpha
      const gravity = 0.018 * alpha
      const friction = 0.86

      visibleNodes.forEach(node => {
        if (node === activeDragNode.current) return
        node.vx += (width / 2 - node.x) * gravity
        node.vy += (height / 2 - node.y) * gravity
      })

      for (let i = 0; i < visibleNodes.length; i++) {
        const nodeA = visibleNodes[i]
        for (let j = i + 1; j < visibleNodes.length; j++) {
          const nodeB = visibleNodes[j]
          const dx = nodeB.x - nodeA.x
          const dy = nodeB.y - nodeA.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1.0
          if (dist < 300) {
            const force = (kRepulsion * (nodeA.radius + nodeB.radius)) / (dist * dist)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            if (nodeA !== activeDragNode.current) { nodeA.vx -= fx; nodeA.vy -= fy }
            if (nodeB !== activeDragNode.current) { nodeB.vx += fx; nodeB.vy += fy }
          }
        }
      }

      visibleEdges.forEach(edge => {
        const sNode = graphData.nodeMap.get(edge.source)
        const tNode = graphData.nodeMap.get(edge.target)
        if (!sNode || !tNode) return
        const dx = tNode.x - sNode.x
        const dy = tNode.y - sNode.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1.0
        const targetDist = edge.type === 'wiki-link' ? 120 : 70
        const strength = edge.type === 'wiki-link' ? kAttraction * 0.4 : kAttraction
        const force = (dist - targetDist) * strength
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        if (sNode !== activeDragNode.current) { sNode.vx += fx; sNode.vy += fy }
        if (tNode !== activeDragNode.current) { tNode.vx -= fx; tNode.vy -= fy }
      })

      visibleNodes.forEach(node => {
        if (node === activeDragNode.current) return
        node.vx *= friction; node.vy *= friction
        node.x += node.vx; node.y += node.vy
        node.x = Math.max(60, Math.min(width - 60, node.x))
        node.y = Math.max(60, Math.min(height - 60, node.y))
      })

      alphaRef.current = Math.max(0, alphaRef.current - 0.007)
    }

    const draw = () => {
      const { visibleNodes, visibleEdges, expandableIds } = visibleData
      ctx.clearRect(0, 0, width, height)
      ctx.save()
      ctx.translate(pan.x, pan.y)
      ctx.scale(zoom, zoom)

      // 1. Edges
      visibleEdges.forEach(edge => {
        const s = graphData.nodeMap.get(edge.source)
        const t = graphData.nodeMap.get(edge.target)
        if (!s || !t) return
        const isHovered = hoveredNodeRef.current && (hoveredNodeRef.current.id === s.id || hoveredNodeRef.current.id === t.id)
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        if (edge.type === 'wiki-link') {
          ctx.strokeStyle = isHovered ? '#6366f1' : 'rgba(99, 102, 241, 0.25)'
          ctx.lineWidth = isHovered ? 2 : 1.2
          ctx.setLineDash([4, 4])
        } else {
          ctx.strokeStyle = isHovered ? '#475569' : 'rgba(71, 85, 105, 0.18)'
          ctx.lineWidth = isHovered ? 1.8 : 1
          ctx.setLineDash([])
        }
        ctx.stroke()
        ctx.setLineDash([])
      })

      // 2. Nodes
      visibleNodes.forEach(node => {
        const isHovered = hoveredNodeRef.current?.id === node.id
        const isExpanded = expandedNodesRef.current.has(node.id)
        const isExpandable = expandableIds.has(node.id)

        ctx.shadowColor = node.glowColor
        ctx.shadowBlur = isHovered ? 22 : 8
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + (isHovered ? 2 : 0), 0, Math.PI * 2)
        ctx.fillStyle = node.color
        ctx.fill()
        ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.18)'
        ctx.lineWidth = isHovered ? 2 : 1
        ctx.stroke()
        ctx.shadowBlur = 0

        // 확장 가능 표시: 오른쪽 하단에 +/- 배지
        if (isExpandable) {
          const bx = node.x + node.radius * 0.72
          const by = node.y - node.radius * 0.72
          ctx.beginPath()
          ctx.arc(bx, by, 5.5, 0, Math.PI * 2)
          ctx.fillStyle = isExpanded ? 'rgba(99,102,241,0.9)' : 'rgba(30,30,60,0.92)'
          ctx.fill()
          ctx.strokeStyle = isExpanded ? '#a5b4fc' : '#6366f1'
          ctx.lineWidth = 1.2
          ctx.stroke()
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 8px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(isExpanded ? '−' : '+', bx, by)
          ctx.textAlign = 'left'
          ctx.textBaseline = 'alphabetic'
        }

        // 자식 개수 표시 (미확장 상태에서)
        if (isExpandable && !isExpanded) {
          const cnt = graphData.childrenMap.get(node.id)?.length ?? 0
          if (cnt > 0) {
            ctx.font = '9px monospace'
            ctx.fillStyle = 'rgba(148,163,184,0.6)'
            ctx.fillText(`${cnt}`, node.x + node.radius + 5, node.y + 4)
          }
        }

        // 노드 레이블
        ctx.font = node.type === 'project' ? 'bold 11px sans-serif' : '10px monospace'
        ctx.fillStyle = node.type === 'project' ? '#e2e8f0' : node.type === 'task' ? '#cbd5e1' : '#94a3b8'
        const maxLen = node.type === 'project' ? 22 : node.type === 'task' ? 30 : 26
        const label = node.label.length > maxLen ? node.label.slice(0, maxLen) + '…' : node.label
        const textWidth = ctx.measureText(label).width
        ctx.fillText(label, node.x - textWidth / 2, node.y - node.radius - 6)
      })

      ctx.restore()
    }

    const tick = () => {
      if (!isSimPausedRef.current && alphaRef.current > 0.005) tickPhysics()
      draw()
      animationRef.current = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      resizeObserver.disconnect()
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [graphData, visibleData, zoom, pan])

  // ── 4. 마우스 조작 ──
  const getTransformedCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    }
  }

  const findNodeAt = (x: number, y: number): GraphNode | null => {
    for (const node of visibleData.visibleNodes) {
      if (Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2) < node.radius + 8) return node
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getTransformedCoords(e.clientX, e.clientY)
    dragStartPos.current = { clientX: e.clientX, clientY: e.clientY }
    const hitNode = findNodeAt(x, y)
    if (hitNode) {
      activeDragNode.current = hitNode
      canvasRef.current!.style.cursor = 'grabbing'
      alphaRef.current = Math.max(alphaRef.current, 0.4)
    } else {
      isDraggingCanvas.current = true
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      canvasRef.current!.style.cursor = 'move'
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getTransformedCoords(e.clientX, e.clientY)
    if (activeDragNode.current) {
      activeDragNode.current.x = x
      activeDragNode.current.y = y
      activeDragNode.current.vx = 0
      activeDragNode.current.vy = 0
      return
    }
    if (isDraggingCanvas.current) {
      setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
      return
    }
    const foundHover = findNodeAt(x, y)
    if (foundHover !== hoveredNodeRef.current) {
      hoveredNodeRef.current = foundHover
      canvasRef.current!.style.cursor = foundHover ? 'pointer' : 'default'

      // 프로젝트 노드 호버 시 툴팁 표시
      if (foundHover?.type === 'project') {
        const stats = graphData.projectStats.get(foundHover.id)
        if (stats) {
          // 캔버스 좌표 → 화면 좌표
          const canvas = canvasRef.current!
          const rect = canvas.getBoundingClientRect()
          const screenX = foundHover.x * zoom + pan.x + rect.left
          const screenY = foundHover.y * zoom + pan.y + rect.top
          setTooltip({
            x: screenX + foundHover.radius * zoom + 10,
            y: screenY - 20,
            projectId: foundHover.id,
            name: foundHover.label,
            ...stats
          })
        }
      } else {
        setTooltip(null)
      }
    }
  }

  const handleMouseUp = (e?: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeDragNode.current && e) {
      const node = activeDragNode.current
      const dx = e.clientX - dragStartPos.current.clientX
      const dy = e.clientY - dragStartPos.current.clientY
      const dragDist = Math.sqrt(dx * dx + dy * dy)

      if (dragDist < 5) {
        if (node.type === 'document' && node.file) {
          onSelectFile(node.file, true)
        } else if (node.type === 'project') {
          // 프로젝트 클릭: 포커스 + 확장
          const nodeId = node.id
          const canvas = canvasRef.current
          const isAlreadyFocused = focusedProjectRef.current === nodeId

          if (isAlreadyFocused) {
            // 이미 포커스된 프로젝트 재클릭 → 접기
            setExpandedNodes(prev => {
              const next = new Set(prev)
              const collapse = (id: string) => { next.delete(id); (graphData.childrenMap.get(id) ?? []).forEach(collapse) }
              collapse(nodeId)
              expandedNodesRef.current = next
              return next
            })
            setFocusedProject(null)
            focusedProjectRef.current = null
          } else {
            // 포커스 설정 + 확장
            setFocusedProject(nodeId)
            focusedProjectRef.current = nodeId

            setExpandedNodes(prev => {
              const next = new Set(prev)
              next.add(nodeId)
              const children = graphData.childrenMap.get(nodeId) ?? []
              const parent = graphData.nodeMap.get(nodeId)
              if (parent && children.length > 0 && canvas) {
                children.forEach((childId, i) => {
                  const child = graphData.nodeMap.get(childId)
                  if (child) {
                    const angle = (i / children.length) * 2 * Math.PI - Math.PI / 2
                    child.x = parent.x + Math.cos(angle) * 150
                    child.y = parent.y + Math.sin(angle) * 150
                    child.vx = 0; child.vy = 0
                  }
                })
              }
              expandedNodesRef.current = next
              return next
            })
            alphaRef.current = 0.8
          }
          setTooltip(null)
        } else if (node.type === 'task') {
          // 태스크 클릭: 확장/축소
          const nodeId = node.id
          const canvas = canvasRef.current
          setExpandedNodes(prev => {
            const next = new Set(prev)
            if (next.has(nodeId)) {
              const collapse = (id: string) => { next.delete(id); (graphData.childrenMap.get(id) ?? []).forEach(collapse) }
              collapse(nodeId)
            } else {
              next.add(nodeId)
              const children = graphData.childrenMap.get(nodeId) ?? []
              const parent = graphData.nodeMap.get(nodeId)
              if (parent && children.length > 0 && canvas) {
                children.forEach((childId, i) => {
                  const child = graphData.nodeMap.get(childId)
                  if (child) {
                    const angle = (i / children.length) * 2 * Math.PI - Math.PI / 2
                    child.x = parent.x + Math.cos(angle) * 80
                    child.y = parent.y + Math.sin(angle) * 80
                    child.vx = 0; child.vy = 0
                  }
                })
              }
              alphaRef.current = 0.6
            }
            expandedNodesRef.current = next
            return next
          })
        }
      }
    }
    activeDragNode.current = null
    isDraggingCanvas.current = false
    if (canvasRef.current) canvasRef.current.style.cursor = hoveredNodeRef.current ? 'pointer' : 'default'
  }

  // ── Ref 동기화 ──
  useEffect(() => { isSimPausedRef.current = isSimPaused }, [isSimPaused])
  useEffect(() => { expandedNodesRef.current = expandedNodes }, [expandedNodes])
  useEffect(() => { focusedProjectRef.current = focusedProject }, [focusedProject])

  const handleZoom = (factor: number) => setZoom(prev => Math.min(2.5, Math.max(0.25, prev * factor)))

  const toggleSimulation = () => {
    setIsSimPaused(prev => {
      if (prev) alphaRef.current = 0.6 // 재개 시 재가열
      return !prev
    })
  }

  const resetView = useCallback(() => {
    setZoom(0.85)
    setPan({ x: 0, y: 0 })
    setExpandedNodes(new Set())
    expandedNodesRef.current = new Set()
    setFocusedProject(null)
    focusedProjectRef.current = null
    setTooltip(null)
    const canvas = canvasRef.current
    if (canvas) {
      const W = canvas.width, H = canvas.height
      const projects = graphData.nodes.filter(n => n.type === 'project')
      projects.forEach((node, pi) => {
        const angle = (pi / projects.length) * 2 * Math.PI
        node.x = W / 2 + Math.cos(angle) * Math.min(W, H) * 0.28
        node.y = H / 2 + Math.sin(angle) * Math.min(W, H) * 0.28
        node.vx = 0; node.vy = 0
      })
    }
    alphaRef.current = 1.0
    setIsSimPaused(false)
  }, [graphData])

  // 마우스 휠 줌
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    handleZoom(e.deltaY < 0 ? 1.1 : 0.9)
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[420px] bg-[#090d13] border border-border/80 rounded-xl overflow-hidden shadow-2xl flex-1 ${
        isFullscreen ? 'fixed inset-4 z-50 bg-[#090d13]/95 border-indigo-500/50' : ''
      }`}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full block"
      />

      {/* 컨트롤 패널 */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 p-1 bg-card/65 border border-border backdrop-blur-md rounded-lg shadow-xl select-none z-10">
        <button onClick={() => handleZoom(1.15)} title="확대" className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => handleZoom(0.85)} title="축소" className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-border/60 mx-0.5" />
        <button
          onClick={toggleSimulation}
          title={isSimPaused ? '물리 재개' : '노드 고정'}
          className={`p-2 rounded transition-all ${isSimPaused ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'}`}
        >
          {isSimPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        </button>
        <div className="w-px h-4 bg-border/60 mx-0.5" />
        <button onClick={resetView} title="초기화 (전체 접기)" className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? '창 모드' : '전체화면'} className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all">
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-indigo-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setShowHelp(!showHelp)} title="도움말" className="p-2 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* 범례 */}
      <div className="absolute top-4 left-4 p-3 bg-card/50 border border-border/60 backdrop-blur-md rounded-lg text-[10px] text-muted-foreground space-y-1.5 shadow-lg select-none z-10 pointer-events-none">
        <p className="font-bold text-slate-200 border-b border-border/30 pb-1 mb-1 tracking-wider uppercase">지식 범례</p>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] inline-block" /><span>💼 Project</span></div>
        <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] inline-block" /><span>📁 Task Slug</span></div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#0ea5e9] inline-block" /><span>📋 작업계획서</span></div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#10b981] inline-block" /><span>✅ 완료보고서</span></div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#f43f5e] inline-block" /><span>🧠 지식 자산</span></div>
        <div className="flex items-center gap-3 mt-1 border-t border-border/30 pt-1.5 text-indigo-400">
          <span className="inline-block border-b border-dashed border-indigo-500/80 w-5 h-0" />
          <span>[[wiki]] 연계</span>
        </div>
        <div className="border-t border-border/30 pt-1.5 text-[9px] text-slate-500 space-y-0.5">
          <p>● 클릭: 확장/축소 (+숫자=자식수)</p>
          <p>● 문서 클릭: 문서 열기</p>
        </div>
      </div>

      {/* ── 상위 레이어로 돌아가기 버튼 (포커스/확장 상태일 때) ── */}
      {(focusedProject !== null || expandedNodes.size > 0) && (
        <button
          onClick={resetView}
          className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-2 bg-[#0d1527]/90 border border-indigo-500/40 backdrop-blur-md rounded-lg text-[11px] text-indigo-300 font-medium hover:bg-indigo-500/15 hover:border-indigo-500/60 transition-all select-none z-10 shadow-lg"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
          {focusedProject
            ? `전체 프로젝트로 돌아가기`
            : '전체 초기화'}
        </button>
      )}

      {/* 물리 정지 배지 */}
      {isSimPaused && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/15 border border-indigo-500/30 rounded-lg text-[10px] text-indigo-300 font-medium select-none z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
          고정됨
        </div>
      )}

      {/* ── 프로젝트 호버 툴팁 ── */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="bg-[#0d1527]/96 border border-indigo-500/35 backdrop-blur-xl rounded-xl shadow-2xl p-3.5 w-56 space-y-2.5">
            {/* 프로젝트 이름 */}
            <div className="flex items-center gap-2 border-b border-border/40 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] flex-shrink-0 shadow-sm shadow-indigo-500/50" />
              <span className="text-xs font-bold text-slate-100 truncate">{tooltip.name}</span>
            </div>
            {/* 통계 그리드 */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex flex-col items-center p-2 rounded-lg bg-amber-500/8 border border-amber-500/15">
                <span className="text-lg font-black text-amber-400 leading-none">{tooltip.taskCount}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">태스크</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-sky-500/8 border border-sky-500/15">
                <span className="text-lg font-black text-sky-400 leading-none">{tooltip.orderCount}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">작업계획서</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
                <span className="text-lg font-black text-emerald-400 leading-none">{tooltip.reportCount}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">완료보고서</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-rose-500/8 border border-rose-500/15">
                <span className="text-lg font-black text-rose-400 leading-none">{tooltip.wikiCount}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">지식 wiki</span>
              </div>
            </div>
            {/* 최근 태스크 */}
            {tooltip.recentTasks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">최근 태스크</p>
                {tooltip.recentTasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400/60 flex-shrink-0 mt-1.5" />
                    <span className="text-[10px] text-slate-300 leading-snug line-clamp-1">{t}</span>
                  </div>
                ))}
              </div>
            )}
            {/* 힌트 */}
            <p className="text-[9px] text-indigo-400/70 border-t border-border/30 pt-1.5">클릭하면 이 프로젝트만 집중 탐색</p>
          </div>
        </div>
      )}

      {/* 도움말 */}
      {showHelp && (
        <div className="absolute top-16 right-4 p-4 bg-[#0d1527]/95 border border-indigo-500/40 backdrop-blur-lg rounded-lg text-[11px] text-slate-300 w-64 shadow-2xl z-20 space-y-2">
          <p className="font-bold text-indigo-300">💡 조작법</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed">
            <li><b>프로젝트 클릭</b>: 하위 태스크 펼치기/접기</li>
            <li><b>태스크 클릭</b>: 하위 문서 펼치기/접기</li>
            <li><b>문서 클릭</b>: 문서 뷰어에서 열기</li>
            <li><b>노드 드래그</b>: 위치 재조정</li>
            <li><b>빈 공간 드래그</b>: 화면 이동(패닝)</li>
            <li><b>마우스 휠</b>: 확대/축소</li>
            <li><b>⏸ 버튼</b>: 노드 움직임 고정</li>
            <li><b>🔄 버튼</b>: 전체 초기화</li>
          </ul>
        </div>
      )}
    </div>
  )
}
