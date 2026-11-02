# BeatSync

Turn Your Voice Into Visual Art.

BeatSync transforms opt-in live microphone input into neon visual art. Phase 4 adds an audio-reactive Canvas 2D stage: a glowing core and rings, cyan shockwaves, purple bursts, and high-frequency sparks. It preserves the Neon Festival design, microphone lifecycle, and live meters from earlier phases.

## Technology

- React and TypeScript with strict type checking
- Vite for local development and production builds
- Tailwind CSS v4 with the official `@tailwindcss/vite` plugin
- npm with exact dependency versions and a committed lockfile
- Canvas 2D for audio-reactive artwork; CSS for theme tokens and responsive layout

No backend, external fonts, UI libraries, or audio dependencies are required.

## Install

Install Node.js 24 LTS (recommended) with npm, then run from this directory:

```sh
npm ci
```

Node.js 22.12 or newer is required. The setup environment used an optional portable Node runtime in `.tools/`, which is ignored by Git. On this Windows workspace, if Node is not installed on PATH, you can use it for the current PowerShell session:

```powershell
$env:Path = (Join-Path $PWD '.tools/node-v24.22.2-win-x64') + ';' + $env:Path
npm.cmd run dev
```

The portable runtime is a local convenience and is not part of the application.

## Development

```sh
npm run dev        # Vite development server; open the printed local URL
npm run typecheck  # Check application and build configuration types
npm test           # Node built-in audio, lifecycle, and visualization tests
npm run build      # Type check and build into dist/
npm run preview    # Serve the production build locally
```

On Windows, use `npm.cmd` if PowerShell blocks the npm script shim. Use `npm ci` after cloning to reproduce the lockfile. Dependencies can be deliberately updated with npm and validated with the build.

## Structure

```text
public/                         Static favicon
src/
  app/App.tsx                   Page composition and application shell
  components/                   Shared brand, navigation, and typed SVG icons
  features/
    audio/                      Analysis, resource lifecycle, hook, meters, status, styles
      hooks/useMicrophoneAudio.ts
    visualizer/                 Canvas component, stage composition, controls, styles
      engine/                   Tuning, onset detection, simulation, Canvas drawing
  styles/index.css              Tailwind import, theme, responsive styles
  main.tsx                      React entry point with StrictMode
  vite-env.d.ts                 Vite client types
vite.config.ts                  React and Tailwind integrations
tsconfig*.json                  Strict app and tooling configurations
tests/audio.test.ts             Analysis and lifecycle tests with browser API doubles
tests/visualizer.test.ts        Browser-independent visualization tests
```

Features own their UI and, when needed, their hooks and types. `App` creates one `useMicrophoneAudio` instance shared by the hero and visualizer controls. `MicrophoneSession` owns browser resources, `analysis.ts` owns measurement math, and React components own presentation. `VisualizerPreview` composes the Canvas stage, microphone status, controls, and meters. `AudioReactiveCanvas` reads the existing stable measurement ref without subscribing to per-frame React state. It replaces the obsolete `AmbientOrbit` CSS artwork. No second microphone stream or AudioContext is created. `SiteHeader` provides visible anchor navigation that wraps on mobile.

Tailwind v4 uses `@import "tailwindcss"` and CSS-first `@theme` tokens; no legacy Tailwind or PostCSS configuration is needed. The existing design stays in `src/styles/index.css`; audio UI additions are in the feature's `audio.css`. CSS variables provide a starting point for future visual themes.

## Current behavior and accessibility

- Responsive desktop, tablet, and mobile layout
- Semantic landmarks, heading hierarchy, skip link, and visible keyboard focus
- Working Start/Stop Beatboxing button and synchronized microphone panel controls
- Neon Festival Canvas with live core/ring response, transient shockwaves, bursts, and sparks
- Sensitivity, visual theme, fullscreen, and recording remain disabled and marked coming soon
- Neon Festival, Cyberpunk, and Galaxy shown as planned theme options
- Inactive, requesting permission, listening, and error states with accessible status announcements
- Four native accessible meters; values update at 10 Hz without a live-region announcement on every sample
- Working Visualizer, How It Works, and About anchor links
- Decorative SVGs hidden from assistive technology; visual concept has a text description
- Reduced-motion preference renders a static stage and leaves audio controls/meters usable
- No microphone request on load; explicit Start is always required
- Local analysis only; no upload, storage, recording, external audio APIs, or speaker monitoring

## Audio architecture and measurements

`useMicrophoneAudio` creates an inert `MicrophoneSession`, subscribes to status changes with `useSyncExternalStore`, and stops it on unmount or `pagehide`. This is safe under React StrictMode: creating or mounting the hook never creates an AudioContext or requests a microphone.

An explicit Start creates/resumes an AudioContext in the click activation scope and calls `getUserMedia({ audio: true, video: false })`. The graph is `MediaStreamAudioSourceNode → AnalyserNode`, with **no connection to the audio destination**. Browser-default microphone processing can affect readings; these are not calibrated physical measurements.

