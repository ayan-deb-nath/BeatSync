export const RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
] as const

export function selectRecordingMime(isSupported: (mime: string) => boolean): string | null {
  for (const mime of RECORDING_MIME_TYPES) {
    try { if (isSupported(mime)) return mime } catch { /* Try the next verified format. */ }
  }
  return null
}

export function recordingExtension(mime: string): 'webm' | 'mp4' | null {
  const type = mime.toLowerCase().split(';')[0]?.trim()
  return type === 'video/webm' ? 'webm' : type === 'video/mp4' ? 'mp4' : null
}

export function recordingFilename(mime: string, date: Date): string {
  const extension = recordingExtension(mime)
  if (!extension) throw new Error('Unknown recording format')
  const pad = (value: number) => String(value).padStart(2, '0')
  return `BeatSync-Performance-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.${extension}`
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
