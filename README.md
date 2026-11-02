# BeatSync

Turn Your Voice Into Visual Art.

BeatSync transforms opt-in live microphone input into neon visual art. Phase 6 adds local performance recording and video export: record the actual Canvas with microphone audio, preview the result, and download it. The three themes, sensitivity, fullscreen mode, saved preferences, audio lifecycle, and responsive interface remain intact.

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
    recording/                  Recorder lifecycle, hook, formats, controls, preview, styles
    visualizer/                 Canvas component, stage composition, controls, styles
      engine/                   Tuning, onset detection, simulation, Canvas drawing
      settings/                 Typed palettes, preference validation, persistence hook
      fullscreen/               Native fullscreen controller and React hook
  styles/index.css              Tailwind import, theme, responsive styles
  main.tsx                      React entry point with StrictMode
  vite-env.d.ts                 Vite client types
vite.config.ts                  React and Tailwind integrations
tsconfig*.json                  Strict app and tooling configurations
tests/audio.test.ts             Analysis and lifecycle tests with browser API doubles
tests/visualizer.test.ts        Browser-independent visualization tests
tests/settings.test.ts          Palettes, persistence, sensitivity and noise protection
tests/fullscreen.test.ts        Native-state synchronization and fullscreen failures
tests/recording.test.ts         Recorder lifecycle, formats, limits, ownership, URL cleanup
```

Features own their UI and, when needed, their hooks and types. `App` creates one `useMicrophoneAudio` instance shared by the hero and visualizer controls. `MicrophoneSession` owns browser resources, `analysis.ts` owns measurement math, and React components own presentation. `VisualizerPreview` composes the Canvas stage, microphone status, controls, and meters. `AudioReactiveCanvas` reads the existing stable measurement ref without subscribing to per-frame React state. It replaces the obsolete `AmbientOrbit` CSS artwork. No second microphone stream or AudioContext is created. `SiteHeader` provides visible anchor navigation that wraps on mobile.

Tailwind v4 uses `@import "tailwindcss"` and CSS-first `@theme` tokens; no legacy Tailwind or PostCSS configuration is needed. The existing design stays in `src/styles/index.css`; audio UI additions are in the feature's `audio.css`. Visualizer-specific theme accents and fullscreen layouts live in `visualizer.css`.

## Current behavior and accessibility

- Responsive desktop, tablet, and mobile layout
- Semantic landmarks, heading hierarchy, skip link, and visible keyboard focus
- Working Start/Stop Beatboxing button and synchronized microphone panel controls
- Neon Festival Canvas with live core/ring response, transient shockwaves, bursts, and sparks
- Working sensitivity slider with current value, keyboard support, and reset to 1.00x
- Three working visual themes: Neon Festival, Cyberpunk, and Galaxy
- Native fullscreen performance mode when supported; honest unsupported/error feedback
- Separate opt-in recording, elapsed timer, native preview, download, and confirmed discard
- Inactive, requesting permission, listening, and error states with accessible status announcements
- Four native accessible meters; values update at 10 Hz without a live-region announcement on every sample
- Working Visualizer, How It Works, and About anchor links
- Decorative SVGs hidden from assistive technology; visual concept has a text description
- Reduced-motion preference renders a static stage and leaves audio controls/meters usable
- No microphone request on load; explicit Start is always required
- Local analysis and explicit local recording only; no media uploads, external audio APIs, or speaker monitoring
- Only visual theme and sensitivity preferences are saved locally

## Themes and saved preferences

| Theme | Appearance |
| --- | --- |
| Neon Festival (default) | Electric cyan, purple, and pink; luminous rings, cyan shockwaves, purple bursts, cyan/pink sparks |
| Cyberpunk | Hot pink, red, orange, and charcoal; contrasting rings, pink/red shockwaves, orange bursts, angular accents |
| Galaxy | Cosmic blue, violet, and lavender; atmospheric rings, soft blue waves, star-shaped light accents, quieter ambience |

`settings/themes.ts` defines one typed palette/motif configuration per theme. A single Canvas renderer uses these configurations; it rebuilds its three small glow sprites and background gradient only when the theme changes. The Canvas, simulation, existing particles, audio stream, and AudioContext are retained. Stage border, labels, slider, and relevant controls use scoped CSS variables from the same palette. Reduced-motion users get an immediate static repaint when changing themes, without restarting an animation loop.

`useVisualizerSettings` owns settings inside the visualizer subtree. Settings changes cause a normal control update, not per-frame React renders. `AudioReactiveCanvas` keeps the latest settings in a ref read by its existing render loop. Theme changes and sensitivity changes do not reset onset calibration or microphone capture.

Theme and sensitivity are saved as a small JSON object under `beatsync.visualizer.v1` in localStorage. Saved themes are checked against the three known IDs; unknown values fall back to Neon Festival. Saved sensitivity must be a finite number, is clamped to 0.5–2.0, and rounded to 0.05 steps; invalid values fall back to 1.0. Broken JSON is safely ignored. If writing storage is blocked, settings still work for the current session and an inline message explains that they cannot persist. Microphone permissions, active listening state, audio samples, and measurements are never persisted. Restoring preferences never starts listening or enters fullscreen.

## Sensitivity

The **0.50x–2.00x** slider defaults to **1.00x** and updates the visual response in real time. **Reset to 1.00x** restores the default. It does not change microphone samples, audio analysis, or the raw level meters.

Core energy uses `1 - exp(-5 × RMS × sensitivity)`, keeping a smooth, saturating response rather than clipping boosted measurements. Onset detection continues to use the original, unamplified band levels. Absolute minimum levels, baseline margins, and rising-slope thresholds scale by `1 / sqrt(sensitivity)`. This makes quieter transients easier to see at high sensitivity, and requires stronger sounds at low sensitivity.

The effective baseline margin is `max(baseMargin / sqrt(sensitivity), 0.025 + baseline × 0.2)`, with a minimum slope threshold of 0.08 per second. This preserves a noise-relative floor even at 2x. The adaptive baseline, initial warm-up, cooldowns, re-arming latch, particle caps, and shockwave cap remain active. Merely moving the slider over a constant input cannot fabricate a positive audio slope. Gain changes blend through the existing visual attack/release envelope.

## Fullscreen performance mode

Press **Fullscreen** in Display to request native fullscreen for the visualizer section. It presents only the expanded Canvas, BeatSync branding, theme/sensitivity summary, microphone status, Start/Stop, and Exit Fullscreen controls. Existing audio capture continues. Exit through the overlay button, the browser's native exit control, or Escape where supported. Keyboard focus moves to Exit on entry and returns to the Display button on exit.

`fullscreen/FullscreenController.ts` derives active state from `document.fullscreenElement`, subscribes to `fullscreenchange` and `fullscreenerror`, and serializes pending requests. The React hook subscribes to that state and removes listeners on cleanup. Requests are made synchronously from a user click; no entry is automatic or restored from preferences. Rejection displays an inline error without pretending entry succeeded. Exit failures keep the actual active state and show an overlay error; native browser exit remains available. Entering/exiting fullscreen resizes the existing Canvas through ResizeObserver; it does not recreate the renderer, stream, or AudioContext.

Native fullscreen availability depends on the browser, device, and embed Permissions Policy. Some mobile Safari environments do not offer arbitrary-element fullscreen. If the standard API is missing or `fullscreenEnabled` is false, the button is disabled with an explanation; there is no simulated fullscreen fallback. See [MDN Fullscreen API compatibility and permissions](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API). Actual support is feature-detected rather than inferred from a browser name.

## Local performance recording

Recording uses native browser APIs only: `Canvas.captureStream()`, a microphone track clone, `MediaStream`, `MediaRecorder`, `Blob`, and object URLs. It requires a separate **Start Recording** click after microphone listening is active. Granting microphone access, loading saved preferences, entering fullscreen, or returning to a page never starts recording automatically.

`recording/RecordingSession.ts` owns recorder state, chunks, elapsed time, owned tracks, timers, and object URLs. `usePerformanceRecording` connects it to React, microphone shutdown, page lifecycle events, and unsaved-work warnings. `formats.ts` handles MIME selection, container extensions, filenames, and timer formatting. `RecordingControls.tsx` presents normal/fullscreen actions and a native video preview. No recording data enters localStorage; it still contains only theme and sensitivity preferences.

The recorder captures the **same stable Canvas element** users see at up to **30 FPS**. Its dark background, rings, particles, theme colors, and subtle BeatSync/theme text are drawn into Canvas pixels and therefore appear in exports. DOM controls, timers, microphone meters, and other page decorations are not recorded. There is no desktop/tab capture or screen-sharing permission request.

`MicrophoneSession.cloneRecordingTrack()` clones a live track from the existing microphone stream, without another `getUserMedia` call or AudioContext. The recorder combines that clone and the Canvas video track in one MediaStream. These two tracks belong to recording; stopping recording stops them without stopping the original microphone. The existing analysis graph remains disconnected from speakers. Browser-default microphone processing is retained; no new recording-specific audio processing is added.

Microphone shutdown notifies recording synchronously before original tracks are stopped. Recording requests finalization, releases its clone and video track, then handles the recorder's final `dataavailable`/`stop` events. The UI reports the reason. Device disconnection or an ended recording track also requests finalization. Encoder errors, empty output, unsupported containers, or stalled start/finalization produce an error instead of a success claim.

### Record, preview, download, and discard

1. Start Beatboxing and allow microphone access. Confirm **Listening** and live meter movement.
2. Press **Start Recording** in Capture (or the fullscreen overlay). Confirm the red recording indicator, elapsed `00:00` timer, and explicit video/microphone recording status.
3. Perform. Theme, sensitivity, and fullscreen changes continue to affect the same Canvas and recording without reopening the microphone.
4. Press **Stop Recording**. Listening continues while the recorder finalizes. Alternatively, Stop Beatboxing safely finalizes the take and releases microphone capture too.
5. Once nonempty output is ready, review its duration, size, and container. The native video has Play/Pause/timeline controls and **never autoplays**. Use headphones or stop listening before playback so speaker output does not affect the live microphone analysis. If the browser cannot preview the output, download is still available with an explanation.
6. Choose **Download Video** to request a local save. The filename is `BeatSync-Performance-YYYY-MM-DD-HHMMSS.webm` or `.mp4`, using local time and the actual recorder output container. Verify the browser saved the file; an anchor click can only confirm a download was requested.
7. Choose **Discard Recording** and confirm before recording another take. A ready take is never silently replaced. Downloading does not delete it; discarding or closing the page releases it from browser memory.

Finished media remains only in temporary browser memory until discarded or the page closes. Discard/unmount revokes its object URL. Browsers may show a native unsaved-work warning when leaving during recording or before a download has been requested; this is not guaranteed on mobile or forced termination. Always download important takes before leaving.

### Formats, quality, and safety limits

MIME candidates are probed with `MediaRecorder.isTypeSupported()` in this order: WebM VP8/Opus, WebM VP9/Opus, generic WebM, MP4 H.264/AAC, then generic MP4. A candidate must pass the browser's check; MP4 is not assumed available. Final Blob type and extension follow the recorder's actual MIME type. Missing recording APIs, Canvas capture, or a verified format disable recording with an explanation while other BeatSync features remain usable. Combined-stream constructor/start failures are handled too; explicit NotSupported/Security failures disable recording for that session.

The target is 30 FPS Canvas capture, approximately 3 Mbps video and 128 kbps audio. These are browser hints, not guaranteed encoding rates or output dimensions. Exports use the Canvas's current pixel dimensions, including its capped DPR; fullscreen/resizing can change those dimensions during a take. Chrome synthetic tests exercised fullscreen changes successfully, but encoder behavior and playback compatibility can vary across browsers.

Recordings auto-finalize at approximately **two minutes**, using actual monotonic elapsed time from the successful `start()` call rather than counting chunks or relying on delayed browser start events. Recording status is confirmed by the native start event. UI time updates at most once per second. Normal chunks arrive in roughly one-second slices. Collected data has a **64 MiB hard cap**; at 60 MiB finalization is requested to leave room for final data. A chunk that exceeds the hard cap causes the take to be abandoned with an error, rather than offering a potentially truncated file. Browser-internal buffering/chunk scheduling cannot be strictly bounded by application code; timeslices are not guaranteed under load.

Hiding the tab finalizes recording with a message because Canvas rendering pauses in hidden tabs. Microphone listening remains a separate user-controlled session unless the browser interrupts it. Page exit/unmount cleans all owned recording resources. At most one recorder is active, and start/stop watchdogs fail cleanly if browser events stall. Reduced-motion recordings contain the actual static stage and microphone audio; occasional identical-pixel redraws and `requestFrame()` calls provide held frames without animating the artwork.

**Privacy:** Your performance is recorded locally in your browser. Nothing is uploaded. You choose whether to download it. No backend, accounts, cloud storage, media analytics, or external recording APIs are used. Audio/video sync is delegated to the native recorder; physical-device latency and drift have not been measured.

### Recording validation

Automated recorder tests use browser API doubles to check formats, API absence, start/stop/rapid clicks, elapsed limits, memory limits, track ownership, empty output, errors/retry, filenames, and object URL cleanup. Chrome synthetic audio tests created a real **WebM VP8/Opus** file and decoded it through a native video element; its playback capture exposed **one audio and one video track**. They also checked theme/sensitivity/fullscreen continuity, recording start from fullscreen, stopping only recording versus stopping microphone listening, confirmed discard, hidden-tab finalization, and reduced-motion output. This does not establish universal browser support or verify physical microphone recording.

For manual verification, record 10–20 seconds of real beatboxing, change theme/sensitivity while recording, enter/exit fullscreen, and stop recording. Confirm listening continues, play the preview explicitly, download and play the saved file in another player, and verify audio/video synchronization by a sharp sound with a visible reaction. Repeat with microphone Stop, device disconnection, a hidden tab, and reduced motion. Let a take reach two minutes to verify automatic finalization on your device. Test unsupported browsers for honest disabled controls and test both Cancel and Confirm when discarding.

See [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) for API/format compatibility. Safari, Firefox, mobile encoders, native save dialogs, physical microphone sync, and low-memory behavior require device testing. A nonempty recorder output can still be unsupported by a particular player; preview failures are reported without removing download access.

## Audio processing details

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
| RMS volume | `1 - exp(-5 × volume × sensitivity)` drives brightness and core expansion (maximum 16%); 90 ms attack / 240 ms release smooth the visual envelope |
| Low (20–250 Hz) onset | Cyan expanding ring, fading over 1.1 seconds |
| Mid (250 Hz–2 kHz) onset | 16 outward purple particles with velocity decay, lifetime 1.15 seconds |
| High (2–16 kHz) onset | 7 small cyan/pink sparks with short trails, lifetime 0.38 seconds |

Each band detector seeds its baseline from the first actual sample and ignores events for 350 ms after starting/resuming. It tracks a baseline with an 800 ms time constant and requires a positive slope, an absolute floor, and sufficient excess above that baseline. It re-arms only after energy returns near the baseline. At default sensitivity, low/mid/high minimum levels are 0.13/0.10/0.08 and configured margins are 0.065/0.055/0.045, with the additional noise-relative floor described above. Cooldowns remain 320/240/140 ms at every sensitivity. These are conservative heuristics for relative audio levels, **not kick/snare/hi-hat classification**. Microphone hardware and browser processing may require future tuning.

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
14. While listening, switch rapidly between all three themes. Confirm the Canvas and stage accents change, the meters keep running, and the microphone permission/capture indicator does not restart.
15. Compare 0.50x, 1.00x, and 2.00x while repeating similar sounds. Core response and onset sensitivity should change, but the raw meters should remain unscaled. Confirm room noise does not create endless events, and Reset restores 1.00x.
16. Choose a theme and sensitivity, then reload. Confirm both return without requesting microphone access. To test invalid saved values, set the `beatsync.visualizer.v1` key to malformed JSON in browser developer tools and reload; defaults should be restored safely.
17. While listening, enter/exit Fullscreen several times, using the overlay Exit button and native Escape/browser controls. Confirm the same listening session continues, settings are retained, Canvas resizes, and keyboard focus is restored. Also test Start/Stop within fullscreen.
18. Test fullscreen on a desktop, tablet, and supported mobile device, including landscape orientation. An unsupported browser should show a disabled button and explanation. Check a denied fullscreen request or restricted embed for truthful error feedback. Reduced motion should stay static in fullscreen while controls remain functional.

## Compatibility and validation limits

Microphone capture requires a secure context: HTTPS or a trustworthy loopback origin such as localhost. Plain HTTP on a LAN IP is insufficient for phone testing. Embedded pages may also require an appropriate microphone Permissions Policy. OS permissions, enterprise settings, and a device in use by another application can prevent capture. See [MDN getUserMedia security and permission requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

The implementation feature-detects `getUserMedia` and AudioContext, with a prefixed `webkitAudioContext` fallback. Target current Chrome, Edge, Firefox, and Safari. Mobile browser interruptions and background scheduling vary; an interrupted session must be restarted explicitly. No promise of legacy-browser support is made.

Automated validation includes TypeScript, the production build, **69 Node tests**, preserving all previous 47 tests and adding recording/ownership checks, plus responsive Chrome and synthetic capture/recording tests. Browser checks cover rapid live theme changes, sensitivity during capture, preference restoration, native fullscreen cycles, recording output with decoded audio/video, focus restoration, Canvas/DPR/reduced-motion behavior, visibility, and cleanup. Synthetic browser tests do **not** verify a native microphone permission prompt, physical microphone/beatboxing, device-specific performance, Firefox, or Safari. Chrome mobile-sized viewport checks are not physical mobile-device tests. Those require manual testing. There is no configured lint script. No dependencies were added for tests; they use Node's built-in test runner and type stripping.

## Scope

Phase 6 is complete. Microphone listening and recording are separate explicit actions. No backend, database, AI classification, cloud storage, accounts, or audio uploads are implemented. Phase 7 has not begun.

## Deployment

Ready for a future GitHub repository and Vercel deployment. In Vercel, select the Vite framework preset, use `npm run build`, and set the output directory to `dist`. No environment variables or backend are currently needed. The GitHub footer text reserves space for a real repository link without inventing a URL. No remote repository or deployment is created in Phase 6.
