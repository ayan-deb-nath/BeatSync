import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FullscreenController } from '../src/features/visualizer/fullscreen/FullscreenController.ts'

function fixture() {
  class Host extends EventTarget {
    fullscreenEnabled = true
    fullscreenElement: Element | null = null
    entries = 0
    exits = 0
    rejectEntry = false
    rejectExit = false
    release: (() => void) | null = null
    delayed = false
    async exitFullscreen() {
      this.exits++
      if (this.rejectExit) throw new Error('Exit denied')
      this.fullscreenElement = null
      this.dispatchEvent(new Event('fullscreenchange'))
    }
  }
  const host = new Host()
  const target = {
    requestFullscreen: async () => {
      host.entries++
      if (host.rejectEntry) throw new Error('Entry denied')
      if (host.delayed) await new Promise<void>(resolve => { host.release = resolve })
      host.fullscreenElement = target
      host.dispatchEvent(new Event('fullscreenchange'))
    },
  } as unknown as HTMLElement
  const controller = new FullscreenController(() => target, host)
  return { host, target, controller }
}

test('fullscreen construction is inert; repeated entry/exit follows native state', async () => {
  const { host, controller } = fixture()
  assert.equal(host.entries, 0)
  const disconnect = controller.connect()
  assert.equal(controller.getState().supported, true)
  for (let cycle = 0; cycle < 3; cycle++) {
    await controller.toggle()
    assert.equal(controller.getState().active, true)
    await controller.toggle()
    assert.equal(controller.getState().active, false)
  }
  assert.equal(host.entries, 3)
  assert.equal(host.exits, 3)
  disconnect()
})

test('Escape/native exit events synchronize fullscreen state', async () => {
  const { host, controller } = fixture()
  const disconnect = controller.connect()
  await controller.toggle()
  host.fullscreenElement = null
  host.dispatchEvent(new Event('fullscreenchange'))
  assert.equal(controller.getState().active, false)
  disconnect()
})

test('rejected fullscreen entry stays inactive and supports explicit retry', async () => {
  const { host, controller } = fixture()
  const disconnect = controller.connect()
  host.rejectEntry = true
  await controller.toggle()
  assert.equal(controller.getState().active, false)
  assert.equal(controller.getState().pending, false)
  assert.match(controller.getState().error!, /not allowed/)
  host.rejectEntry = false
  await controller.toggle()
  assert.equal(controller.getState().active, true)
  assert.equal(controller.getState().error, null)
  disconnect()
})

test('rejected exit accurately remains active with a visible error state', async () => {
  const { host, controller } = fixture()
  const disconnect = controller.connect()
  await controller.toggle()
  host.rejectExit = true
  await controller.toggle()
  assert.equal(controller.getState().active, true)
  assert.match(controller.getState().error!, /not allowed/)
  disconnect()
})

test('pending requests do not optimistically enter fullscreen or duplicate requests', async () => {
  const { host, controller } = fixture()
  const disconnect = controller.connect()
  host.delayed = true
  const first = controller.toggle()
  await controller.toggle()
  assert.equal(controller.getState().active, false)
  assert.equal(controller.getState().pending, true)
  assert.equal(host.entries, 1)
  host.release!()
  await first
  assert.equal(controller.getState().active, true)
  assert.equal(controller.getState().pending, false)
  disconnect()
})

test('unsupported fullscreen reports honest feedback without requesting it', async () => {
  const { host, controller } = fixture()
  host.fullscreenEnabled = false
  const disconnect = controller.connect()
  await controller.toggle()
  assert.equal(controller.getState().supported, false)
  assert.equal(host.entries, 0)
  assert.match(controller.getState().error!, /unavailable/)
  disconnect()
})

test('fullscreen listeners are removed on cleanup and can reconnect under StrictMode', async () => {
  const { host, controller } = fixture()
  let disconnect = controller.connect()
  await controller.toggle()
  disconnect()
  host.fullscreenElement = null
  host.dispatchEvent(new Event('fullscreenchange'))
  assert.equal(controller.getState().active, true)
  disconnect = controller.connect()
  assert.equal(controller.getState().active, false)
  disconnect()
})
