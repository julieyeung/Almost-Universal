/* ---- core.js ---- */
/* ==========================================================
   core.js
   Data, small helpers, saved/history state and filter state.
   ========================================================== */

const D = window.SYMBOLS_DATA,
  S = D.syms,
  N = S.length;
const $ = (s) => document.querySelector(s),
  mod = (a, n) => ((a % n) + n) % n,
  cl = (v, a, b) => Math.min(b, Math.max(a, v)),
  BLUE = '#1A00FF';
const LS = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k)) || d;
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
let saved = LS.get('sym_saved', []),
  hist = LS.get('sym_hist', []),
  nav = [['map']];
const F = { sets: new Set(), shapes: new Set(), eras: new Set() };
const era = (i) => Math.floor(D.sets[S[i].s].y / 10) * 10 + 's';
const pass = (i) => {
  const s = S[i];
  return (
    (!F.sets.size || F.sets.has(s.s)) &&
    (!F.shapes.size || [...F.shapes].every((f) => s.fm.includes(f))) &&
    (!F.eras.size || F.eras.has(era(i)))
  );
};
const fActive = () => Object.values(F).some((x) => x.size);
let OK = new Uint8Array(N).fill(1);
const refilter = () => {
  for (let i = 0; i < N; i++) OK[i] = pass(i) ? 1 : 0;
  dirty = 1;
  arrange();
  if (['index', 'grid'].includes(view)) show(view, 1);
};

/* ---- symbols.js ---- */
/* ==========================================================
   symbols.js
   Helpers that turn a symbol into SVG or canvas drawing.
   ========================================================== */

/* ---------- symbol rendering helpers ---------- */
const P2 = {},
  p2 = (i) => P2[i] || (P2[i] = new Path2D(S[i].d));
const vb = (i) => (S[i].f ? [100, 100] : [S[i].w, S[i].h]);
function inner(i) {
  const s = S[i];
  if (!s.f) return `<path d="${s.d}"/>`;
  const k = 50 / Math.max(s.w, s.h);
  return `<polygon points="50,4 96,50 50,96 4,50" fill="#fff" stroke="#000" stroke-width="7.5"/><g transform="translate(${50 - (s.w * k) / 2} ${50 - (s.h * k) / 2}) scale(${k})"><path d="${s.d}"/></g>`;
}
const svgS = (i, c) => {
  const [w, h] = vb(i);
  return `<svg class="sv" viewBox="0 0 ${w} ${h}" ${c ? `style="color:${c}"` : ''}>${inner(i)}</svg>`;
};
const svgP = (i, k) => {
  const p = S[i].p[k],
    m = Math.max(S[i].w, S[i].h);
  return `<svg class="sv" viewBox="${p.cx - m / 2} ${p.cy - m / 2} ${m} ${m}"><path d="${p.d}"/></svg>`;
};
const svgPiece = (i, k) => svgP(i, k);
const setName = (i) => D.sets[S[i].s];
const title = (i) => `<u data-set="${S[i].s}">${setName(i).sh}</u> – ${S[i].n}`;
function drawSym(c, i, x, y, box, col) {
  const s = S[i];
  c.save();
  if (s.f) {
    const h = (box / 2) * 0.96;
    c.beginPath();
    c.moveTo(x, y - h);
    c.lineTo(x + h, y);
    c.lineTo(x, y + h);
    c.lineTo(x - h, y);
    c.closePath();
    c.fillStyle = '#fff';
    c.fill();
    c.lineWidth = box * 0.075;
    c.strokeStyle = col;
    c.stroke();
    const k = (box * 0.5) / Math.max(s.w, s.h);
    c.translate(x - (s.w * k) / 2, y - (s.h * k) / 2);
    c.scale(k, k);
  } else {
    const k = box / Math.max(s.w, s.h);
    c.translate(x - (s.w * k) / 2, y - (s.h * k) / 2);
    c.scale(k, k);
  }
  c.fillStyle = col;
  c.fill(p2(i), 'evenodd');
  c.restore();
}

/* ---- map.js ---- */
/* ==========================================================
   map.js
   Landing page, infinite explore map, hover, camera, similarity layout used by filters.
   ========================================================== */

/* ---------- landing + map ---------- */
const cv = $('#cv'),
  cx_ = cv.getContext('2d');
let vw,
  vh,
  dpr,
  dirty = 1,
  view = 'landing';
const CELL = 340,
  COLS = 26,
  ROWS = 18,
  TW = COLS * CELL,
  TH = ROWS * CELL,
  cam = { x: TW / 2, y: TH / 2, z: 0.8 },
  tg = { x: TW / 2, y: TH / 2, z: 0.8 };
