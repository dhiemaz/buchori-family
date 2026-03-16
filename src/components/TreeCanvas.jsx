import { useState, useRef, useEffect, useCallback } from 'react'
import html2canvas from 'html2canvas'

const MIN_SCALE = 0.12
const MAX_SCALE = 3
const STEP = 0.12
const INITIAL = { x: 60, y: 50, scale: 1 }

export default function TreeCanvas({ children }) {
  // displayScale is the ONLY React state for the transform — used solely for
  // the zoom-% label. The actual CSS transform is written directly to the DOM
  // via applyTransform() so that every touchmove frame is applied instantly
  // without triggering a React re-render, which caused blank-white flashes on
  // real mobile devices.
  const [displayScale, setDisplayScale] = useState(INITIAL.scale)
  const [dragging,     setDragging]     = useState(false)
  const [showHint,     setShowHint]     = useState(true)

  const containerRef  = useRef(null)
  const innerRef      = useRef(null)
  const tRef          = useRef({ ...INITIAL })  // live source of truth (no stale-closure risk)
  const dragOrigin    = useRef(null)
  const lastPinchDist = useRef(null)
  const hintTimer     = useRef(null)

  // Write transform directly to the DOM element — zero React re-render.
  const applyTransform = useCallback((t) => {
    tRef.current = t
    if (innerRef.current) {
      innerRef.current.style.transform =
        `translate(${t.x}px, ${t.y}px) scale(${t.scale})`
    }
  }, [])

  // Apply initial transform on mount.
  useEffect(() => { applyTransform(INITIAL) }, [applyTransform])

  // Hide hint after 4 s.
  useEffect(() => {
    hintTimer.current = setTimeout(() => setShowHint(false), 4000)
    return () => clearTimeout(hintTimer.current)
  }, [])

  // Zoom toward point (cx, cy) in container coordinates.
  // syncState=true → also update the zoom-% label (for non-touch interactions).
  const zoomAt = useCallback((cx, cy, delta, syncState = false) => {
    const prev     = tRef.current
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale + delta))
    const ratio    = newScale / prev.scale
    const t = {
      scale: newScale,
      x: cx - ratio * (cx - prev.x),
      y: cy - ratio * (cy - prev.y),
    }
    applyTransform(t)
    if (syncState) setDisplayScale(newScale)
  }, [applyTransform])

  // Mouse-wheel zoom.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY > 0 ? -STEP : STEP, true)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [zoomAt])

  // Mouse drag.
  function handleMouseDown(e) {
    if (e.button !== 0) return
    e.preventDefault()
    setDragging(true)
    dragOrigin.current = {
      mx: e.clientX, my: e.clientY,
      tx: tRef.current.x, ty: tRef.current.y,
    }
  }
  function handleMouseMove(e) {
    if (!dragging || !dragOrigin.current) return
    applyTransform({
      ...tRef.current,
      x: dragOrigin.current.tx + (e.clientX - dragOrigin.current.mx),
      y: dragOrigin.current.ty + (e.clientY - dragOrigin.current.my),
    })
  }
  function stopDrag() { setDragging(false); dragOrigin.current = null }

  // Touch drag + pinch zoom — registered via addEventListener (not React props)
  // so we can pass { passive: false } on touchstart/touchmove and call
  // e.preventDefault() to stop any browser scroll gesture.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e) {
      setShowHint(false)
      // Prevent the browser from committing to a scroll gesture at touchstart.
      // Skip interactive elements so taps still produce click events.
      if (!e.target.closest('button, a, input, select, textarea')) {
        e.preventDefault()
      }
      if (e.touches.length === 1) {
        dragOrigin.current = {
          mx: e.touches[0].clientX, my: e.touches[0].clientY,
          tx: tRef.current.x,       ty: tRef.current.y,
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
      e.preventDefault()  // works because listener is { passive: false }

      if (e.touches.length === 1 && dragOrigin.current) {
        // Direct DOM write — ZERO React re-renders during drag.
        applyTransform({
          ...tRef.current,
          x: dragOrigin.current.tx + (e.touches[0].clientX - dragOrigin.current.mx),
          y: dragOrigin.current.ty + (e.touches[0].clientY - dragOrigin.current.my),
        })
      }

      if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const dx   = e.touches[0].clientX - e.touches[1].clientX
        const dy   = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const rect = el.getBoundingClientRect()
        const cx   = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left
        const cy   = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top
        zoomAt(cx, cy, (dist - lastPinchDist.current) * 0.007)
        lastPinchDist.current = dist
      }
    }

    // Sync zoom-% label once per gesture (not on every frame).
    // Also handles touchcancel (OS takes over — e.g. incoming call).
    function onGestureEnd() {
      setDisplayScale(tRef.current.scale)
      dragOrigin.current    = null
      lastPinchDist.current = null
    }

    el.addEventListener('touchstart',  onTouchStart,  { passive: false })
    el.addEventListener('touchmove',   onTouchMove,   { passive: false })
    el.addEventListener('touchend',    onGestureEnd)
    el.addEventListener('touchcancel', onGestureEnd)
    return () => {
      el.removeEventListener('touchstart',  onTouchStart)
      el.removeEventListener('touchmove',   onTouchMove)
      el.removeEventListener('touchend',    onGestureEnd)
      el.removeEventListener('touchcancel', onGestureEnd)
    }
  }, [zoomAt, applyTransform])

  // Control buttons.
  function doZoomIn() {
    const el = containerRef.current
    if (!el) return
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, STEP, true)
  }
  function doZoomOut() {
    const el = containerRef.current
    if (!el) return
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, -STEP, true)
  }
  function resetView() {
    applyTransform(INITIAL)
    setDisplayScale(INITIAL.scale)
  }

  async function exportImage() {
    const inner = innerRef.current
    if (!inner) return

    const prev = { ...tRef.current }

    // Reset to natural size for full-resolution capture.
    inner.style.transform = 'translate(0px, 0px) scale(1)'
    await new Promise(r => requestAnimationFrame(r))

    // html2canvas ignores object-fit: cover — pre-crop each avatar image.
    const swapped = []
    inner.querySelectorAll('.card-avatar-img').forEach(img => {
      if (!img.complete || !img.naturalWidth) return
      const size      = img.offsetWidth * 2
      const offscreen = document.createElement('canvas')
      offscreen.width  = size
      offscreen.height = size
      const ctx = offscreen.getContext('2d')
      const nw = img.naturalWidth, nh = img.naturalHeight
      const scale = Math.max(size / nw, size / nh)
      const dw = nw * scale, dh = nh * scale
      ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
      swapped.push({ img, src: img.src })
      img.src = offscreen.toDataURL('image/jpeg', 0.95)
    })
    if (swapped.length) await new Promise(r => requestAnimationFrame(r))

    const canvas = await html2canvas(inner, {
      backgroundColor: '#fdf8f3',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 0,
      logging: false,
    })

    swapped.forEach(({ img, src }) => { img.src = src })
    applyTransform(prev)

    const link = document.createElement('a')
    link.download = `keluarga-buchori-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function fitView() {
    const container = containerRef.current
    const inner     = innerRef.current
    if (!container || !inner) return
    const cur      = tRef.current
    const iRect    = inner.getBoundingClientRect()
    const naturalW = iRect.width  / cur.scale
    const naturalH = iRect.height / cur.scale
    const pad      = 48
    const scaleX   = (container.clientWidth  - pad * 2) / naturalW
    const scaleY   = (container.clientHeight - pad * 2) / naturalH
    const newScale = Math.min(scaleX, scaleY, 1.2)
    const x = (container.clientWidth  - naturalW * newScale) / 2
    const y = Math.max(pad, (container.clientHeight - naturalH * newScale) / 2)
    const t = { x, y, scale: newScale }
    applyTransform(t)
    setDisplayScale(newScale)
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
      {/* Transform is managed entirely via applyTransform() → direct DOM write.
          React never touches the transform style, so drag never triggers a re-render. */}
      <div ref={innerRef} className="tc-inner">
        {children}
      </div>

      {/* Zoom controls */}
      <div className="tc-controls" onMouseDown={e => e.stopPropagation()}>
        <button className="tc-btn" onClick={doZoomIn}  title="Zoom in">+</button>
        <span className="tc-zoom-pct">{Math.round(displayScale * 100)}%</span>
        <button className="tc-btn" onClick={doZoomOut} title="Zoom out">−</button>
        <div className="tc-divider" />
        <button className="tc-btn" onClick={fitView}   title="Fit to view">⊡</button>
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
