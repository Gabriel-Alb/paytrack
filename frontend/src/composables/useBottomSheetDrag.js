import { computed, onBeforeUnmount, ref } from 'vue'

export function useBottomSheetDrag() {
  const dragY = ref(0)
  const dragging = ref(false)
  const dismissing = ref(false)

  let dragStartY = 0
  let lastY = 0
  let lastTime = 0
  let velocity = 0
  let pointerId = null
  let dragTarget = null
  let closeHandler = null
  let resetTimer = null

  const panelStyle = computed(() => {
    if (!dragging.value && !dismissing.value && dragY.value === 0) {
      return {}
    }

    return {
      transform: `translate3d(0, ${dragY.value}px, 0)`,
    }
  })

  const backdropStyle = computed(() => {
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800

    const progress = Math.min(dragY.value / (viewportHeight * 0.45), 1)

    return {
      backgroundColor: `rgba(0, 0, 0, ${0.3 * (1 - progress)})`,
    }
  })

  function isMobile() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  }

  function releasePointer() {
    if (!dragTarget || pointerId === null) {
      return
    }

    try {
      if (dragTarget.hasPointerCapture?.(pointerId)) {
        dragTarget.releasePointerCapture(pointerId)
      }
    } catch {
      return
    }
  }

  function resetDrag() {
    if (resetTimer) {
      clearTimeout(resetTimer)
      resetTimer = null
    }

    dragY.value = 0
    dragging.value = false
    dismissing.value = false

    dragStartY = 0
    lastY = 0
    lastTime = 0
    velocity = 0
    pointerId = null
    dragTarget = null
    closeHandler = null
  }

  function startDrag(event, onClose) {
    if (!isMobile() || dismissing.value) {
      return
    }

    dragging.value = true
    closeHandler = onClose

    pointerId = event.pointerId
    dragTarget = event.currentTarget

    dragStartY = event.clientY
    lastY = event.clientY
    lastTime = performance.now()
    velocity = 0

    dragTarget.setPointerCapture?.(event.pointerId)
  }

  function moveDrag(event) {
    if (!dragging.value) {
      return
    }

    const now = performance.now()
    const deltaY = event.clientY - dragStartY

    const elapsed = now - lastTime

    if (elapsed > 0) {
      velocity = (event.clientY - lastY) / elapsed
    }

    lastY = event.clientY
    lastTime = now

    if (deltaY <= 0) {
      dragY.value = Math.max(-10, deltaY * 0.08)

      return
    }

    dragY.value = deltaY
  }

  function endDrag(event) {
    if (!dragging.value) {
      return
    }

    const now = performance.now()

    const finalDistance = Math.max(0, event.clientY - dragStartY)

    const elapsed = now - lastTime

    if (elapsed > 0 && elapsed < 80) {
      velocity = (event.clientY - lastY) / elapsed
    }

    dragY.value = finalDistance

    releasePointer()

    dragging.value = false

    const viewportHeight = window.innerHeight

    const closeDistance = Math.min(150, viewportHeight * 0.2)

    const fastSwipe = finalDistance >= 40 && velocity >= 0.65

    const shouldClose = finalDistance >= closeDistance || fastSwipe

    if (!shouldClose) {
      dragY.value = 0
      closeHandler = null
      dragTarget = null
      pointerId = null

      return
    }

    dismissing.value = true

    const handler = closeHandler

    dragY.value = viewportHeight

    resetTimer = setTimeout(() => {
      handler?.()

      resetTimer = setTimeout(() => {
        resetDrag()
      }, 20)
    }, 190)
  }

  function cancelDrag() {
    if (!dragging.value) {
      return
    }

    releasePointer()

    dragging.value = false
    dragY.value = 0

    pointerId = null
    dragTarget = null
    closeHandler = null
  }

  onBeforeUnmount(() => {
    if (resetTimer) {
      clearTimeout(resetTimer)
    }

    releasePointer()
  })

  return {
    dragY,
    dragging,
    dismissing,
    panelStyle,
    backdropStyle,
    startDrag,
    moveDrag,
    endDrag,
    cancelDrag,
    resetDrag,
  }
}