function rng(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function scatterLayout(seed) {
  const R = rng(seed),
    cells = [...Array(COLS * ROWS).keys()];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return S.map((s, i) => {
    const c = cells[i % cells.length],
      sz = 140 + R() * 60,
      j = ((CELL - sz) / 2) * 0.7;
    return {
      x: ((c % COLS) + 0.5) * CELL + (R() - 0.5) * 2 * j,
      y: (Math.floor(c / COLS) + 0.5) * CELL + (R() - 0.5) * 2 * j,
      s: sz,
    };
  });
}
let HOME = scatterLayout(5);
const POS = HOME.map((p) => ({ ...p })),
  TGT = HOME.map((p) => ({ ...p }));
function moveSyms(dt) {
  let mv = 0;
  const k = 1 - Math.exp(-dt * 3.2);
  for (let i = 0; i < N; i++) {
    const p = POS[i],
      t = TGT[i];
    let dx = t.x - p.x,
      dy = t.y - p.y;
    dx -= Math.round(dx / TW) * TW;
    dy -= Math.round(dy / TH) * TH;
    if (Math.abs(dx) + Math.abs(dy) > 0.4 || Math.abs(t.s - p.s) > 0.3) {
      p.x = mod(p.x + dx * k, TW);
      p.y = mod(p.y + dy * k, TH);
      p.s += (t.s - p.s) * k;
      mv = 1;
    } else if (p.x !== t.x || p.y !== t.y || p.s !== t.s) {
      p.x = t.x;
      p.y = t.y;
      p.s = t.s;
      mv = 1;
    }
  }
  return mv;
}
/* similarity map: classical MDS on shape-token distance, then de-overlap */
function simLayout(ids) {
  const n = ids.length,
    T = ids.map((i) => new Set(S[i].fm)),
    AR = ids.map((i) => Math.log(S[i].w / S[i].h));
  const d2 = new Float64Array(n * n);
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      let it = 0;
      T[a].forEach((x) => {
        if (T[b].has(x)) it++;
      });
      const un = T[a].size + T[b].size - it;
      let d = un ? 1 - it / un : 0.5;
      if (!T[a].size || !T[b].size) d = T[a].size === T[b].size ? 0.5 : 1;
      d += Math.min(0.25, Math.abs(AR[a] - AR[b]) * 0.12);
      d2[a * n + b] = d2[b * n + a] = d * d;
    }
  const rm = new Float64Array(n);
  let gm = 0;
  for (let a = 0; a < n; a++) {
    let t = 0;
    for (let b = 0; b < n; b++) t += d2[a * n + b];
    rm[a] = t / n;
    gm += t / n;
  }
  gm /= n;
  const B = new Float64Array(n * n);
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) B[a * n + b] = -0.5 * (d2[a * n + b] - rm[a] - rm[b] + gm);
  const rg_ = rng(7),
    ev = [],
    lam = [];
  for (let e = 0; e < 2; e++) {
    let v = Float64Array.from({ length: n }, () => rg_() - 0.5),
      l = 0;
    for (let it = 0; it < 70; it++) {
      const w = new Float64Array(n);
      for (let a = 0; a < n; a++) {
        let t = 0;
        for (let b = 0; b < n; b++) t += B[a * n + b] * v[b];
        w[a] = t;
      }
      for (let q = 0; q < e; q++) {
        let dp = 0;
        for (let a = 0; a < n; a++) dp += w[a] * ev[q][a];
        for (let a = 0; a < n; a++) w[a] -= dp * ev[q][a];
      }
      let nm = 0;
      for (let a = 0; a < n; a++) nm += w[a] * w[a];
      nm = Math.sqrt(nm) || 1;
      l = nm;
      for (let a = 0; a < n; a++) v[a] = w[a] / nm;
    }
    ev.push(v);
    lam.push(l);
  }
  const md = 240;
  let X = ids.map((_, a) => [ev[0][a] * Math.sqrt(lam[0]), ev[1][a] * Math.sqrt(lam[1])]);
  let rms = Math.sqrt(X.reduce((t, p) => t + p[0] * p[0] + p[1] * p[1], 0) / n) || 1;
  const sc = (md * Math.sqrt(n) * 0.4) / rms;
  X = X.map((p) => [p[0] * sc + (rg_() - 0.5) * md * 0.3, p[1] * sc + (rg_() - 0.5) * md * 0.3]);
  for (let it = 0; it < 90; it++) {
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        let dx = X[b][0] - X[a][0],
          dy = X[b][1] - X[a][1],
          q = dx * dx + dy * dy;
        if (q < md * md) {
          const d = Math.sqrt(q) || 0.01,
            pu = ((md - d) / 2) * 0.55;
          if (d < 0.02) {
            dx = rg_() - 0.5;
            dy = rg_() - 0.5;
          } else {
            dx /= d;
            dy /= d;
          }
          X[a][0] -= dx * pu;
          X[a][1] -= dy * pu;
          X[b][0] += dx * pu;
          X[b][1] += dy * pu;
        }
      }
    for (const p of X) {
      p[0] *= 0.995;
      p[1] *= 0.995;
    }
  }
  return X;
}
function arrange() {
  if (!fActive()) {
    for (let i = 0; i < N; i++) Object.assign(TGT[i], HOME[i]);
    dirty = 1;
    return;
  }
  const ids = [];
  for (let i = 0; i < N; i++) if (OK[i]) ids.push(i);
  if (!ids.length) return;
  const X = simLayout(ids);
  let mx = 0,
    mean = [0, 0];
  X.forEach((p) => {
    mean[0] += p[0] / ids.length;
    mean[1] += p[1] / ids.length;
  });
  ids.forEach((i, k) => {
    const ox = X[k][0] - mean[0],
      oy = X[k][1] - mean[1];
    mx = Math.max(mx, Math.hypot(ox, oy));
    TGT[i] = { x: mod(tg.x + ox, TW), y: mod(tg.y + oy, TH), s: 170 };
  });
  tg.z = Math.min(tg.z, Math.max(0.16, (0.44 * Math.min(vw, vh)) / (mx + 130)));
  dirty = 1;
}
function scatterAgain() {
  Object.values(F).forEach((x) => x.clear());
  HOME.splice(0, N, ...scatterLayout(Date.now() % 100000));
  OK.fill(1);
  arrange();
  if (['index', 'grid'].includes(view)) show(view, 1);
  dirty = 1;
  if (flt.classList.contains('o')) fltRender();
}
const spr = {};
let sprBudget = 0;
function sprite(i) {
  if (spr[i]) return spr[i];
  if (sprBudget <= 0) return null;
  sprBudget--;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  drawSym(c.getContext('2d'), i, 128, 128, 236, '#000');
  return (spr[i] = c);
}
let VIS = [];
function draw() {
  dirty = 0;
  sprBudget = 8;
  cx_.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx_.clearRect(0, 0, vw, vh);
  const z = cam.z;
  VIS = [];
  const x0 = cam.x - vw / 2 / z - 300,
    x1 = cam.x + vw / 2 / z + 300,
    y0 = cam.y - vh / 2 / z - 300,
    y1 = cam.y + vh / 2 / z + 300;
  for (let tx = Math.floor(x0 / TW); tx <= Math.floor(x1 / TW); tx++)
    for (let ty = Math.floor(y0 / TH); ty <= Math.floor(y1 / TH); ty++)
      for (let i = 0; i < N; i++) {
        if (!OK[i]) continue;
        const p = POS[i],
          wx = p.x + tx * TW,
          wy = p.y + ty * TH;
        if (wx < x0 || wx > x1 || wy < y0 || wy > y1) continue;
        const sx = (wx - cam.x) * z + vw / 2,
          sy = (wy - cam.y) * z + vh / 2,
          b = p.s * z;
        VIS.push([i, sx, sy, b]);
        if (b < 1.5) continue;
        if (b <= 230) {
          const s = sprite(i);
          if (s) {
            cx_.drawImage(s, sx - (b / 2) * 1.08, sy - (b / 2) * 1.08, b * 1.08, b * 1.08);
          } else drawSym(cx_, i, sx, sy, b, '#000');
        } else drawSym(cx_, i, sx, sy, b, '#000');
      }
}
function resize() {
  vw = innerWidth;
  vh = innerHeight;
  dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = vw * dpr;
  cv.height = vh * dpr;
  dirty = 1;
}
/* hover */
const hv = $('#hv'),
  info = $('#info');
