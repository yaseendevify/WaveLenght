import { SC } from "./data.js";
let cur = null,
  vol = 0.8;
const rmP = new Audio(),
  rmF = new Audio();
rmP.preload = "auto";
rmF.preload = "auto";
rmF.crossOrigin = "anonymous";
let rm = rmP,
  isRemote = false;
const fxBad = new Set();
const GEN = {
  lofi: {
    pad: ["triangle", 0.04, 1200],
    bass: [0, 6, 10],
    bt: "triangle",
    bg: 0.15,
    bl: 3,
    blp: 600,
    bo: 2,
    k: [0, 10],
    s: [4, 12],
    h: [0, 2, 4, 6, 8, 10, 12, 14],
    ls: 2,
    ll: 1.5,
  },
  synthwave: {
    pad: ["sawtooth", 0.03, 900],
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
    bt: "sawtooth",
    bg: 0.09,
    bl: 1.6,
    blp: 500,
    bo: 2,
    k: [0, 4, 8, 12],
    s: [4, 12],
    h: [2, 6, 10, 14],
    ls: 2,
    ll: 1.6,
  },
  ambient: {
    pad: ["sine", 0.07, 2000],
    bass: [0],
    bt: "sine",
    bg: 0.1,
    bl: 16,
    blp: 400,
    bo: 2,
    k: [],
    s: [],
    h: [],
    ls: 4,
    ll: 7,
  },
  pop: {
    pad: ["sawtooth", 0.025, 1500],
    bass: [0, 3, 6, 8, 11, 14],
    bt: "triangle",
    bg: 0.15,
    bl: 2,
    blp: 700,
    bo: 2,
    k: [0, 4, 8, 12],
    s: [4, 12],
    h: [2, 6, 10, 14],
    ls: 2,
    ll: 1.6,
  },
  trap: {
    pad: ["sawtooth", 0.02, 800],
    bass: [0, 7, 10],
    bt: "sine",
    bg: 0.3,
    bl: 4,
    blp: 300,
    bo: 4,
    k: [0, 7, 10],
    s: [8],
    h: "all",
    ls: 2,
    ll: 1.2,
  },
};
let ac,
  master,
  an,
  noiseBuf,
  sess,
  leadBus,
  seqT,
  songStart = 0,
  nextStep = 0;
