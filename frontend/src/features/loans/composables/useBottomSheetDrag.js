import { computed, ref } from 'vue'

export function useBottomSheetDrag(onClose) {
  const dragOffset = ref(0)
  const isDragging = ref(false)

  let startY = 0

  const isMobile = () => window.matchMedia('(max-width: 639px)').matches

  const sheetStyle = computed(() => ({
    transform: `translateY(${dragOffset.value}px)`,
    transition: isDragging.value ? 'none' : 'transform 220ms ease',
  }))

  const handlePointerMove = (event) => {
    if (!isDragging.value) {
      return
    }

    dragOffset.value = Math.max(0, event.clientY - startY)
  }

  const finishDrag = () => {
    if (!isDragging.value) {
      return
    }

    isDragging.value = false

    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', finishDrag)

    if (dragOffset.value >= 110) {
      dragOffset.value = 0
      onClose()
      return
    }

    dragOffset.value = 0
  }

  const startDrag = (event) => {
    if (!isMobile()) {
      return
    }

    startY = event.clientY
    isDragging.value = true

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDrag)
  }

  return {
    sheetStyle,
    startDrag,
  }
}