let hov = -1,
  hoverT;
function setHover(i, sx, sy, b) {
  if (i === hov) return;
  hov = i;
  clearTimeout(hoverT);
  const on = i >= 0;
  cv.classList.toggle('bl', on);
  if (on) {
    const [w, h] = vb(i),
      k = b / Math.max(w, h),
      W = w * k * 1.14,
      H = h * k * 1.14;
    hv.style.cssText = `left:${sx - W / 2}px;top:${sy - H / 2}px;width:${W}px;height:${H}px`;
    hv.innerHTML = svgS(i, BLUE);
    hv.classList.add('on');
    info.innerHTML = `<div class="t">${title(i)}</div><div class="d">${S[i].m !== S[i].n ? S[i].m + '. ' : ''}${S[i].x}</div>`;
    info.classList.add('on');
    $('#wm').style.visibility = 'hidden';
  } else {
    hv.classList.remove('on');
    hoverT = setTimeout(() => {
      if (hov < 0) {
        info.classList.remove('on');
        $('#wm').style.visibility = '';
      }
    }, 900);
  }
}
info.addEventListener('pointerenter', () => {
  clearTimeout(hoverT);
});
info.addEventListener('pointerleave', () => {
  if (hov < 0)
    hoverT = setTimeout(() => {
      if (hov < 0) {
        info.classList.remove('on');
        $('#wm').style.visibility = '';
      }
    }, 300);
});
function hit(mx, my) {
  let best = -1,
    bs = 1e9;
  for (const [i, sx, sy, b] of VIS) {
    const [w, h] = vb(i),
      k = b / Math.max(w, h),
      hw = Math.max(w * k, b * 0.28) / 2 + 4,
      hh = Math.max(h * k, b * 0.28) / 2 + 4;
    if (Math.abs(mx - sx) <= hw && Math.abs(my - sy) <= hh) {
      const d = Math.hypot(mx - sx, my - sy);
      if (d < bs) {
        bs = d;
        best = i;
        hit.v = [sx, sy, b];
      }
    }
  }
  return best;
}
/* camera */
function panBy(dx, dy) {
  tg.x -= dx / cam.z;
  tg.y -= dy / cam.z;
  dirty = 1;
}
function zoomAt(f, mx, my) {
  const nz = cl(tg.z * f, 0.14, 2.6),
    wx = tg.x + (mx - vw / 2) / tg.z,
    wy = tg.y + (my - vh / 2) / tg.z;
  tg.z = nz;
  tg.x = wx - (mx - vw / 2) / nz;
  tg.y = wy - (my - vh / 2) / nz;
  dirty = 1;
}

/* ---- views.js ---- */
/* ==========================================================
   views.js
   View manager, back/forward navigation, deconstruction page and shape ring.
   ========================================================== */