const audioEl = new Audio();
audioEl.preload = "auto";
const rnd = (sd, s) => {
  const x = Math.sin(sd * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function ctxInit() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain();
  const cp = ac.createDynamicsCompressor();
  an = ac.createAnalyser();
  an.fftSize = 128;
  master.gain.value = vol;
  buildFx(cp);
  cp.connect(an);
  an.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  try {
    ac.createMediaElementSource(audioEl).connect(master);
  } catch (e) {}
  try {
    ac.createMediaElementSource(rmF).connect(master);
  } catch (e) {}
}
const FREQ = [60, 230, 910, 3600, 14000],
  fx = { bass: 0, pre: 0, bands: [0, 0, 0, 0, 0], spatial: false };
let preN,
  bassN,
  eqN = [],
  panN,
  lfoG;
function buildFx(cp) {
  preN = ac.createGain();
  bassN = ac.createBiquadFilter();
  bassN.type = "lowshelf";
  bassN.frequency.value = 90;
  eqN = FREQ.map((f, i) => {
    const b = ac.createBiquadFilter();
    b.type = i === 0 ? "lowshelf" : i === 4 ? "highshelf" : "peaking";
    b.frequency.value = f;
    b.Q.value = 1;
    return b;
  });
  panN = ac.createStereoPanner();
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.12;
  lfoG = ac.createGain();
  lfoG.gain.value = 0;
  lfo.connect(lfoG);
  lfoG.connect(panN.pan);
  lfo.start();
  let n = master;
  [preN, bassN, ...eqN, panN].forEach((x) => {
    n.connect(x);
    n = x;
  });
  n.connect(cp);
  applyFx();
}
function applyFx() {
  if (!ac || !preN) return;
  const t = ac.currentTime,
    head = Math.max(0, fx.bass, ...fx.bands) * 0.45;
  preN.gain.setTargetAtTime(Math.pow(10, (fx.pre - head) / 20), t, 0.03);
  bassN.gain.setTargetAtTime(fx.bass, t, 0.03);
  eqN.forEach((b, i) => b.gain.setTargetAtTime(fx.bands[i], t, 0.03));
  lfoG.gain.setTargetAtTime(fx.spatial ? 1 : 0, t, 0.1);
}
export const setFx = (p) => {
  if (p.bass !== undefined) fx.bass = +p.bass || 0;
  if (p.pre !== undefined) fx.pre = +p.pre || 0;
  if (Array.isArray(p.bands))
    fx.bands = [0, 1, 2, 3, 4].map((i) => +p.bands[i] || 0);
  if (p.spatial !== undefined) fx.spatial = !!p.spatial;
  applyFx();
};
export const fxOn = () => !isRemote || rm === rmF;
function osc(type, f, t, dur, g, dest, o = {}) {
  const a = o.a || 0.01,
    r = o.r || 0.1,
    s = ac.createOscillator(),
    v = ac.createGain();
  s.type = type;
  s.frequency.value = f;
  v.gain.setValueAtTime(0, t);
  v.gain.linearRampToValueAtTime(g, t + a);
  v.gain.setValueAtTime(g, Math.max(t + a, t + dur - r));
  v.gain.linearRampToValueAtTime(0, t + dur + 0.02);
  let n = s;
  if (o.lp) {
    const l = ac.createBiquadFilter();
    l.type = "lowpass";
    l.frequency.value = o.lp;
    s.connect(l);
    n = l;
  }
  n.connect(v);
  v.connect(dest);
  s.start(t);
  s.stop(t + dur + 0.06);
}
function noise(t, dur, g, ft, ff, dest) {
  const s = ac.createBufferSource(),
    f = ac.createBiquadFilter(),
    v = ac.createGain();
  s.buffer = noiseBuf;
  f.type = ft;
  f.frequency.value = ff;
  v.gain.setValueAtTime(g, t);
  v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f);
  f.connect(v);
  v.connect(dest);
  s.start(t);
  s.stop(t + dur + 0.02);
}
function kick(t, d) {
  const s = ac.createOscillator(),
    v = ac.createGain();
  s.frequency.setValueAtTime(130, t);
  s.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  v.gain.setValueAtTime(0.55, t);
  v.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  s.connect(v);
  v.connect(d);
  s.start(t);
  s.stop(t + 0.27);
}
function step(tr, s, t, sd, d, lb) {
  const g = GEN[tr.g],
    bar = s >> 4,
    st = s & 15,
    deg = tr.prog[bar % tr.prog.length];
  const n = (x) =>
    mtof(tr.root + 12 * Math.floor(x / 7) + SC[tr.sc][((x % 7) + 7) % 7]);
  if (st === 0) {
    const ds = [deg, deg + 2, deg + 4];
    if (tr.g === "lofi" || tr.g === "ambient") ds.push(deg + 6);
    for (const x of ds)
      osc(g.pad[0], n(x), t, sd * 16, g.pad[1], d, {
        a: 0.35,
        r: 0.8,
        lp: g.pad[2],
      });
  }
  if (g.bass.includes(st))
    osc(g.bt, n(deg) / g.bo, t, sd * g.bl, g.bg, d, { lp: g.blp });
  if (g.k.includes(st)) kick(t, d);
  if (g.s.includes(st)) {
    noise(t, 0.14, 0.22, "bandpass", 1800, d);
    osc("triangle", 190, t, 0.08, 0.12, d);
  }
  if (g.h === "all" || g.h.includes(st))
    noise(
      t + (tr.g === "lofi" && st % 4 === 2 ? sd * 0.18 : 0),
      0.045,
      0.03 + 0.05 * rnd(tr.seed + 2, s),
      "highpass",
      7000,
      d,
    );
  if (st % g.ls === 0 && rnd(tr.seed, s) < tr.dens) {
    const cs = [deg, deg + 2, deg + 4, deg + 7, deg + 9];
    osc(
      tr.lead,
      n(cs[(rnd(tr.seed + 1, s) * 5) | 0]) * 2,
      t,
      sd * g.ll,
      0.05,
      lb,
      { lp: 2800 },
    );
  }
}
function sched(my, lb) {
  const tr = cur;
  if (sess !== my || !tr) return;
  const sd = 60 / tr.bpm / 4;
  while (songStart + nextStep * sd < ac.currentTime + 1.1) {
    step(tr, nextStep, songStart + nextStep * sd, sd, my, lb);
    nextStep++;
  }
  seqT = setTimeout(() => sched(my, lb), 100);
}
function stopSynth() {
  clearTimeout(seqT);
  if (sess) {
    const s = sess;
    sess = null;
    try {
      s.gain.setTargetAtTime(0, ac.currentTime, 0.02);
    } catch (e) {}
    setTimeout(() => {
      try {
        s.disconnect();
      } catch (e) {}
    }, 200);
  }
}
function startSynth(off) {
  ctxInit();
  stopSynth();
  const my = ac.createGain();
  my.connect(master);
  sess = my;
  leadBus = ac.createGain();
  leadBus.connect(my);
  const dl = ac.createDelay(1),
    fb = ac.createGain(),
    dg = ac.createGain();
  dl.delayTime.value = (60 / cur.bpm) * 0.75;
  fb.gain.value = 0.35;
  dg.gain.value = 0.4;
  leadBus.connect(dl);
  dl.connect(fb);
  fb.connect(dl);
  dl.connect(dg);
  dg.connect(my);
  songStart = ac.currentTime - off;
  nextStep = Math.ceil(off / (60 / cur.bpm / 4));
  sched(my, leadBus);
}

