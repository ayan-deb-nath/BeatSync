import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'
import { FullscreenController } from './FullscreenController'

export function useFullscreen(targetRef: RefObject<HTMLElement | null>) {
  const [controller] = useState(() => new FullscreenController(() => targetRef.current, document))
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  useEffect(() => controller.connect(), [controller])
  return { ...state, toggle: controller.toggle }
}

export type FullscreenControls = ReturnType<typeof useFullscreen>