/* ---------- view manager ---------- */
let fwd = [];
function show(v, keep) {
  if (typeof intro != 'undefined' && intro && v != 'map') endIntro();
  view = v;
  document.body.dataset.v = v;
  $('#tIx').classList.toggle('on', v == 'index');
  $('#tMap').classList.toggle('on', v != 'index');
  if (v == 'map' || v == 'landing') {
    dirty = 1;
  }
  if (v == 'grid') buildGrid();
  if (v == 'index') buildIndex();
  if (v == 'history') buildHist();
  if (v == 'timeline') buildTL();
  if (v != 'map') {
    setHover(-1);
    info.classList.remove('on');
    $('#wm').style.visibility = '';
  }
  if (!keep && ['index', 'grid', 'history', 'timeline'].includes(v)) {
    nav = [[v]];
    fwd = [];
  }
  $('#nF').classList.toggle('off', !fwd.length);
}
function toMap() {
  fwd = [];
  closeAll();
  closeAbout();
  if (view == 'landing') leaveLanding();
  show('map');
  nav = [['map']];
}
function restore(e) {
  if (e[0] == 'decon') openDecon(e[1], 1);
  else if (e[0] == 'ring') openRing(e[1], e[2], 1);
  else if (e[0] == 'map') toMap();
  else show(e[0], 1);
}
function back() {
  if (nav.length > 1) {
    fwd.push(nav.pop());
    restore(nav[nav.length - 1]);
  } else toMap();
}
function forward() {
  if (!fwd.length) return;
  const e = fwd.pop();
  nav.push(e);
  restore(e);
}
$('#nF').onclick = forward;
$('#nBack').onclick = back;
$('#nHome').onclick = toMap;
function leaveLanding() {
  $('#land').classList.add('up');
  view = 'map';
}
$('#wm').onclick = () => {
  if (view == 'map') {
    $('#land').classList.remove('up');
    show('landing', 1);
  }
};
$('#tMap').onclick = toMap;
$('#tIx').onclick = () => {
  closeAll();
  $('#land').classList.add('up');
  show('index');
};
$('#bk').onclick = () => {
  closeAll();
  $('#land').classList.add('up');
  show('grid');
};
/* ---------- decon ---------- */
let cur = -1;
function addHist(i) {
  hist = [i, ...hist.filter((x) => x !== i)].slice(0, 80);
  LS.set('sym_hist', hist);
}
const saveIc = (i) =>
  `<svg class="sv2${saved.includes(i) ? ' f' : ''}" data-save="${i}" viewBox="0 0 40 52"><path d="M5 3H35V49L20 36 5 49Z"/></svg>`;
function descr(i) {
  return `${S[i].m !== S[i].n ? S[i].m + '. ' : ''}${S[i].x}`;
}
function openDecon(i, np) {
  cur = i;
  if (!np) {
    nav.push(['decon', i]);
    fwd = [];
  }
  addHist(i);
  closeAll();
  $('#land').classList.add('up');
  const ps = S[i].p,
    n = ps.length;
  if (n == 1 && !S[i].ndc) {
    nav.length && nav[nav.length - 1][0] == 'decon' && nav.pop();
    return openRing(i, 0, np ? 1 : 0);
  }
  const el = $('#decon');
  let h = '';
  const sz = `min(22vh,${Math.round(70 / Math.max(n, 2))}vw)`;
  ps.forEach((p, k) => {
    h += `<div class="pc" data-k="${k}" style="left:50%;top:56%;opacity:0;width:${sz};height:${sz}" data-x="${n == 1 ? 50 : n == 2 ? [30, 70][k] : 14 + (k / (n - 1)) * 72}" data-y="24">${svgP(i, k)}<span class="pl">${p.c}${p.r == 'f' ? ' · frame' : ''} · ${(D.cls[p.c] || []).length} symbols</span></div>`;
  });
  h += `<div class="whole" style="width:22vh;height:22vh;opacity:0;top:${n ? '56%' : '42%'}">${svgS(i, '#000')}</div><div class="cap" style="top:${n ? '71%' : '62%'}"><div class="t">${title(i)} ${saveIc(i)}</div><div class="d">${descr(i)}</div>${n ? '' : '<div class="d" style="opacity:.6;margin-top:.8vh">No common shapes or strokes: no other symbol shares a shape with this one.</div>'}</div>`;
  el.innerHTML = h;
  show('decon', 1);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.querySelectorAll('.pc').forEach((e) => {
        e.style.left = e.dataset.x + '%';
        e.style.top = e.dataset.y + '%';
        e.style.opacity = 1;
      });
      el.querySelector('.whole').style.opacity = 1;
    }),
  );
}
$('#decon').addEventListener('click', (e) => {
  const pc = e.target.closest('.pc');
  if (pc) {
    openRing(cur, +pc.dataset.k);
  }
});
/* ---------- ring ---------- */
let rg = null;
const K = 14;
const ringList = (sel) => {
  const L = sel.map((t) => D.cls[t] || []).reduce((a, b) => a.filter((x) => b.includes(x)));
  const L2 = L.filter((i) => OK[i]);
  return L2.length ? L2 : L;
};
function openRing(si, pk, np) {
  if (!np) {
    nav.push(['ring', si, pk]);
    fwd = [];
  }
  closeAll();
  rg = { si, pk, sel: [S[si].p[pk].c], rt: 0 };
  ringSet();
  show('ring', 1);
}
function ringSet() {
  const r = rg;
  let list = ringList(r.sel);
  if (list.includes(r.si)) list = [r.si, ...list.filter((i) => i !== r.si)];
  Object.assign(r, {
    list,
    n: list.length,
    p: 0,
    T: 0,
    vel: 0,
    hov: -1,
    slots: Math.min(K, list.length),
    t0: performance.now(),
  });
  const el = $('#ring');
  el.innerHTML = `<div class="cap" id="rcap"><div id="rtop"></div><div class="chips" id="rch"></div></div>`;
  r.els = [];
  for (let j = 0; j < r.slots; j++) {
    const d = document.createElement('div');
    d.className = 'ri';
    d._i = null;
    el.append(d);
    r.els.push(d);
  }
  ringCap(null);
  ringChips();
}
function ringCap(i) {
  const r = rg,
    bc = `<span class="bc">${svgP(r.si, r.pk)}</span>`,
    k = i != null && i >= 0 ? i : r.si;
  $('#rtop').innerHTML =
    `<div class="t">${bc}${title(k)} ${saveIc(k)}</div><div class="d">${descr(k)}</div>`;
}
function ringChips() {
  const r = rg,
    cnt = {};
  r.list.forEach((k) =>
    S[k].fm.forEach((t) => {
      if (!r.sel.includes(t)) cnt[t] = (cnt[t] || 0) + 1;
    }),
  );
  const opts = Object.entries(cnt)
    .filter(([t, c]) => c < r.n)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9);
  const trail = r.sel
    .map((t) =>
      r.sel.length > 1
        ? `<span class="nb" data-rm="${t}">${t} ×</span>`
        : `<span class="cur">${t}</span>`,
    )
    .join(' + ');
  $('#rch').innerHTML =
    `<div class="ct">${trail} <span class="mut">· ${r.n} ${r.n == 1 ? 'symbol' : 'symbols'}</span></div>` +
    (opts.length
      ? `<div class="co">${opts.map(([t, c]) => `<span class="nb" data-add="${t}">+ ${t} <small>${c}</small></span>`).join('')}</div>`
      : r.sel.length > 1 && r.n < 2
        ? '<div class="co"><span class="mut">Nothing else has this combination</span></div>'
        : '');
}
function ringFrame(now, dt) {
  const r = rg,
    K_ = r.slots,
    step = (2 * Math.PI) / K_,
    S_ = cl(Math.min(vw, vh) * 0.2, 110, 200);
  const auto = r.hov >= 0 || r.n <= K_ ? 0 : K_ / 70;
  r.vel *= Math.exp(-dt * 2.6);
  r.p += (auto + r.vel) * dt + (r.T - r.p) * (1 - Math.exp(-dt * 4)) * (r.snap ? 1 : 0);
  if (r.snap && Math.abs(r.T - r.p) < 0.002) r.snap = 0;
  const Rx = vw * (vw < 700 ? 0.36 : 0.4),
    Ry = vh * 0.31,
    cx = vw / 2,
    cy = vh * 0.46;
  r.els.forEach((e, j) => {
    const idx = j + K_ * Math.round((r.p - j) / K_);
    const th = (idx - r.p) * step,
      it = r.list[mod(idx, r.n)];
    if (e._i !== it) {
      e._i = it;
      e.innerHTML = svgS(it);
      e.dataset.i = it;
      e.className = 'ri' + (it === r.si ? ' src' : '');
    }
    const d = (1 + Math.cos(th)) / 2,
      ab = Math.abs(th),
      op = r.n > K_ ? cl((Math.PI - ab) / 0.8, 0, 1) : 1,
      pe = cl((now - r.t0 - j * 60) / 700, 0, 1),
      ea = 1 - Math.pow(1 - pe, 3);
    const hv_ = e.classList.contains('h') ? 1.18 : 1,
      sc = (0.82 + 0.28 * d) * ea * hv_;
    e.style.cssText = `width:${S_}px;height:${S_}px;opacity:${op * pe};display:${op ? 'block' : 'none'};z-index:${e.classList.contains('h') ? 200 : Math.round(d * 100)};transform:translate(${cx + Rx * Math.sin(th) - S_ / 2}px,${cy - Ry * Math.cos(th) - S_ / 2}px) scale(${sc})`;
  });
}
$('#ring').addEventListener('pointerover', (e) => {
  if (!rg) return;
  const it = e.target.closest('.ri');
  if (it) {
    clearTimeout(rg.rt);
    it.classList.add('h');
    rg.hov = +it.dataset.i;
    ringCap(rg.hov);
  } else if (e.target.closest('#rcap')) {
    clearTimeout(rg.rt);
    if (rg.hov >= 0) {
      rg.hov = -1;
      ringCap(null);
    }
  }
});
$('#ring').addEventListener('pointerout', (e) => {
  if (!rg) return;
  const it = e.target.closest('.ri');
  if (it) {
    it.classList.remove('h');
    clearTimeout(rg.rt);
    rg.rt = setTimeout(() => {
      rg.hov = -1;
      ringCap(null);
    }, 120);
  }
});
$('#ring').addEventListener('click', (e) => {
  const ad = e.target.closest('[data-add]'),
    rm = e.target.closest('[data-rm]');
  if (ad) {
    rg.sel.push(ad.dataset.add);
    ringSet();
    return;
  }
  if (rm) {
    rg.sel = rg.sel.filter((t) => t !== rm.dataset.rm);
    ringSet();
    return;
  }
  const it = e.target.closest('.ri');
  if (it) openDecon(+it.dataset.i);
});

