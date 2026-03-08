import { useCallback } from 'react';

const STORAGE_KEY = 'catshy_sound_alerts';

// Web Audio API beep - no external files needed
function playBeep(frequency = 880, duration = 150, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // Audio not supported
  }
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function useSoundAlert() {
  const playCritical = useCallback(() => {
    if (!isSoundEnabled()) return;
    // Two-tone urgent beep
    playBeep(880, 120, 0.25);
    setTimeout(() => playBeep(1100, 120, 0.25), 150);
  }, []);

  const playWarning = useCallback(() => {
    if (!isSoundEnabled()) return;
    playBeep(660, 100, 0.2);
  }, []);

  const playInfo = useCallback(() => {
    if (!isSoundEnabled()) return;
    playBeep(520, 80, 0.15);
  }, []);

  return { playCritical, playWarning, playInfo };
}
