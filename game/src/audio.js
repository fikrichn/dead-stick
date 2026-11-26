// Procedural audio for DEAD STICK: every sound is synthesised with the
// Web Audio API — engine rumble from filtered noise, the master-warning
// chime, switch clicks, a fire bell, a success tone and the crash.
// No audio file exists anywhere in the entry, so nothing loads late.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineGain = null;
  let muted = false;

  /** Must be called from a user gesture (the start screen click). */
  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    startEngine();
  }

  function startEngine() {
    // Two detuned low oscillators through a low-pass filter, plus a bed
    // of looped noise: the cabin rumble of a twinjet in descent.
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.16;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    engineGain.connect(filter);
    filter.connect(master);
    for (const freq of [52, 78.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(engineGain);
      osc.start();
    }
    const noiseLength = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;
    noise.connect(noiseGain);
    noiseGain.connect(engineGain);
    noise.start();
  }

  /** Engine loudness follows how many engines are alive and the throttle. */
  function setEngine(level) {
    if (!ctx || !engineGain) return;
    engineGain.gain.setTargetAtTime(0.03 + level * 0.2, ctx.currentTime, 0.4);
  }

  function tone(freq, seconds, type = 'sine', volume = 0.25, when = 0) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + when;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  return {
    init,
    setEngine,
    /** A cockpit switch being thrown. */
    click() {
      tone(1800, 0.05, 'square', 0.12);
      tone(900, 0.07, 'square', 0.08, 0.02);
    },
    /** The triple chime that means: look at the panel, now. */
    masterWarning() {
      for (let i = 0; i < 3; i++) {
        tone(880, 0.16, 'sine', 0.22, i * 0.22);
        tone(1174, 0.16, 'sine', 0.22, i * 0.22 + 0.02);
      }
    },
    /** A system coming back to life. */
    fixed() {
      tone(660, 0.14, 'sine', 0.2);
      tone(990, 0.22, 'sine', 0.2, 0.12);
    },
    /** Fire bell while an engine burns. */
    fireBell() {
      tone(1560, 0.1, 'square', 0.1);
      tone(1560, 0.1, 'square', 0.1, 0.16);
    },
    /** Gear clunk and airflow change. */
    gear() {
      tone(120, 0.3, 'sine', 0.3);
      tone(70, 0.4, 'sine', 0.25, 0.1);
    },
    /** The bad ending. */
    crash() {
      if (!ctx) return;
      tone(60, 1.4, 'sawtooth', 0.4);
      tone(38, 1.8, 'square', 0.3, 0.05);
      setEngine(0);
    },
    /** Rolling to a stop on the runway: the good ending. */
    touchdown() {
      tone(90, 0.35, 'sine', 0.35);
      tone(1320, 0.2, 'sine', 0.15, 0.3);
      tone(1760, 0.3, 'sine', 0.15, 0.5);
    },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
      return muted;
    },
  };
}