/* ---- lists.js ---- */
/* ==========================================================
   lists.js
   Saved grid, Index table, History and Timeline.
   ========================================================== */

/* ---------- grid (saved) / index / history / timeline ---------- */
function buildGrid() {
  const l = saved.filter((i) => OK[i]);
  $('#gridc').innerHTML = l.length
    ? l
        .map(
          (i) =>
            `<div class="gc" data-i="${i}">${svgS(i)}<div class="gl">${title(i).replace(/<\/?u[^>]*>/g, '')}</div></div>`,
        )
        .join('')
    : '';
  $('#grid .empty')?.remove();
  if (!l.length)
    $('#grid').insertAdjacentHTML(
      'beforeend',
      '<div class="empty">Nothing saved yet. Use the bookmark beside a symbol’s name.</div>',
    );
}
$('#grid').addEventListener('click', (e) => {
  const c = e.target.closest('.gc');
  if (c) openDecon(+c.dataset.i);
});
function buildIndex() {
  const l = [...Array(N).keys()].filter((i) => OK[i]);
  if (l.length % 2) l.push(-1);
  const cell = (i) =>
    i < 0
      ? '<div class="y"></div><div></div><div></div>'
      : `<div class="y hv" data-i="${i}"><div>${svgS(i)}</div></div><div class="hv" data-i="${i}">${S[i].fm.join(', ')}</div><div class="hv" data-i="${i}"><b>${S[i].n}</b> · ${setName(i).sh}<br>${S[i].m !== S[i].n ? S[i].m + '. ' : ''}${S[i].x}</div>`;
  const hd =
    '<div class="h">Symbols</div><div class="h">Shape</div><div class="h">What is this</div>';
  let h = hd + hd;
  for (let k = 0; k < l.length; k += 2) h += cell(l[k]) + cell(l[k + 1]);
  $('#ixs').innerHTML =
    `<h1>INDEX${fActive() ? ' · filtered' : ''} <span style="font-weight:400;font-size:.6em">${l.filter((x) => x >= 0).length} symbols</span></h1><div class="ix">${h}</div>`;
}
$('#index').addEventListener('click', (e) => {
  const r = e.target.closest('[data-i]');
  if (r) openDecon(+r.dataset.i);
});
function buildHist() {
  const h = $('#hist');
  h.innerHTML = hist.length
    ? hist
        .map(
          (i) =>
            `<div class="hi" data-i="${i}"><div class="hs">${svgS(i)}</div><div class="hc">${S[i].n} · ${setName(i).sh}</div></div>`,
        )
        .join('')
    : '<div class="empty">Symbols you open will collect here.</div>';
  h.scrollLeft = 0;
}
$('#history').addEventListener('click', (e) => {
  const r = e.target.closest('.hi');
  if (r) openDecon(+r.dataset.i);
});
function buildTL() {
  const ss = D.sets.map((s, i) => ({ ...s, i })).sort((a, b) => a.y - b.y);
  let prev = ss[0].y,
    h =
      '<div id="tlc"><div id="tll"></div><svg id="tlp" viewBox="0 0 30 30"><path d="M3 2L27 15 3 28Z" fill="#fff" stroke="#000" stroke-width="3"/></svg>';
  ss.forEach((s, k) => {
    const gap = Math.min(14, (s.y - prev) / 10);
    prev = s.y;
    h += `<div class="tli" data-s="${s.i}" style="margin-left:${k ? gap * 1.6 : 6}vw"><img class="im" src="${D.im[s.im[0]]}" alt="${s.n}"><div class="tx"><b>${s.n}</b><br><br>${s.x}<br><br><u data-set="${s.i}">Open symbol set</u></div><div class="yr"><b>${Math.floor(s.y / 10) * 10}s</b>${s.sh}</div></div>`;
  });
  $('#tl').innerHTML = h + '</div>';
  $('#tl').scrollLeft = 0;
  $('#tl')
    .querySelectorAll('img')
    .forEach((im) => (im.onload = updTri));
  updTri();
}
$('#timeline').addEventListener('click', (e) => {
  const t = e.target.closest('.tli .im');
  if (t) {
    t.closest('.tli').classList.toggle('o');
  }
});

