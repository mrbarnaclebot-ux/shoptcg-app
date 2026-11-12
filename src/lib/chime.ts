// Two short tones plus a buzz. Browsers keep audio locked until a tap, so the
// "Sound on" toggle plays it once and any later tap unlocks it after a reload.
const KEY = "tcgmart:sound";
const EVENT = "tcgmart:sound";
let ctx: AudioContext | undefined;

export function soundOn() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Private mode: the toggle just won't survive a reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onSoundChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export const unlockAudio = () => void (ctx ??= new AudioContext()).resume();

export function chime() {
  unlockAudio();
  const c = ctx!;
  [880, 1175].forEach((hz, i) => {
    const at = c.currentTime + i * 0.16;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.2, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + 0.12);
  });
  navigator.vibrate?.([80, 60, 80]);
}