let fbuf = null,
  fid = null,
  fsrc = null,
  tok = 0,
  isFile = false;
const stopF = () => {
  tok++;
  if (fsrc) {
    try {
      fsrc.stop();
    } catch (e) {}
    try {
      fsrc.disconnect();
    } catch (e) {}
    fsrc = null;
  }
};
export async function play(t, off, getBlob) {
  cur = t;
  isRemote = !!t.url;
  ctxInit();
  ac.resume();
  stopSynth();
  stopF();
  isFile = !!t.file;
  if (isRemote) {
    const my = ++tok;
    const go = async (el) => {
      if (el.src !== t.url) el.src = t.url;
      el.volume = el === rmF ? 1 : vol;
      el.currentTime = off || 0;
      await el.play();
    };
    rmP.pause();
    rmF.pause();
    if (!fxBad.has(t.g)) {
      rm = rmF;
      try {
        await go(rmF);
        return true;
      } catch (er) {
        if (my !== tok) return null;
        if (er && er.name === "NotAllowedError") return false;
        fxBad.add(t.g);
        rmF.pause();
      }
    }
    rm = rmP;
    try {
      await go(rmP);
      return true;
    } catch (er) {
      return my === tok ? false : null;
    }
  }
  rmP.pause();
  rmF.pause();
  if (!isFile) {
    startSynth(off || 0);
    return true;
  }
  const my = ++tok;
  songStart = ac.currentTime;
  try {
    if (fid !== t.id) {
      fbuf = null;
      const b = await getBlob(t.id);
      const buf = await ac.decodeAudioData(await b.arrayBuffer());
      if (my !== tok) return null;
      fbuf = buf;
      fid = t.id;
    }
  } catch (e) {
    return my === tok ? false : null;
  }
  if (my !== tok) return null;
  const s = ac.createBufferSource();
  s.buffer = fbuf;
  s.connect(master);
  songStart = ac.currentTime - (off || 0);
  s.start(0, off || 0);
  fsrc = s;
  return true;
}
export const pause = () => {
  rmP.pause();
  rmF.pause();
  if (ac) ac.suspend();
};
export const resume = () => {
  if (ac) ac.resume();
  if (isRemote) rm.play().catch(() => {});
};
export const pos = () =>
  isRemote
    ? rm.currentTime
    : cur && ac
      ? Math.max(0, ac.currentTime - songStart)
      : 0;
export const dur = () =>
  cur
    ? isRemote
      ? rm.duration && isFinite(rm.duration)
        ? rm.duration
        : cur.dur || 0
      : isFile
        ? fbuf && fid === cur.id
          ? fbuf.duration
          : cur.dur || 0
        : cur.dur
    : 0;
export const ended = () =>
  !!(
    cur &&
    (isRemote
      ? rm.ended
      : ac &&
        (isFile
          ? fsrc && fbuf && pos() >= fbuf.duration - 0.05
          : pos() >= cur.dur - 0.05))
  );
export const stopAll = () => {
  stopSynth();
  stopF();
  rmP.pause();
  rmF.pause();
  isRemote = false;
  cur = null;
};
export const setVol = (v) => {
  vol = v;
  rmP.volume = v;
  if (master) master.gain.value = v;
};
export async function decodeDur(f) {
  ctxInit();
  return (await ac.decodeAudioData(await f.arrayBuffer())).duration;
}