/* ---- panels.js ---- */
/* ==========================================================
   panels.js
   Side menu, About overlay, set pages and the filter panel.
   ========================================================== */

/* ---------- side panels ---------- */
const side = $('#side'),
  sc = $('#sc');
function closeAll() {
  side.classList.remove('o');
  $('#flt').classList.remove('o');
}
function openSide(h, wide) {
  $('#flt').classList.remove('o');
  sc.innerHTML = h;
  side.classList.toggle('wide', !!wide);
  side.classList.add('o');
  side.scrollTop = 0;
}
$('#sx').onclick = closeAll;
const ABOUT =
  'This page is devoted to the exploration and research of pictography. Our expanding web archive showcases a diverse range of works centered around pictograms and language systems. We welcome artistic, graphic, or research-based projects that contribute valuable ideas to the discourse.';
const ab = $('#about');
function openAbout() {
  closeAll();
  ab.classList.add('o');
  requestAnimationFrame(() => ab.classList.add('v'));
}
function closeAbout() {
  ab.classList.remove('v');
  setTimeout(() => {
    if (!ab.classList.contains('v')) ab.classList.remove('o');
  }, 400);
}
function toLanding() {
  closeAll();
  closeAbout();
  $('#land').classList.remove('up');
  show('landing', 1);
  view = 'landing';
  dirty = 1;
}
$('#abg').onclick = toLanding;
$('#abh').onclick = toLanding;
function menu(open) {
  openSide(
    `<div class="mn"><h2 data-about="1">About +</h2><br><h2 data-go="history">History</h2><br><h2 data-go="timeline">Timeline</h2><p style="margin:.7em 0 .3em">Symbol Sets:</p><ul>${D.sets.map((s, i) => `<li data-set="${i}">${s.n}</li>`).join('')}</ul></div>`,
  );
}
function setPanel(i) {
  const s = D.sets[i],
    ids = S.map((x, k) => k).filter((k) => S[k].s == i);
  openSide(
    `<div class="gb" data-back="1"><span class="gh">☜</span><u>Go Back</u></div><div class="st">${s.n}</div>${s.im.map((k) => `<img class="sim" src="${D.im[k]}" alt="">`).join('')}<div class="sp">${s.x}</div><div class="sp" style="opacity:.7">${s.y}${s.y < 1900 ? 's' : ''} · ${s.cnt} symbols in this archive</div><div class="sg">${ids.map((k) => `<div data-i="${k}" title="${S[k].n}">${svgS(k)}</div>`).join('')}</div>`,
    1,
  );
}
side.addEventListener('click', (e) => {
  const t = e.target;
  let n;
  if (t.closest('[data-back]')) {
    menu();
    return;
  }
  if ((n = t.closest('[data-about]'))) {
    openAbout();
  } else if ((n = t.closest('[data-go]'))) {
    closeAll();
    $('#land').classList.add('up');
    show(n.dataset.go);
  } else if ((n = t.closest('[data-set]'))) setPanel(+n.dataset.set);
  else if ((n = t.closest('[data-i]'))) {
    closeAll();
    openDecon(+n.dataset.i);
  }
});
$('#hb').onclick = () => menu();
document.addEventListener(
  'click',
  (e) => {
    const u = e.target.closest('[data-set]');
    if (u && !side.contains(u) && !u.closest('.tli')) {
      e.stopPropagation();
      setPanel(+u.dataset.set);
    }
    const sv = e.target.closest('[data-save]');
    if (sv) {
      const i = +sv.dataset.save;
      saved = saved.includes(i) ? saved.filter((x) => x !== i) : [i, ...saved];
      LS.set('sym_saved', saved);
      sv.classList.toggle('f', saved.includes(i));
    }
  },
  true,
);
$('#timeline').addEventListener('click', (e) => {
  const u = e.target.closest('[data-set]');
  if (u) setPanel(+u.dataset.set);
});
/* ---------- filter ---------- */
const flt = $('#flt');
let fo = {};
const FR_ = ['Circle', 'Oval', 'Square', 'Rectangle', 'Triangle', 'Diamond'],
  ST_ = ['Horizontal line', 'Vertical line', 'Diagonal line', 'Curve', 'Dot', 'Heart', 'Face'];