The analyser uses a 2048-sample FFT (1024 frequency bins), `minDecibels = -100`, `maxDecibels = -30`, and `smoothingTimeConstant = 0.7`. Frequency resolution is `sampleRate / 2048` Hz per bin (about 23.4 Hz at 48 kHz). At 48 kHz, a time-domain window covers about 42.7 ms.

All measurements are normalized to **0–1** and shown as percentages:

| Measurement | Calculation / boundaries |
| --- | --- |
| Overall volume | `sqrt(mean(sample²))` from float time-domain samples, clamped to 0–1 |
| Low-frequency energy | 20 Hz ≤ bin frequency < 250 Hz |
| Mid-frequency energy | 250 Hz ≤ bin frequency < 2000 Hz |
| High-frequency energy | 2000 Hz ≤ bin frequency < 16000 Hz, capped at Nyquist |

Each band's value is the arithmetic mean of its byte frequency magnitudes divided by 255. These bytes map the configured dB interval to 0–255, so “energy” here is a **relative spectral level**, not physical power or a linear amplitude estimate. Empty bands return zero. These broad measurements do not classify kicks, snares, or hi-hats.

Time-based exponential smoothing adds a 60 ms attack and 180 ms release to the metrics. One animation-frame loop reuses waveform/spectrum typed arrays and mutates `measurementsRef.current` in place. The Canvas renderer reads that same stable ref directly:

```ts
// Inside the renderer's animation loop:
const { volume, low, mid, high } = audio.measurementsRef.current
```

React does not subscribe to that high-frequency ref. `AudioLevelMeter` alone subscribes to copied measurement snapshots published at most every 100 ms. Status changes have a separate subscription, so sampling does not rerender the whole application. Sampling follows display frames and pauses with background-tab frame scheduling.

Stop invalidates the session, cancels its frame, removes listeners, stops all tracks, disconnects nodes, closes the context, and immediately zeros both the ref and UI snapshot. New starts wait for context teardown. Track end/mute and context suspension/interruption release capture and show a retryable error rather than leaving a misleading listening indicator.

Browsers do not provide an abort mechanism for an outstanding permission prompt. Stop cancels the application's session immediately, but Start remains locked until that original request settles. A late granted stream is immediately stopped; it never starts analysis. Dismiss or answer the browser prompt before starting again. A brief browser capture indicator can appear if permission is granted after cancellation, until the returned tracks are stopped.

## Canvas architecture and tuning

`AudioReactiveCanvas.tsx` owns the Canvas element, one rendering loop, `ResizeObserver`, motion-preference listener, and visibility listener. `engine/OnsetDetector.ts` interprets frequency changes. `engine/VisualizerSimulation.ts` owns effect state, movement, lifetime, and bounded counts independently of the browser. `engine/CanvasRenderer.ts` draws the current simulation and caches three small particle glow sprites. `engine/config.ts` exposes all onset thresholds, cooldowns, lifetimes, particle budgets, core response, FPS target, and DPR cap.

| Measurement | Visual mapping |
| --- | --- |
| RMS volume | `1 - exp(-5 × volume)` drives brightness and core expansion (maximum 16%); 90 ms attack / 240 ms release smooth the visual envelope |
| Low (20–250 Hz) onset | Cyan expanding ring, fading over 1.1 seconds |
| Mid (250 Hz–2 kHz) onset | 16 outward purple particles with velocity decay, lifetime 1.15 seconds |
| High (2–16 kHz) onset | 7 small cyan/pink sparks with short trails, lifetime 0.38 seconds |

Each band detector seeds its baseline from the first actual sample and ignores events for 350 ms after starting/resuming. It tracks a baseline with an 800 ms time constant and requires a positive slope, an absolute floor, and sufficient excess above that baseline. It re-arms only after energy returns near the baseline. Low/mid/high minimum levels are 0.13/0.10/0.08, baseline margins are 0.065/0.055/0.045, and cooldowns are 320/240/140 ms. These are conservative heuristics for relative audio levels, **not kick/snare/hi-hat classification**. Microphone hardware and browser processing may require future tuning.

Idle mode has quiet rings and sparse ambient lights but emits no audio-triggered particles or shockwaves. Stop immediately disables new events and resets onset state; existing effects fade out naturally and the core returns to rest. Starting again restores the detector warmup. No random values are used as audio input or for triggering effects.

Rendering targets at most 60 FPS on capable hardware, with delta-based movement/smoothing and a 50 ms maximum simulation step to avoid large jumps after stalls. Particle arrays compact in place; allocations occur at bounded emission events. Caps are 108 particles on wider stages, 56 at stage widths ≤600 px, and 6 shockwaves. Resizing to mobile also trims the particle budget. Small cached glow sprites avoid per-particle shadow blurs; only a handful of ring strokes use shadow blur. Actual FPS depends on device and browser; no physical-device benchmark is claimed.

