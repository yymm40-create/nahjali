// «الرضا فويس» — the three small processors that run on the sound thread: the recorder (hands the microphone's raw
// samples to the page, nothing compressed), the noise gate and the de-esser. Plain JavaScript on purpose: the
// browser loads this file by address, live and when a project is rendered to a file.

class RidhaRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false;
    this.port.onmessage = (e) => {
      this.on = !!e.data.on;
    };
  }
  process(inputs) {
    const input = inputs[0];
    if (this.on && input && input[0]) {
      const frames = input.map((ch) => ch.slice());
      this.port.postMessage({ frames, time: currentTime }, frames.map((f) => f.buffer));
    }
    return true;
  }
}

class RidhaGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "threshold", defaultValue: -48, minValue: -100, maxValue: 0, automationRate: "k-rate" },
      { name: "range", defaultValue: -30, minValue: -100, maxValue: 0, automationRate: "k-rate" },
      { name: "hold", defaultValue: 120, minValue: 0, maxValue: 2000, automationRate: "k-rate" },
      { name: "release", defaultValue: 180, minValue: 1, maxValue: 4000, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.env = 0;
    this.gain = 1;
    this.open = 0;
  }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    if (!input || !input[0]) return true;
    const thr = Math.pow(10, params.threshold[0] / 20);
    const low = Math.pow(10, params.range[0] / 20);
    const hold = (params.hold[0] / 1000) * sampleRate;
    const att = Math.exp(-1 / (sampleRate * 0.003));
    const rel = Math.exp(-1 / (sampleRate * (params.release[0] / 1000)));
    const n = input[0].length;
    for (let i = 0; i < n; i++) {
      let a = 0;
      for (let c = 0; c < input.length; c++) a = Math.max(a, Math.abs(input[c][i]));
      this.env = Math.max(a, this.env * 0.9995);
      if (this.env > thr) this.open = hold;
      const want = this.open > 0 ? 1 : low;
      if (this.open > 0) this.open--;
      this.gain = want > this.gain ? att * this.gain + (1 - att) * want : rel * this.gain + (1 - rel) * want;
      for (let c = 0; c < output.length; c++) output[c][i] = (input[c] || input[0])[i] * this.gain;
    }
    return true;
  }
}

class RidhaDeEss extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "freq", defaultValue: 6000, minValue: 1000, maxValue: 16000, automationRate: "k-rate" },
      { name: "threshold", defaultValue: -30, minValue: -80, maxValue: 0, automationRate: "k-rate" },
      { name: "amount", defaultValue: 0.6, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    // two high-pass stages per channel (24 dB an octave); what is left under them is «the rest of the voice»
    this.s = [0, 1].map(() => ({ x1: 0, x2: 0, y1: 0, y2: 0, u1: 0, u2: 0, v1: 0, v2: 0 }));
    this.env = 0;
  }
  process(inputs, outputs, params) {
    const input = inputs[0], output = outputs[0];
    if (!input || !input[0]) return true;
    const w0 = (2 * Math.PI * params.freq[0]) / sampleRate;
    const cs = Math.cos(w0), alpha = Math.sin(w0) / Math.SQRT2;
    const a0 = 1 + alpha;
    const b0 = (1 + cs) / 2 / a0, b1 = -(1 + cs) / a0, b2 = b0, a1 = (-2 * cs) / a0, a2 = (1 - alpha) / a0;
    const thr = Math.pow(10, params.threshold[0] / 20);
    const power = params.amount[0] * 0.84;
    const att = Math.exp(-1 / (sampleRate * 0.001)), rel = Math.exp(-1 / (sampleRate * 0.06));
    const n = input[0].length;
    for (let i = 0; i < n; i++) {
      let peak = 0;
      const highs = [0, 0];
      for (let c = 0; c < output.length; c++) {
        const s = this.s[c] || this.s[0];
        const x = (input[c] || input[0])[i];
        const y = b0 * x + b1 * s.x1 + b2 * s.x2 - a1 * s.y1 - a2 * s.y2;
        s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y;
        const h = b0 * y + b1 * s.u1 + b2 * s.u2 - a1 * s.v1 - a2 * s.v2;
        s.u2 = s.u1; s.u1 = y; s.v2 = s.v1; s.v1 = h;
        highs[c] = h;
        peak = Math.max(peak, Math.abs(h));
      }
      this.env = peak > this.env ? att * this.env + (1 - att) * peak : rel * this.env + (1 - rel) * peak;
      const g = this.env > thr ? Math.pow(thr / this.env, power) : 1;
      for (let c = 0; c < output.length; c++) {
        const x = (input[c] || input[0])[i];
        output[c][i] = x - highs[c] + highs[c] * g;
      }
    }
    return true;
  }
}

registerProcessor("ridha-recorder", RidhaRecorder);
registerProcessor("ridha-gate", RidhaGate);
registerProcessor("ridha-deess", RidhaDeEss);