fo = {};
function fltHtml() {
  const sec = (id, fk, t, items) =>
    `<h3 data-sec="${id}">${t} ${fo[id] ? '–' : '+'}</h3>${fo[id] ? `<ul>${items.map(([v, l]) => `<li data-fk="${fk}" data-v="${v}" class="${F[fk].has(v) ? 's' : ''}">${l}</li>`).join('')}</ul>` : ''}`;
  const cn = (t) => `${t} <small>${(D.cls[t] || []).length}</small>`,
    has = (t) => D.cls[t];
  const ins = Object.keys(D.cls)
    .filter((t) => t.endsWith(' inside'))
    .sort((a, b) => D.cls[b].length - D.cls[a].length);
  const kinds = ['Person', 'Solid symbol'].filter(has);
  return (
    `<button id="sx2" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M3 3L21 21M21 3L3 21"/></svg></button>${fActive() ? '<div class="fb"><span id="fclr">Clear</span></div>' : ''}` +
    sec(
      'frames',
      'shapes',
      'Frames',
      FR_.filter(has).map((t) => [t, cn(t)]),
    ) +
    sec(
      'strokes',
      'shapes',
      'Strokes',
      ST_.filter(has).map((t) => [t, cn(t)]),
    ) +
    sec(
      'inside',
      'shapes',
      'Inside a frame',
      ins.map((t) => [t, `${t.replace(' inside', '')} <small>${D.cls[t].length}</small>`]),
    ) +
    sec(
      'kinds',
      'shapes',
      'Whole symbols',
      kinds.map((t) => [t, cn(t)]),
    ) +
    sec(
      'sets',
      'sets',
      'Symbol Set',
      D.sets.map((s, i) => [i, s.sh]),
    ) +
    sec(
      'eras',
      'eras',
      'Era',
      [...new Set(D.sets.map((s) => Math.floor(s.y / 10) * 10 + 's'))].map((e) => [e, e]),
    )
  );
}
function fltRender() {
  flt.innerHTML = fltHtml();
}
$('#fl').onclick = () => {
  side.classList.remove('o');
  fltRender();
  flt.classList.toggle('o');
};
flt.addEventListener('click', (e) => {
  if (e.target.closest('#sx2')) {
    flt.classList.remove('o');
    return;
  }
  if (e.target.id == 'fclr') {
    Object.values(F).forEach((s) => s.clear());
    refilter();
    fltRender();
    return;
  }
  if (e.target.id == 'fscat') {
    scatterAgain();
    return;
  }
  const li = e.target.closest('li[data-fk]');
  if (li) {
    const k = li.dataset.fk;
    let v = li.dataset.v;
    if (k == 'sets') v = +v;
    F[k].has(v) ? F[k].delete(v) : F[k].add(v);
    refilter();
    fltRender();
    return;
  }
  const h = e.target.closest('[data-sec]');
  if (h) {
    fo[h.dataset.sec] = !fo[h.dataset.sec];
    fltRender();
  }
});
$('#rs').onclick = () => {
  closeAll();
  scatterAgain();
  if (view != 'map' && view != 'landing') {
    if (['index', 'grid'].includes(view)) {
    } else toMap();
  }
};

/* ---- main.js ---- */
/* ==========================================================
   main.js
   Pointer / wheel / keyboard input, intro page and the animation loop.
   ========================================================== */

/* ---------- input ---------- */
let dr = null,
  pts = new Map(),
  pinch = 0;
addEventListener('pointerdown', (e) => {
  if (intro) return;
  if (e.target.closest('#side,#flt,#bar,.ic,.scr,.pc,.ri,#info,#nv,#nF')) return;
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size == 2) {
    const [a, b] = [...pts.values()];
    pinch = Math.hypot(a[0] - b[0], a[1] - b[1]);
    dr = null;
    return;
  }
  dr = { x: e.clientX, y: e.clientY, mv: 0, t: e.target, vx: 0, vy: 0 };
  if (view == 'map') cv.classList.add('drag');
});
addEventListener('pointermove', (e) => {
  if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size == 2 && view == 'map') {
    const [a, b] = [...pts.values()],
      d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) zoomAt(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    pinch = d;
    return;
  }
  if (dr) {
    const dx = e.clientX - dr.x,
      dy = e.clientY - dr.y;
    dr.x = e.clientX;
    dr.y = e.clientY;
    dr.mv += Math.abs(dx) + Math.abs(dy);
    if (view == 'map') {
      panBy(dx, dy);
      dr.vx = dr.vx * 0.6 + dx * 0.4;
      dr.vy = dr.vy * 0.6 + dy * 0.4;
      setHover(-1);
    } else if (view == 'landing' && dy < -24) goDown();
    else if (view == 'ring' && rg) {
      rg.vel -= (dx + dy) * 0.012;
    }
  } else if (
    view == 'map' &&
    !intro &&
    e.pointerType != 'touch' &&
    !e.target.closest('#info,#side,#flt,#bar,.ic')
  ) {
    const i = hit(e.clientX, e.clientY);
    if (i >= 0) {
      const [sx, sy, b] = hit.v;
      setHover(i, sx, sy, b);
    } else setHover(-1);
  }
});
addEventListener('pointerup', (e) => {
  pts.delete(e.pointerId);
  if (pts.size < 2) pinch = 0;
  cv.classList.remove('drag');
  if (!dr) return;
  const d = dr;
  dr = null;
  if (view == 'map') {
    if (d.mv > 6) {
      mom.x = d.vx;
      mom.y = d.vy;
      return;
    }
    const i = hit(e.clientX, e.clientY);
    if (i >= 0) openDecon(i);
  } else if (view == 'landing' && d.mv < 6) goDown();
});
const mom = { x: 0, y: 0 };
let intro = false,
  introDone = false;
