# BeatSync

**Turn Your Voice Into Visual Art.**

BeatSync turns live microphone input into audio-reactive neon rings, shockwaves, particles, and sparks. Customize the stage, perform in fullscreen, and record a video with your microphone audio to preview and download locally.

The project combines a personal interest in beatboxing with software development and interactive audio visualization. Its aim is to make the energy of a freestyle visible using browser audio analysis and frequency heuristics.

**[Live demo](https://beat-sync-flame.vercel.app/)** · **[GitHub repository](https://github.com/ayan-deb-nath/BeatSync)**

## Features

- Explicit microphone Start/Stop with clear permission, listening, and error feedback.
- Real-time RMS volume and three frequency bands, with accessible live level meters.
- Neon Festival, Cyberpunk, and Galaxy visual themes.
- Adjustable visual sensitivity from 0.50x to 2.00x and a reset control.
- Native fullscreen with entry/exit feedback and keyboard focus restoration.
- Separate local performance recording, elapsed time, preview, download, and confirmed discard.
- Responsive layouts, visible keyboard focus, and a static reduced-motion stage.
- Local theme/sensitivity persistence; microphone capture and recording never resume automatically.

## Technology

React 19, strict TypeScript 6, Vite 8, Tailwind CSS 4, and npm. Browser APIs provide Web Audio analysis, Canvas 2D rendering, fullscreen, and MediaRecorder encoding. Node's built-in test runner and ESLint cover application logic and code quality.

There is no backend, database, account system, analytics, external font service, or media upload service. BeatSync does not use AI or machine learning.

Dependencies use exact versions with a lockfile. TypeScript 6.0.3 is intentional: the installed stable `typescript-eslint` supports TypeScript below 6.1, while TypeScript 7 is outside its supported range. ESLint uses flat configuration with recommended JavaScript, TypeScript, and React Hooks rules. Two narrowly documented exceptions cover callback-ref assignment during commit and an inert controller that stores a ref getter without invoking it during render.

## Install and run

Install **Node.js 24 LTS** with npm, then run from the project directory:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. Stop any running development or preview server before `npm ci`; Windows can lock native CSS modules while a server is using them. Once dependencies are installed, starting the application does not require reinstalling them.

For this Windows workspace, the existing optional portable runtime can be added to the current PowerShell session:

```powershell
$env:Path = (Join-Path $PWD '.tools/node-v24.22.2-win-x64') + ';' + $env:Path
node --version
npm.cmd --version
npm.cmd run dev
```

`.tools/` is ignored by Git. It is a local convenience, not part of the application or a deployment requirement. On another machine, install Node.js LTS from [nodejs.org](https://nodejs.org/en/download), restart VS Code, and use the normal commands. Use `npm.cmd` if PowerShell blocks the npm script shim.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run typecheck` | Check application, tooling, and test types |
| `npm test` | Run the browser-independent automated tests |
| `npm run lint` | Run ESLint; warnings also fail the check |
| `npm run build` | Type-check and produce static files in `dist/` |
| `npm run preview` | Serve the production build locally |

## Using BeatSync

1. Press **Start Beatboxing** and allow microphone access. Permission is needed to measure your sound; audio stays local. Wait briefly for onset calibration.
2. Beatbox or speak. Volume expands and lights the core; low-frequency rises create waves, mids create particle bursts, and highs create sparks. Colors follow the selected theme.
3. Choose a visual theme, raise sensitivity for quiet sounds, or lower it for noisy rooms. Sensitivity changes visuals, not microphone volume or raw meters.
4. Use **Fullscreen** to expand the stage. Exit with the overlay button or native browser controls such as Escape where supported.
5. While listening, choose **Start Recording**. Use **Stop Recording** to finish the take while keeping the microphone active, or **Stop Beatboxing** to finish and release microphone access too.
6. Play the preview explicitly, then choose **Download Video**. Check that your browser saved it. Confirm **Discard Recording** before making another take.

Use headphones or stop microphone listening before preview playback, so speaker output does not feed back into the analysis. BeatSync itself never routes microphone monitoring to the speakers.

## Architecture

```text
public/                         Static favicon
src/
  app/                          Page composition; one shared microphone hook
  components/                   Brand, navigation, typed SVG icons
  features/
    audio/                      Analysis, microphone lifecycle, hook, meters, status
    visualizer/
      engine/                   Tuning, onset detection, simulation, Canvas drawing
      settings/                 Typed themes, validation, local preference hook
      fullscreen/               Native state controller and React subscription
    recording/                  Recorder lifecycle, formats, hook, preview, controls
  styles/                       Shared theme and responsive styles
  main.tsx                      StrictMode application entry point
tests/                          Audio, visualizer, settings, fullscreen, recorder tests
docs/quality-assurance.md       Validation evidence and manual release checks
eslint.config.js                Minimal flat ESLint configuration
tsconfig*.json                  Strict app, build-tool, and test configurations
vite.config.ts                  React and Tailwind Vite plugins
```

Features own their resources and presentation. `MicrophoneSession`, `RecordingSession`, and `FullscreenController` expose external-store snapshots consumed with `useSyncExternalStore`. Hooks connect those controllers to browser lifecycle events and release resources on cleanup. `App` shares one microphone session between the hero and stage.

Audio measurements live in a stable ref. Canvas reads them in requestAnimationFrame without per-frame React state updates; only the meter subtree subscribes to snapshots at up to 10 Hz. `VisualizerSimulation` is browser independent, and `CanvasRenderer` only draws its state. Settings update through a ref without replacing the Canvas, microphone stream, or AudioContext.

Tailwind 4 uses the recommended Vite plugin, `@import "tailwindcss"`, and CSS-first `@theme` tokens. Shared layout lives in `styles/index.css`; feature styles stay alongside their components. No legacy Tailwind/PostCSS configuration is needed.

## Microphone processing and visual response

An explicit Start creates/resumes an AudioContext and calls `getUserMedia({ audio: true, video: false })`. The audio graph is `MediaStreamAudioSourceNode → AnalyserNode`, with **no connection to the audio destination**.

The analyser uses a 2048-sample FFT, a -100 to -30 dB range, and 0.7 frequency smoothing. Waveform and spectrum typed arrays are reused. Measurements are normalized to 0–1 with a 60 ms attack and 180 ms release:

| Measurement | Calculation | Visual response in Neon Festival |
| --- | --- | --- |
| Volume | `sqrt(mean(sample²))`, clamped to 0–1 | Core brightness and up to 16% expansion |
| Low | Mean byte magnitudes / 255, 20–250 Hz | Cyan shockwave |
| Mid | Mean byte magnitudes / 255, 250 Hz–2 kHz | Purple particle burst |
| High | Mean byte magnitudes / 255, 2–16 kHz | Short cyan/pink sparks |

Frequency bands are half-open and capped at Nyquist. These are relative spectral levels, not physical power, calibrated decibels, or kick/snare/hi-hat classification. Browser-default microphone processing and hardware affect readings.

Core energy uses `1 - exp(-5 × RMS × sensitivity)`, with a 90 ms visual attack and 240 ms release. Onset detection combines a 350 ms warmup, adaptive 800 ms baseline, minimum level, positive slope, noise-relative margin, rearming, and cooldowns. Sensitivity scales thresholds by `1 / sqrt(sensitivity)` while preserving those safeguards. Changing sensitivity alone cannot create a positive audio slope.

Rendering targets up to 60 FPS on capable hardware. DPR is capped at 2, particles at 108 on larger stages or 56 on smaller stages, and simultaneous shockwaves at 6. Arrays compact in place, and particle glow sprites are cached. Hidden tabs pause Canvas rendering and clear stale effects. Reduced motion freezes the artwork without disabling audio controls or meters. Actual performance depends on the device; no physical-device frame-rate benchmark is claimed.

Stop cancels sampling, clears measurements, stops tracks, disconnects nodes, and closes the AudioContext before allowing another session. Track loss, interruption, denied permission, and unsupported APIs show actionable feedback. A pending browser permission prompt cannot be aborted: Stop invalidates the session, and a stream granted later is immediately released.

## Themes and preferences

| Theme | Palette and character |
| --- | --- |
| Neon Festival | Cyan, purple, and pink luminous rings |
| Cyberpunk | Hot pink, red, and orange angular accents |
| Galaxy | Blue, violet, and lavender star accents |

Typed theme definitions configure the same renderer and scoped CSS variables. The `beatsync.visualizer.v1` localStorage entry stores only theme and sensitivity. Unknown theme IDs and malformed JSON fall back safely; sensitivity is finite, clamped to 0.50–2.00, and rounded to 0.05 steps. Blocked storage leaves preferences usable for the session. Nothing restores microphone access, recording, or fullscreen automatically.

## Recording architecture and limits

Recording captures the **same Canvas pixels** shown on screen, including its background and small branding. DOM controls and page content are excluded. There is no screen-sharing request.

`RecordingSession` combines a Canvas video track with a clone of the existing live microphone track. It owns those independent tracks, chunks, timers, and Blob URLs. Stopping recording releases its tracks while the original microphone keeps listening. Stopping microphone capture first notifies recording to finalize, then releases the original tracks.

MIME candidates are verified with `MediaRecorder.isTypeSupported()`: WebM VP8/Opus, WebM VP9/Opus, generic WebM, H.264/AAC MP4, then generic MP4. Actual recorder output determines the Blob type and `.webm` or `.mp4` extension. Format support is browser dependent and can still fail at encoder startup; those failures never produce a false success.

- Capture targets 30 FPS, approximately 3 Mbps video and 128 kbps audio; these are encoding hints.
- Takes finalize at approximately two minutes using monotonic elapsed time.
- Collected chunks have a 64 MiB hard cap. Finalization begins at 60 MiB to reserve space for final data; an oversized chunk discards the take with an error.
- Browser-internal buffers and chunk scheduling cannot be strictly bounded by application code.
- Start/finalization watchdogs handle stalled browser events. Empty or unsupported output is an error.
- Hiding the tab finalizes the take because Canvas frames pause. Canvas context loss stops rendering, disables new recording, and finalizes available media with a review warning.
- Reduced-motion recording supplies held static frames without animating the artwork.
- Fullscreen/resizing changes the existing Canvas dimensions; encoder handling varies by browser.

Completed recordings remain in temporary browser memory. Preview never autoplays. Download requests a save, but the application cannot verify that it completed. A take is never silently replaced; discard requires confirmation and revokes its object URL. Unmount/page exit releases media resources and URLs. Native unsaved-work warnings may appear during recording or before requesting a download, but cannot guarantee recovery after refresh, forced termination, or mobile lifecycle events.

## Privacy and security

Microphone access follows an explicit user action and browser permission. Recording requires a separate action. Audio analysis and recordings remain local; there are no uploads, external media APIs, credentials, required environment variables, or unsafe HTML insertion. Only visual preferences use localStorage. Preview playback is the only user-controlled recorded-audio output.

`npm audit --omit=dev` reported **zero production vulnerabilities** during this phase. The full audit reported **11 moderate development-tool entries**, tracing to minimatch glob amplification ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)). The affected lint dependencies are not bundled into `dist/`. A compatible upstream update remains pending; npm's suggested breaking downgrades were not applied. Review advisories again before release and after dependency updates.

