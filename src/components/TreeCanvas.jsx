import { useState, useRef, useEffect, useCallback } from 'react'
import html2canvas from 'html2canvas'

const MIN_SCALE = 0.12
const MAX_SCALE = 3
const STEP = 0.12

export default function TreeCanvas({ children }) {
  const [transform, setTransform] = useState({ x: 60, y: 50, scale: 1 })
  const [dragging, setDragging] = useState(false)
  const [showHint, setShowHint] = useState(true)

  const containerRef = useRef(null)
  const innerRef = useRef(null)
  const transformRef = useRef(transform)
  const dragOrigin = useRef(null)
  const lastPinchDist = useRef(null)
  const hintTimer = useRef(null)

  // Keep ref in sync so event handlers always see the latest transform
  useEffect(() => { transformRef.current = transform }, [transform])

  // Hide hint after 4 s
  useEffect(() => {
    hintTimer.current = setTimeout(() => setShowHint(false), 4000)
    return () => clearTimeout(hintTimer.current)
  }, [])

  // Zoom toward point (cx, cy) in container coordinates
  const zoomAt = useCallback((cx, cy, delta) => {
    setTransform(prev => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + delta))
      const ratio = newScale / prev.scale
      return {
        scale: newScale,
        x: cx - ratio * (cx - prev.x),
        y: cy - ratio * (cy - prev.y),
      }
    })
  }, [])

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY > 0 ? -STEP : STEP)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [zoomAt])

  // Mouse drag
  function handleMouseDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    dragOrigin.current = {
      mx: e.clientX, my: e.clientY,
      tx: transformRef.current.x, ty: transformRef.current.y,
    }
  }
  function handleMouseMove(e) {
    if (!dragging || !dragOrigin.current) return
    setTransform(prev => ({
      ...prev,
      x: dragOrigin.current.tx + (e.clientX - dragOrigin.current.mx),
      y: dragOrigin.current.ty + (e.clientY - dragOrigin.current.my),
    }))
  }
  function stopDrag() { setDragging(false); dragOrigin.current = null }

  // Touch drag + pinch zoom — registered via addEventListener so we can use
  // { passive: false } on touchmove, which lets e.preventDefault() actually work.
  // React 17+ attaches synthetic touch listeners passively at the root, making
  // e.preventDefault() a no-op and allowing the browser to scroll the page.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e) {
      setShowHint(false)
      if (e.touches.length === 1) {
        dragOrigin.current = {
          mx: e.touches[0].clientX, my: e.touches[0].clientY,
          tx: transformRef.current.x, ty: transformRef.current.y,
        }
      }
      if (e.touches.length === 2) {
        dragOrigin.current = null
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist.current = Math.hypot(dx, dy)
      }
    }

    function onTouchMove(e) {
      e.preventDefault() // works because listener is { passive: false }
      if (e.touches.length === 1 && dragOrigin.current) {
        setTransform(prev => ({
          ...prev,
          x: dragOrigin.current.tx + (e.touches[0].clientX - dragOrigin.current.mx),
          y: dragOrigin.current.ty + (e.touches[0].clientY - dragOrigin.current.my),
        }))
      }
      if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const rect = el.getBoundingClientRect()
        const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left
        const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top
        zoomAt(cx, cy, (dist - lastPinchDist.current) * 0.007)
        lastPinchDist.current = dist
      }
    }

    function onTouchEnd() { dragOrigin.current = null; lastPinchDist.current = null }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [zoomAt])

  // Control buttons
  function zoomIn() {
    const el = containerRef.current
    if (!el) return
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, STEP)
  }
  function zoomOut() {
    const el = containerRef.current
    if (!el) return
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, -STEP)
  }
  function resetView() { setTransform({ x: 60, y: 50, scale: 1 }) }

  async function exportImage() {
    const inner = innerRef.current
    if (!inner) return

    const prev = transformRef.current

    // Reset transform to natural size for full-resolution capture
    inner.style.transform = 'translate(0px, 0px) scale(1)'
    await new Promise(r => requestAnimationFrame(r))

    const canvas = await html2canvas(inner, {
      backgroundColor: '#fdf8f3',
      scale: 2,
      useCORS: true,
      logging: false,
    })

    // Restore transform
    inner.style.transform = `translate(${prev.x}px, ${prev.y}px) scale(${prev.scale})`

    const link = document.createElement('a')
    link.download = `keluarga-buchori-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function fitView() {
    const container = containerRef.current
    const inner = innerRef.current
    if (!container || !inner) return
    const cur = transformRef.current
    const iRect = inner.getBoundingClientRect()
    const naturalW = iRect.width / cur.scale
    const naturalH = iRect.height / cur.scale
    const pad = 48
    const scaleX = (container.clientWidth - pad * 2) / naturalW
    const scaleY = (container.clientHeight - pad * 2) / naturalH
    const newScale = Math.min(scaleX, scaleY, 1.2)
    const x = (container.clientWidth - naturalW * newScale) / 2
    const y = Math.max(pad, (container.clientHeight - naturalH * newScale) / 2)
    setTransform({ x, y, scale: newScale })
  }

  return (
    <div
      ref={containerRef}
      className="tc-outer"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
    >
      {/* Transformed content */}
      <div
        ref={innerRef}
        className="tc-inner"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>

      {/* Zoom controls */}
      <div className="tc-controls" onMouseDown={e => e.stopPropagation()}>
        <button className="tc-btn" onClick={zoomIn} title="Zoom in">+</button>
        <span className="tc-zoom-pct">{Math.round(transform.scale * 100)}%</span>
        <button className="tc-btn" onClick={zoomOut} title="Zoom out">−</button>
        <div className="tc-divider" />
        <button className="tc-btn" onClick={fitView} title="Fit to view">⊡</button>
        <button className="tc-btn" onClick={resetView} title="Reset view">⟳</button>
        <div className="tc-divider" />
        <button className="tc-btn tc-btn-export" onClick={exportImage} title="Simpan sebagai gambar">📷</button>
      </div>

      {/* Interaction hint */}
      <div className={`tc-hint ${showHint ? 'visible' : ''}`}>
        <span className="tc-hint-desktop">🖱 Drag to pan · Scroll to zoom</span>
        <span className="tc-hint-mobile">👆 Drag to pan · Pinch to zoom</span>
      </div>
    </div>
  )
}