The Canvas bitmap follows its CSS bounds via ResizeObserver and uses devicePixelRatio capped at 2. Window resizing and changes of DPR during animation are handled. See [MDN devicePixelRatio guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio). The stage's existing responsive height preserves layout without shifts, and the Canvas cannot intercept control clicks.

Hidden tabs cancel the render frame and clear stale effects. Returning starts with a new timestamp and onset warmup, avoiding a burst from old measurements. Reduced motion clears particles/shockwaves and draws a static ring/core scene without a continuous rendering loop. Controls and live meters continue working. Unmount cancels the rendering frame, disconnects the observer, removes listeners, and clears simulation state, including under StrictMode. If Canvas 2D is unavailable, a text fallback leaves microphone controls and meters available.

## Manual microphone testing

1. Run `npm run dev` (or `npm.cmd run dev` on Windows) and open the printed **localhost** URL. On a fresh load, confirm there is no permission prompt, status is inactive, and all four meters read zero.
2. Press **Start Beatboxing**, then choose **Allow** in the native browser prompt. Confirm the status becomes listening, the button becomes Stop Beatboxing, and the browser shows active microphone capture.
3. Speak or beatbox. Overall volume and the three bands should vary. A normal voice may produce a small RMS percentage; the scale is raw relative amplitude without automatic gain boosting. Silence can include your room's noise floor.
4. Press **Stop Beatboxing** or the panel's **Stop**. Confirm the meters reset to zero, status becomes inactive, and the browser no longer indicates active capture. A persistent permission-granted icon can remain even when capture is off.
5. Repeat several start/stop cycles using both control locations. No audio should play through the speakers.
6. Test **Block** (reset site permission first), then allow it through site settings and explicitly retry. Confirm an understandable error and no automatic re-request.
7. While the permission prompt is open, press Stop if your browser permits page interaction. Dismiss or answer the prompt; confirm listening never starts and a late stream is released. Confirm rapid clicks do not create duplicate requests.
8. While listening, disconnect a USB microphone, revoke site permission, or suspend browser audio. Confirm capture ends with an error and zero levels; reconnect and explicitly retry.
9. Navigate away/reload while listening, then confirm capture is released and returning to the page does not automatically restart it. Check desktop and mobile browsers.
10. After allowing capture, wait about half a second for onset warmup. Try quiet/loud sounds: the core should expand gently and the rings brighten. Try separated low, mid, and high-frequency sounds: suitable transients should create cyan waves, purple bursts, and fast sparks. These effects do not label the sound being made.
11. Hold a steady tone or leave only room noise: it should not continuously create bursts. Press Stop during an effect: existing waves/particles should fade within about 1.2 seconds, with no new audio events.
12. Resize the window, rotate a phone, switch browser zoom/DPR, and hide/return to the tab. Confirm the stage stays centered, sharp, and unclipped, without stale bursts on return. Test a 14-inch laptop and lower-powered mobile hardware for practical smoothness.
13. Enable the OS/browser **Reduce motion** preference before loading and while running. The stage should remain static with no particles or shockwaves; microphone controls and level meters should remain functional.

## Compatibility and validation limits

Microphone capture requires a secure context: HTTPS or a trustworthy loopback origin such as localhost. Plain HTTP on a LAN IP is insufficient for phone testing. Embedded pages may also require an appropriate microphone Permissions Policy. OS permissions, enterprise settings, and a device in use by another application can prevent capture. See [MDN getUserMedia security and permission requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

The implementation feature-detects `getUserMedia` and AudioContext, with a prefixed `webkitAudioContext` fallback. Target current Chrome, Edge, Firefox, and Safari. Mobile browser interruptions and background scheduling vary; an interrupted session must be restarted explicitly. No promise of legacy-browser support is made.

Automated validation includes TypeScript, the production build, **32 Node tests** (all original 19 audio tests plus 13 visualization tests), responsive Chrome checks, and Chrome's synthetic capture device exercising real Web Audio and Canvas core response. Browser checks cover Canvas initialization, DPR cap, static reduced motion, unmount cleanup, and existing start/stop/error behavior. Synthetic browser tests do **not** verify a native permission prompt, physical microphone/beatboxing, device-specific performance, Firefox, or Safari. Those require the manual checks above. There is no configured lint script. No dependencies were added for tests; they use Node's built-in test runner and type stripping.

## Planned features

- Multiple visual themes
- Audio sensitivity controls
- Performance recording

These features are not implemented in Phase 4. Microphone analysis still runs when explicitly started, including under reduced motion. No recording, backend, AI classification, or audio uploads are implemented.

## Deployment

Ready for a future GitHub repository and Vercel deployment. In Vercel, select the Vite framework preset, use `npm run build`, and set the output directory to `dist`. No environment variables or backend are currently needed. The GitHub footer text reserves space for a real repository link without inventing a URL. No remote repository or deployment is created in Phase 4.