## Validation and accessibility

All **69 existing tests are preserved**, with one new regression test covering null, lost, and throwing Canvas contexts: **70 tests pass**. Lint, TypeScript, clean installation, and production build are required checks. See [the QA report](docs/quality-assurance.md) for browser results and remaining manual checks.

The interface uses semantic landmarks/headings, a skip link, visible focus, labeled native form controls/meters, meaningful disabled states, and status/error feedback. Control targets are enlarged, recording status has one announcement region per view, timers do not repeatedly announce, and the sensitivity output defers to the native slider's value announcement.

Automated axe checks supplement keyboard and layout checks; they do not establish complete WCAG conformance. Gradient text contrast, screen-reader behavior, physical touch usability, and recorded-media accessibility need human review. Downloaded performances can contain speech; captions/transcripts are not generated.

## Browser compatibility and known limitations

Use a current browser with the relevant native APIs. Microphone capture needs **HTTPS or a trustworthy localhost origin**. Plain HTTP on a LAN IP is insufficient for physical-phone testing. OS/site permissions and embed Permissions Policy may also restrict capture or fullscreen.

Features are capability-detected. Missing fullscreen/recording support disables those actions with explanations; Canvas failures preserve microphone controls and meters. A prefixed `webkitAudioContext` fallback exists. Some mobile Safari environments lack arbitrary-element fullscreen, and recording MIME/codec support varies.

