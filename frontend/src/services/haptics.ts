import { DEFAULT_META } from '../config';
import type { CueType, HapticPattern } from '../types';

// Patterns come from the backend (/api/meta) once loaded; until then, the defaults in config.ts.
let hapticPatterns: Record<CueType, HapticPattern> = DEFAULT_META.haptic_patterns;

export function setHapticPatterns(patterns: Record<CueType, HapticPattern>): void {
  hapticPatterns = patterns;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Unlocks cue audio. Call from a user gesture (tap/click): iOS keeps an AudioContext silent
 * unless it was started by one, and route cues are fired later from timers, not taps.
 * Also asks iOS 17+ to treat this as playback audio so the Silent switch doesn't mute cues.
 * iPhones have no web vibration at all, so these sounds are the only non-visual cue there.
 */
export function unlockCueAudio(): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';

    const ctx = getAudioContext();
    if (!ctx) return;
    // Playing a one-sample silent buffer inside the gesture is what actually unlocks iOS audio.
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start(0);
  } catch (err) {
    console.warn('Audio unlock failed:', err);
  }
}

/**
 * Checks if the browser hardware supports vibration.
 */
export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Plays a synthesized acoustic sound corresponding to the cue type.
 * Ensures the cue can be felt/heard on iOS devices, laptops, and environments where vibration is unavailable.
 */
export function playSynthesizedCueSound(cue: CueType): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (cue === 'left') {
      // Dual rising frequency beeps (left cue feel)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(587, now + 0.12);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(587, now + 0.22);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.35);
      gain2.gain.setValueAtTime(0.3, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.22);
      osc2.stop(now + 0.4);
    } else if (cue === 'right') {
      // One long falling tone (vs. left's two short rising beeps).
      // Kept above ~500 Hz with harmonics: phone speakers barely reproduce low pure sine tones.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.35);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (cue === 'caution') {
      // Rapid staccato warning pulses (hazard nearby)
      [0, 0.1, 0.2, 0.32].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(idx === 3 ? 880 : 700, now + offset);
        gain.gain.setValueAtTime(0.25, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.09);
      });
    } else if (cue === 'arrived') {
      // Pleasant arrival triad chime
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const offset = idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.35, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.4);
      });
    }
  } catch (err) {
    console.warn('Audio feedback failed or was blocked by autoplay policy:', err);
  }
}

/**
 * Triggers haptic vibration pattern for a given cue.
 * If vibration is unavailable or audio fallback is requested, also plays synthesized sound.
 */
export function triggerHapticCue(
  cue: CueType,
  options: { playSoundFallback?: boolean } = { playSoundFallback: true }
): { vibrated: boolean; pattern: number[]; text: string } {
  const patternInfo = hapticPatterns[cue];
  const pattern = patternInfo ? patternInfo.vibrate_ms : [200];
  const text = patternInfo ? patternInfo.text : cue;

  let vibrated = false;
  if (isVibrationSupported()) {
    try {
      vibrated = navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Vibration API error:', e);
    }
  }

  if (options.playSoundFallback) {
    playSynthesizedCueSound(cue);
  }

  return { vibrated, pattern, text };
}
