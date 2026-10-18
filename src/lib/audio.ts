let ctx: AudioContext | null = null

/** Must be called from a user gesture (e.g. the Start button) on mobile browsers. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
  // iOS needs an utterance inside a gesture before speech works later
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('')
      u.volume = 0
      window.speechSynthesis.speak(u)
    }
  } catch {
    /* ignore */
  }
}

function tone(freq: number, startIn: number, dur: number, vol = 0.25) {
  if (!ctx) return
  const t0 = ctx.currentTime + startIn
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export const beeps = {
  /** Start of an effort phase (hold, up...). */
  work: () => tone(880, 0, 0.22, 0.3),
  /** Start of a rest/relax phase. */
  rest: () => {
    tone(587, 0, 0.18)
    tone(440, 0.18, 0.25)
  },
  /** Last-seconds countdown tick. */
  tick: () => tone(660, 0, 0.08, 0.15),
  done: () => {
    tone(523, 0, 0.18)
    tone(659, 0.18, 0.18)
    tone(784, 0.36, 0.4)
  },
}

export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.02
    u.pitch = 1
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window