Chrome synthetic microphone and mobile-sized viewport checks do not verify physical microphones, a native permission dialog, Safari, Firefox, or real mobile devices. Audio/video synchronization, save dialogs, codec playback in other players, low-memory behavior, and sustained hardware performance still require manual testing. Important recordings must be downloaded before leaving.

## Production build and deployment

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run build
npm run preview
```

The output is static content under **`dist/`**. No backend services, secrets, or portable runtime are required. Application code contains no absolute Windows paths or hardcoded development service URLs.

BeatSync is deployed on Vercel at **[beat-sync-flame.vercel.app](https://beat-sync-flame.vercel.app/)**, with source available on **[GitHub](https://github.com/ayan-deb-nath/BeatSync)**. For Vercel deployments, select the **Vite** framework preset, **Node.js 24.x**, install with **`npm ci`**, build with **`npm run build`**, and publish **`dist`**. `package.json` pins the Node major to `24.x`, supported by [Vercel's Node 24 runtime/build configuration](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions). The public application uses HTTPS for microphone access. This is a single-page anchor-based application; no client-side route rewrite is needed.

The document includes a favicon, language, viewport, theme color, title, description, and Open Graph/social text. Canonical and Open Graph URL metadata use the production address, `https://beat-sync-flame.vercel.app/`. A dedicated social preview image is not available yet, so no image metadata references a nonexistent asset. No public screenshot or demo video is supplied yet.

## Future improvements

- Tune onset heuristics using consented physical-device testing across microphones and rooms.
- Broaden Safari, Firefox, and mobile recording/playback validation.
- Measure frame time, memory, and audio/video synchronization on representative hardware.
- Add a dedicated social preview image when available.
- Evaluate accessible transcript/caption workflows for shared performances.

These are future work, not claims of implemented functionality.
