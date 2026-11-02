/** Browsers may return null or throw when Canvas is disabled or resources are lost. */
export function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    const context = canvas.getContext('2d')
    return context?.isContextLost?.() ? null : context
  } catch { return null }
}