function showIntro() {
  intro = true;
  introDone = true;
  $('#intro').classList.add('on');
  cv.classList.add('intro');
  $('#wm').style.visibility = 'hidden';
}
function endIntro() {
  if (!intro) return;
  intro = false;
  $('#intro').classList.remove('on');
  cv.classList.remove('intro');
  $('#wm').style.visibility = '';
}
$('#got').onclick = endIntro;
function goDown() {
  if (view != 'landing') return;
  nav = [['map']];
  $('#land').classList.add('up');
  view = 'map';
  document.body.dataset.v = 'map';
  dirty = 1;
  $('#tMap').classList.add('on');
  if (!introDone) showIntro();
}
addEventListener(
  'wheel',
  (e) => {
    if (e.target.closest('#side,#flt,.scr')) return;
    e.preventDefault();
    if (intro) return;
    if (view == 'landing') {
      if (e.deltaY > 4) goDown();
      return;
    }
    if (view == 'map') {
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
      setHover(-1);
    } else if (view == 'ring' && rg) {
      rg.vel += cl(e.deltaY + e.deltaX, -120, 120) * 0.0042;
    }
  },
  { passive: false },
);
function updTri() {
  const el = $('#tl'),
    tp = $('#tlp');
  if (!tp) return;
  const mx = Math.max(1, el.scrollWidth - el.clientWidth),
    p = el.scrollLeft / mx,
    w = tp.getBoundingClientRect().width || 30;
  tp.style.left = el.scrollLeft + p * (el.clientWidth - w) + 'px';
}
function hscroll(el, onS) {
  let t = 0,
    raf = 0,
    drag = null;
  const anim = () => {
    const d = t - el.scrollLeft;
    if (Math.abs(d) < 0.6) {
      el.scrollLeft = t;
      raf = 0;
      return;
    }
    el.scrollLeft += d * 0.16;
    raf = requestAnimationFrame(anim);
  };
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const mx = el.scrollWidth - el.clientWidth;
      if (!raf) t = el.scrollLeft;
      t = cl(t + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY), 0, mx);
      if (!raf) raf = requestAnimationFrame(anim);
    },
    { passive: false },
  );
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType == 'touch') return;
    drag = { x: e.clientX, s: el.scrollLeft, m: 0 };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.m = Math.max(drag.m, Math.abs(dx));
    if (drag.m > 5) {
      el.scrollLeft = drag.s - dx;
      t = el.scrollLeft;
    }
  });
  addEventListener('pointerup', () => {
    if (drag && drag.m > 6) {
      el._moved = 1;
      setTimeout(() => (el._moved = 0), 60);
    }
    drag = null;
  });
  el.addEventListener(
    'click',
    (e) => {
      if (el._moved) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );
  el.addEventListener('scroll', () => {
    if (!raf) t = el.scrollLeft;
    onS && onS();
  });
}
hscroll($('#hist'));
hscroll($('#tl'), updTri);
addEventListener('resize', updTri);
addEventListener('keydown', (e) => {
  if (e.key == 'Escape' || e.key == 'Backspace') {
    if (ab.classList.contains('o')) {
      closeAbout();
      return;
    }
    if (side.classList.contains('o') || flt.classList.contains('o')) {
      closeAll();
      return;
    }
    if (['decon', 'ring'].includes(view)) back();
    else if (view != 'map' && view != 'landing') toMap();
  }
  if (view == 'map') {
    if (e.key == '+' || e.key == '=') zoomAt(1.25, vw / 2, vh / 2);
    if (e.key == '-') zoomAt(0.8, vw / 2, vh / 2);
  }
});
/* ---------- loop ---------- */
let last = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (view == 'map' || view == 'landing') {
    if (Math.abs(mom.x) + Math.abs(mom.y) > 0.2) {
      panBy(mom.x, mom.y);
      const f = Math.pow(0.02, dt);
      mom.x *= f;
      mom.y *= f;
    }
    const k = 1 - Math.exp(-dt * 9);
    const dx = tg.x - cam.x,
      dy = tg.y - cam.y,
      dz = tg.z - cam.z;
    if (Math.abs(dx) + Math.abs(dy) > 0.05 || Math.abs(dz) > 0.0005) {
      cam.x += dx * k;
      cam.y += dy * k;
      cam.z += dz * k;
      dirty = 1;
    }
    if (view == 'landing' && !cam._d) {
      cam._d = 1;
    }
    if (moveSyms(dt)) dirty = 1;
    if (dirty || sprBudget < 8) draw();
  } else if (view == 'ring' && rg) ringFrame(now, dt);
  requestAnimationFrame(loop);
}
addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);

