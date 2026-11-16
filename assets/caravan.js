(() => {
// ---------- story ----------
const STOPS = window.STORY.stops;
// the road is a loop: camp, six chapters, and back to the same camp
const GAP = 300, NCH = STOPS.length, LOOP = NCH * GAP;
const chap = k => ((k % NCH) + NCH) % NCH, mod = (a, m) => ((a % m) + m) % m;

// ---------- the real calendar: the season, tonight's moon, Ramadan and Eid ----------
const TODAY = (() => { const d = new URLSearchParams(location.hash.slice(1)).get('date'); return d ? new Date(d) : new Date(); })();
const MONTH = TODAY.getMonth(), WINTER = MONTH === 11 || MONTH <= 1, SUMMER = MONTH >= 5 && MONTH <= 7;
const MOON = (((TODAY - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1 + 1) % 1;   // 0 new, .5 full
const HIJRI = (() => {
  try {
    const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric' }).formatToParts(TODAY);
    return { m: +p.find(x => x.type === 'month').value, d: +p.find(x => x.type === 'day').value };
  } catch (e) { return null; }
})();
const LANTERNS = !!HIJRI && (HIJRI.m === 9 || (HIJRI.m === 10 && HIJRI.d <= 3) || (HIJRI.m === 12 && HIJRI.d >= 10 && HIJRI.d <= 13));

// ---------- screen ----------
const jr = document.getElementById('jr'), cv = document.getElementById('cv'), cx = cv.getContext('2d');
const VH = 180, GROUND = 140, HORIZON = 112, MIDB = 128;
let VW = 320, SC = 4, img, buf, stampBuf, TSX = 100, frameId = 1;
let cvTop = 0, bgKey = '';
function resize() {
  const w = jr.clientWidth, h = jr.clientHeight;
  // whole-pixel zoom from the height, unless that leaves too little road across a narrow screen:
  // then zoom out so a whole stop (camel, sign and props) fits the width
  SC = Math.max(1, Math.floor(h / VH));
  if (w / SC < 220) SC = Math.max(1, w / 196);
  VW = Math.ceil(w / SC);
  cv.width = VW; cv.height = VH; cv.style.width = VW * SC + 'px'; cv.style.height = VH * SC + 'px';
  // tall screens: the scene sits just above the dialog box, the sky carries on above it and the sand below
  const free = h - VH * SC;
  cvTop = free > 0 && h > w ? Math.max(0, free - 150) : 0;
  cv.style.top = cvTop + 'px'; bgKey = '';
  img = cx.createImageData(VW, VH); buf = new Uint32Array(img.data.buffer); stampBuf = new Uint32Array(VW * VH);
  // narrow screens: the camel rides near the left edge so the stop's props fit beside it
  TSX = VW < 260 ? 32 : Math.round(Math.min(130, VW * .3));
}
new ResizeObserver(resize).observe(jr); resize();

// ---------- colour ----------
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const pk = c => (255 << 24) | (cl(c[2] | 0, 0, 255) << 16) | (cl(c[1] | 0, 0, 255) << 8) | cl(c[0] | 0, 0, 255);
const smooth = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// time of day follows the journey: dawn at the start, night at the camp
const SKYK = [
  { p: 0, top: '#0e1030', bot: '#252650', night: .7, warm: 0 },
  { p: .07, top: '#161842', bot: '#3c3468', night: .6, warm: .05 },
  { p: .15, top: '#2d2f63', bot: '#f2a679', night: .3, warm: .5 },
  { p: .3, top: '#4a86c5', bot: '#bfe1ee', night: 0, warm: 0 },
  { p: .6, top: '#4f86c0', bot: '#f1dba6', night: 0, warm: .1 },
  { p: .76, top: '#4b3f7d', bot: '#f39a5b', night: .12, warm: .6 },
  { p: .88, top: '#191b42', bot: '#4b3a6a', night: .58, warm: .12 },
  { p: 1, top: '#0e1030', bot: '#252650', night: .7, warm: 0 },
];
let sky = null, night = 0, warm = 0, cache = new Map();
function setTime(p) {
  let i = 0; while (i < SKYK.length - 2 && p > SKYK[i + 1].p) i++;
  const a = SKYK[i], b = SKYK[i + 1], t = cl((p - a.p) / (b.p - a.p), 0, 1);
  const top = mixc(hex(a.top), hex(b.top), t), bot = mixc(hex(a.bot), hex(b.bot), t);
  night = a.night + (b.night - a.night) * t; warm = a.warm + (b.warm - a.warm) * t;
  sky = { top, bot, bands: Array.from({ length: 8 }, (_, k) => pk(mixc(top, bot, k / 7))) };
  cache.clear();
}
const NIGHTC = [22, 24, 58];
function tintRGB(c) { const r = mixc(c, NIGHTC, night); return mixc(r, [r[0] * 1.12, r[1] * .9, r[2] * .72], warm * .55); }
function T(h) { let v = cache.get(h); if (v === undefined) { v = pk(tintRGB(hex(h))); cache.set(h, v); } return v; }
function haze(h, k) { const key = h + k; let v = cache.get(key); if (v === undefined) { v = pk(mixc(tintRGB(hex(h)), sky.bot, k)); cache.set(key, v); } return v; }

// ---------- pixels ----------
const P = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < VW && y >= 0 && y < VH) buf[y * VW + x] = c; };
const R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c); };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function line(x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { P(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function disc(x0, y0, r, c) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .6) P(x0 + x, y0 + y, c); }
const GLYPH = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 6: '111100111101111', 7: '111001010010010', E: '111100111100111', P: '111101111100100', F: '111100111100100', L: '100100100100111', '/': '001001010100100',
  B: '110101110101110', I: '111010010010111', K: '101101110101101', N: '101111111111101', T: '111010010010010',
  Z: '111001010100111', M: '101111111101101', G: '111100101101111', '!': '010010010000010', U: '101101101101111', R: '110101110101101', C: '111100100100111', H: '101101111101101' };
function word(s, x, y, c) { for (const ch of s) { const g = GLYPH[ch]; if (g) for (let k = 0; k < 15; k++) if (g[k] === '1') P(x + k % 3, y + ((k / 3) | 0), c); x += 4; } }

// ---------- the camel, laid out by hand (facing right; legs are separate) ----------
const BODY = [
  [[14, 18], [39, 40]], [[12, 20], [38, 43]], [[10, 22], [37, 45]], [[9, 23], [37, 46]], [[8, 24], [38, 45]],
  [[7, 25], [37, 40]], [[6, 26], [36, 39]], [[5, 27], [35, 39]], [[4, 29], [34, 38]], [[4, 37]], [[4, 36]],
  [[5, 34]], [[6, 32]], [[8, 31]], [[11, 29]],
];
const BW = 47, BH = BODY.length, bm = new Uint8Array(BW * BH);
BODY.forEach((rs, y) => rs.forEach(([a, b]) => { for (let x = a; x <= b; x++) bm[y * BW + x] = 1; }));
const inB = (x, y) => x >= 0 && y >= 0 && x < BW && y < BH && bm[y * BW + x];
const topOf = x => { for (let y = 0; y < BH; y++) if (bm[y * BW + x]) return y; return BH; };
// colour role for every body pixel and the outline ring around it
const bodyPx = [], outPx = [];
for (let y = -1; y <= BH; y++) for (let x = -1; x <= BW; x++) {
  if (inB(x, y)) {
    let c = y >= 11 ? '#a8703f' : y >= 9 ? '#b98048' : '#c99055';
    if (!inB(x, y - 1)) c = '#e2b27a';
    if (x === 42 && y === 2) c = '#2a1a12';           // eye
    if (x === 46 && y === 3) c = '#7a4a28';           // mouth
    if (x >= 39 && x <= 40 && y === 0) c = '#a8703f';  // ear
    // a saddle cloth hangs straight down the side, under the rider
    if (x >= 12 && x <= 20 && y > topOf(x) && y <= 8) c = y === 8 || x === 12 || x === 20 ? '#e8c050' : x % 3 === 0 ? '#7d2228' : '#a5302d';
    bodyPx.push([x, y, c]);
  } else if (inB(x + 1, y) || inB(x - 1, y) || inB(x, y + 1) || inB(x, y - 1)) outPx.push([x, y]);
}
// tassels hanging from the blanket and the two saddle posts
const tassels = []; for (let x = 13; x <= 19; x += 2) tassels.push([x, 9], [x, 10]);
const posts = []; for (const x of [11, 21]) for (let y = topOf(x) - 3; y < topOf(x); y++) posts.push([x, y]);
posts.push([10, topOf(11) - 3], [22, topOf(21) - 3]);

// the traveller: riding, standing (two walking frames) and sitting by the fire
const RCOL = { h: '#1c1614', B: '#151010', e: '#1c1614', k: '#1e1410', w: '#f4efe4', r: '#c0392b', s: '#b9805a', b: '#2f3f86', d: '#24306a', y: '#e8a33a', t: '#7a4a28' };
const SPR = {
  ride: [
    '....hhhh....', '...hhhhhh...', '...hhhssss..', '...hhssess..', '...hhBssss..', '....BBBBs...', '....rwrwr...',
    '...dbbbbbb..', '..dbbbbbbbss', '..dbbbbbbb..', '..dbbbbbbb..', '..dbybbbbb..', '..dbbbbbbbbb', '........bbbb',
    '........bbb.', '........bbb.', '........bbb.', '........kkkk'],
  stand0: [
    '....hhhh....', '...hhhhhh...', '...hhhssss..', '...hhssess..', '...hhBssss..', '....BBBBs...', '....rwrwr...',
    '...dbbbbbb..', '...dbbbbbs..', '...dbbbbbb..', '...dbybbbb..', '...dbbbbbb..', '...dbbbbbb..', '...dbbbbbb..',
    '...dbbbbbbb.', '....kk..kk..'],
  stand1: [
    '....hhhh....', '...hhhhhh...', '...hhhssss..', '...hhssess..', '...hhBssss..', '....BBBBs...', '....rwrwr...',
    '...dbbbbbb..', '...dbbbbbs..', '...dbbbbbb..', '...dbybbbb..', '...dbbbbbb..', '...dbbbbbb..', '...dbbbbbb..',
    '...dbbbbbb..', '.....kkk....'],
  sit: [
    '....hhhh....', '...hhhhhh...', '...hhhssss..', '...hhssess..', '...hhBssss..', '....BBBBs...', '....rwrwr...',
    '...dbbbbbb..', '...dbbbbbbss', '...dbybbbb..', '..dbbbbbbbb.', '.dbbbbbbbbbb', '.dbbbbbbbbbk'],
};
function drawSprite(rows, x0, y0, dir, outline) {
  const h = rows.length, w = rows[0].length;
  const X = x => dir > 0 ? x0 + x : x0 + w - 1 - x;
  if (outline) for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const on = (yy, xx) => yy >= 0 && yy < h && xx >= 0 && xx < w && rows[yy][xx] !== '.';
    if (on(y, x)) continue;
    if (on(y + 1, x) || on(y - 1, x) || on(y, x + 1) || on(y, x - 1)) {
      const sx = Math.round(X(x)), sy = Math.round(y0 + y);
      if (sx >= 0 && sy >= 0 && sx < VW && sy < VH && stampBuf[sy * VW + sx] !== frameId) P(sx, sy, T('#1e1410'));
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; if (ch !== '.') P(X(x), y0 + y, T(RCOL[ch])); }
}

// legs: two segments with a joint, solved so the foot lands where the gait wants it
const L1 = 9, L2 = 11, HIP = [11, 11], SHO = [28, 11], STRIDE = 12, FOOT = 30, DROP = 17;
function legPose(px, py, fx, fy, bendFwd) {
  let dx = fx - px, dy = fy - py, d = Math.hypot(dx, dy);
  if (d > L1 + L2 - .01) { const k = (L1 + L2 - .01) / d; dx *= k; dy *= k; d = L1 + L2 - .01; fx = px + dx; fy = py + dy; }
  const a = Math.acos(cl((L1 * L1 + d * d - L2 * L2) / (2 * L1 * Math.max(d, .01)), -1, 1)), th = Math.atan2(dy, dx);
  const k = bendFwd ? th - a : th + a;
  return [px + Math.cos(k) * L1, py + Math.sin(k) * L1, fx, fy];
}
function seg(x0, y0, x1, y1, w, c, skipBody) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    for (let k = 0; k < w; k++) {
      const X = x + k - (w >> 1);
      if (skipBody && X >= 0 && y >= 0 && X < VW && y < VH && stampBuf[y * VW + X] === frameId) continue;
      P(X, y, c);
    }
  }
}
function drawLeg(sx, sy, pose, far) {
  const [kx, ky, fx, fy] = pose, hx = pose.hx, hy = pose.hy;
  const o = T('#3a2418'), up = T(far ? '#8c5a30' : '#c08550'), lo = T(far ? '#7a4c28' : '#a8703f');
  // outline first, but never over the body, so near legs read in front of it
  seg(sx + hx, sy + hy, sx + kx, sy + ky, 5, o, true); seg(sx + kx, sy + ky, sx + fx, sy + fy, 4, o, true);
  seg(sx + hx, sy + hy, sx + kx, sy + ky, 3, up, false); seg(sx + kx, sy + ky, sx + fx, sy + fy, 2, lo, false);
  P(sx + kx - 1, sy + ky, up); P(sx + kx + 1, sy + ky, up);
  R(sx + fx - 2, sy + fy, 5, 1, o); R(sx + fx - 1, sy + fy - 1, 3, 1, lo);
}

// one full drawing of camel and rider. phase: gait cycle; kneel: 0 standing .. 1 lying down
function drawCamel(gx, gy, phase, amp, kneel, rider, t) {
  frameId++;
  const bob = Math.round(Math.max(0, Math.sin(phase * Math.PI * 4)) * amp);
  const head = amp > .05 ? Math.round(Math.sin(phase * Math.PI * 2) * amp) : (kneel > .9 ? Math.round(Math.sin(t * 2.2) * .6 + .4) : 0);
  const frontDrop = DROP * smooth(0, .55, kneel), hindDrop = DROP * smooth(.35, 1, kneel);
  const drop = x => hindDrop + (frontDrop - hindDrop) * cl(x / 40, 0, 1);
  const ox = gx - 24, oy = gy - FOOT - bob;              // body origin on screen; feet land on gy
  // feet: stance pushes back along the ground, swing lifts and reaches forward; amp fades the stride in and out
  const legs = [];
  for (const [piv, off, far, front] of [[HIP, .5, true, false], [SHO, .55, true, true], [HIP, 0, false, false], [SHO, .05, false, true]]) {
    const u = ((phase + off) % 1 + 1) % 1, py = piv[1] + drop(piv[0]);
    let fx = piv[0] + (front ? 1 : 0), fy = FOOT + bob;
    if (u < .6) fx += STRIDE * (.5 - u / .6) * amp;
    else { const w = (u - .6) / .4; fx += STRIDE * (-.5 + w) * amp; fy -= Math.sin(Math.PI * w) * 5 * amp; }
    if (kneel > 0) { fx += (front ? -3 : 3) * kneel; fy = Math.min(fy, FOOT + bob); }
    const pose = legPose(piv[0], py, fx, fy, front); pose.hx = piv[0]; pose.hy = py;
    legs.push([pose, far]);
  }
  for (const [pose, far] of legs) if (far) drawLeg(ox, oy, pose, true);
  // body with outline, sheared down when kneeling; neck and head nod while walking
  const hy = (x, y) => (x >= 34 ? head : 0) + Math.round(drop(x));
  for (const [x, y] of outPx) P(ox + x, oy + y + hy(x, y), T('#3a2418'));
  for (const [x, y, c] of bodyPx) { const sx = ox + x, sy = oy + y + hy(x, y); P(sx, sy, T(c)); if (sx >= 0 && sy >= 0 && sx < VW && sy < VH) stampBuf[sy * VW + sx] = frameId; }
  const fy = (x, y) => oy + y + hy(x, y);
  if (mood.blink) P(ox + 42, fy(42, 2), T('#a8703f'));
  if (mood.chew) { const open = (t * 7 | 0) % 2; P(ox + 46, fy(46, 3), T(open ? '#3a2418' : '#a8703f')); P(ox + 45, fy(45, 4), T(open ? '#a8703f' : '#3a2418')); }
  if (mood.ear) { P(ox + 40, fy(40, 0) - 1, T('#a8703f')); P(ox + 40, fy(40, 0) - 2, T('#3a2418')); P(ox + 41, fy(40, 0) - 1, T('#3a2418')); }
  const sw = amp > .05 ? Math.round(Math.sin(phase * Math.PI * 2) * amp) : Math.round(Math.sin(t * 1.7) * 1.2);
  for (let k = 0; k < 8; k++) P(ox + 3 + (k > 4 ? sw : 0), oy + 8 + k + Math.round(drop(3)), T(k === 7 ? '#3a2418' : '#8c5a30'));
  for (const [x, y] of tassels) P(ox + x, oy + y + Math.round(drop(x)) + (amp > .5 && (x + (phase * 8 | 0)) % 4 === 0 ? 1 : 0), T('#e8c050'));
  for (const [x, y] of posts) P(ox + x, oy + y + Math.round(drop(x)), T('#6b3f1f'));
  for (const [pose, far] of legs) if (!far) drawLeg(ox, oy, pose, false);
  if (rider) drawSprite(SPR.ride, ox + 10, oy - 12 + Math.round(drop(16)) + Math.round(Math.max(0, Math.sin(phase * Math.PI * 4 - .6)) * amp), 1, true);
}

// ---------- scenery ----------
function palm(x, base, h) {
  let tx = x, ty = base;
  for (let i = 0; i < h; i++) { tx = x + Math.round(Math.sin(i / h * 1.4) * 3); ty = base - i; R(tx, ty, 2, 1, T(i % 3 ? '#8a5a32' : '#6b4226')); }
  for (const a of [-2.9, -2.4, -1.9, -1.2, -.7, -.25]) for (let t = 1; t < 11; t++) {
    const fx = tx + 1 + Math.round(Math.cos(a) * t), fy = ty + Math.round(Math.sin(a) * t * .55 + t * t * .05);
    P(fx, fy, T(t % 2 ? '#3f7a3a' : '#2f6430')); P(fx, fy + 1, T('#2a5228'));
  }
  R(tx, ty + 1, 2, 2, T('#5a3a1a'));
}
function tent(x, base, w, h) {
  for (let j = 0; j < h; j++) { const inset = Math.round((h - j) * .6), y = base - h + j; for (let i = inset; i < w - inset * .4; i++) P(x + i, y, T(j % 3 === 0 ? '#6a4a36' : '#4a3426')); }
  R(x + (w >> 1), base - h + 3, 4, h - 3, T('#24160f'));
  line(x - 2, base, x + 2, base - h, T('#3a2418')); line(x + w + 1, base, x + w - 2, base - h + 1, T('#3a2418'));
}
function sign(x, base, label) {
  R(x, base - 15, 2, 15, T('#7a4a28')); R(x + 1, base - 15, 1, 15, T('#5a3418'));
  const bw = label.length * 4 + 5;
  R(x - (bw >> 1) + 1, base - 22, bw, 9, T('#5a3418')); R(x - (bw >> 1) + 2, base - 21, bw - 2, 7, T('#d39a5c'));
  word(label, x - (bw >> 1) + 4, base - 20, T('#4a2a16'));
}
function dnaFlag(x, base, t) {
  R(x, base - 22, 1, 22, T('#5a3418'));
  for (let i = 0; i < 12; i++) {
    const wv = Math.round(Math.sin(t * 3 + i * .5));
    for (let j = 0; j < 8; j++) P(x + 1 + i, base - 22 + j + wv, T('#f2ece0'));
    P(x + 1 + i, base - 18 + Math.round(Math.sin(i * .9) * 2.5) + wv, T('#b8402a')); P(x + 1 + i, base - 18 - Math.round(Math.sin(i * .9) * 2.5) + wv, T('#33407a'));
  }
}
function balloon(x, y) {
  for (let j = -9; j <= 9; j++) for (let i = -8; i <= 8; i++) { const e = (i * i) / 64 + (j < 0 ? (j * j) / 81 : (j * j) / 50); if (e <= 1) P(x + i, y + j, T(i > 3 ? '#cfcac4' : i < -4 ? '#fbfaf6' : '#efece6')); }
  line(x, y + 9, x, y + 17, T('#7a7a80')); R(x - 1, y + 17, 3, 3, T('#5a5a64'));
}
function telescope(x, base) {
  line(x, base, x + 4, base - 9, T('#3a2418')); line(x + 8, base, x + 4, base - 9, T('#3a2418')); line(x + 4, base, x + 4, base - 9, T('#3a2418'));
  for (let i = 0; i < 12; i++) { P(x + 1 + i, base - 8 - (i >> 1), T('#a8a4b8')); P(x + 1 + i, base - 9 - (i >> 1), T('#d8d4e4')); }
}
function fire(x, base, t) {
  R(x - 5, base - 1, 11, 2, T('#5a3418')); line(x - 5, base - 2, x + 4, base, T('#3a2418'));
  const f = (t * 10 | 0) % 3, [o, h, w] = [[0, 7, 3], [1, 8, 2], [-1, 6, 4]][f];
  for (let j = 0; j < h; j++) { const ww = Math.max(1, Math.round(w * (1 - j / h) * 1.5)); for (let i = -ww; i <= ww; i++) P(x + i + (j > h / 2 ? o : 0), base - 2 - j, pk(j < 2 ? [255, 200, 80] : j < h - 2 ? [245, 130, 40] : [210, 70, 30])); }
  if ((t * 3 | 0) % 2) P(x + o * 2, base - h - 4, pk([255, 190, 90]));
}
function ankara(x, base, c) {
  for (const [bx, bh] of [[0, 7], [5, 11], [9, 6], [14, 9], [44, 8], [49, 12], [54, 7]]) R(x + bx, base - bh, 5, bh, c);
  R(x + 22, base - 26, 1, 26, c); R(x + 20, base - 22, 5, 2, c); R(x + 21, base - 24, 3, 1, c);
  for (let i = -6; i <= 6; i++) R(x + 36 + i, base - 8 - Math.round(Math.sqrt(36 - i * i) * .9), 1, 8, c);
  R(x + 29, base - 18, 6, 18, c);
  for (const m of [28, 31, 41, 44]) { R(x + m, base - 20, 1, 20, c); P(x + m, base - 21, c); }
}
function sagrada(x, base, c, cl2) {
  R(x, base - 8, 34, 8, c);
  for (const [tx, h] of [[3, 20], [8, 24], [13, 27], [17, 34], [21, 27], [26, 24], [31, 20]]) {
    R(x + tx - 1, base - h + 3, 3, h - 3, c); P(x + tx, base - h + 1, c); P(x + tx, base - h + 2, c); P(x + tx, base - h, cl2);
    for (let j = 6; j < h - 4; j += 3) P(x + tx, base - j, cl2);
  }
  line(x + 40, base, x + 40, base - 38, c); line(x + 30, base - 38, x + 52, base - 38, c); line(x + 40, base - 41, x + 30, base - 38, c); line(x + 40, base - 41, x + 52, base - 38, c);
  line(x + 49, base - 38, x + 49, base - 31, cl2);
}
function rolex(x, base, c, cw) { for (let i = 0; i < 44; i++) { const h = 6 + Math.round(2 * Math.sin(i * .22)); R(x + i, base - h, 1, h, c); if (i % 3 === 0) P(x + i, base - h + 3, cw); } }
function zurich(x, base, c) {
  for (const [bx, bh] of [[0, 9], [6, 13], [36, 10], [42, 7], [48, 12]]) R(x + bx, base - bh, 5, bh, c);
  R(x + 14, base - 10, 20, 10, c);
  for (const tx of [16, 27]) { R(x + tx, base - 26, 5, 16, c); R(x + tx + 1, base - 29, 3, 3, c); P(x + tx + 2, base - 31, c); }
}
const STARS = Array.from({ length: 90 }, (_, i) => [hash(i, 1), hash(i, 2) * .6, hash(i, 3)]);
const tri = v => 1 - Math.abs(2 * (((v % 1) + 1) % 1) - 1);
const SNOW_H = WINTER ? 22 : SUMMER ? 44 : 34, SNOW_D = WINTER ? 16 : SUMMER ? 4 : 8;
let alps = 0;   // 0 out in the desert, 1 at Lausanne and Zürich
function farH(fx) {
  let h = 7 + 4 * Math.sin(fx * .031) + 2.5 * Math.sin(fx * .083 + 1);
  if (alps > 0) h += alps * (8 + 42 * Math.pow(tri(fx / 58 + .2 * Math.sin(fx * .013)), 1.3) + 15 * tri(fx / 23 + .35));
  return h;
}

// ---------- props, one set per stop ----------
// the chalkboard writes formulas in chalk, one stroke at a time, underlines them, wipes them, and moves on to the next.
// letters are handwritten strokes in a 3x5 cell (x right, y down); superscripts are small strokes raised above the line
const GLYPH_STROKES = {
  x: [[[0, 0], [2, 4]], [[2, 0], [0, 4]]],
  '←': [[[3, 2], [0, 2]], [[1, 1], [0, 2], [1, 3]]],
  '−': [[[0, 2], [2, 2]]],
  'η': [[[0, 1], [0, 4]], [[0, 2], [1, 1], [2, 2], [2, 5]]],
  '∇': [[[0, 0], [3, 0], [2, 4], [1, 4], [0, 0]]],
  f: [[[2, 0], [1, 0], [1, 4]], [[0, 2], [2, 2]]],
  '(': [[[1, 0], [0, 1], [0, 3], [1, 4]]],
  ')': [[[0, 0], [1, 1], [1, 3], [0, 4]]],
  e: [[[0, 2], [2, 2], [2, 1], [1, 0], [0, 1], [0, 3], [1, 4], [2, 4]]],
  '+': [[[1, 1], [1, 3]], [[0, 2], [2, 2]]],
  1: [[[0, 1], [1, 0], [1, 4]], [[0, 4], [2, 4]]],
  '=': [[[0, 1], [2, 1]], [[0, 3], [2, 3]]],
  0: [[[1, 0], [2, 1], [2, 3], [1, 4], [0, 3], [0, 1], [1, 0]]],
  a: [[[2, 1], [2, 4]], [[2, 2], [1, 1], [0, 2], [0, 3], [1, 4], [2, 3]]],
  b: [[[0, 0], [0, 4]], [[0, 2], [1, 1], [2, 2], [2, 3], [1, 4], [0, 4]]],
  c: [[[2, 1], [1, 1], [0, 2], [0, 3], [1, 4], [2, 4]]],
  P: [[[0, 4], [0, 0], [2, 0], [2, 2], [0, 2]]],
  N: [[[0, 4], [0, 0], [3, 4], [3, 0]]],
  '?': [[[0, 1], [1, 0], [2, 1], [1, 2], [1, 3]], [[1, 4.6], [1, 4.6]]],
  '^i': [[[0, 0], [0, 0]], [[0, 2], [0, 3]]],
  '^π': [[[0, 1], [3, 1]], [[1, 1], [1, 3]], [[2, 1], [2, 3]]],
  '^2': [[[0, 0], [1, 0], [1, 1], [0, 2], [1, 2]]],
};
const WIDTH = { '←': 5, '(': 3, ')': 3, '^i': 2, '^π': 5, '^2': 3, '∇': 5, N: 5 };
// maths, then CS, then where it led
const FORMULAS = [
  ['e', '^i', '^π', ' ', '+', ' ', '1', ' ', '=', ' ', '0'],   // Euler's identity
  ['P', ' ', '=', ' ', 'N', 'P', '?'],                         // the great open question
  ['x', '←', 'x', '−', 'η', '∇', 'f', '(', 'x', ')'],          // gradient descent
];
const BOARD_W = 43, BOARD_H = 15, LINE = 4, SPEED = 13;
// turn each formula into a timetable of strokes, centred on the board, with an underline and a wipe at the end
const CHALK = FORMULAS.map(tokens => {
  const strokes = []; let cx = 0;
  for (const tk of tokens) {
    if (tk === ' ') { cx += 2; continue; }
    const sup = tk[0] === '^', dy = sup ? LINE - 3 : LINE;
    for (const st of GLYPH_STROKES[tk]) strokes.push(st.map(([x, y]) => [cx + x, dy + y]));
    cx += WIDTH[tk] || 4;
  }
  const off = Math.floor((BOARD_W - cx) / 2) + 1;
  for (const st of strokes) for (const pt of st) pt[0] += off;
  strokes.push([[off - 1, LINE + 7], [off + cx - 1, LINE + 7]]);
  const plan = []; let t = .6;
  strokes.forEach((pts, i) => {
    let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    len = Math.max(len, .6);
    plan.push({ pts, len, t0: t, t1: t + len / SPEED, dotted: i === strokes.length - 1 }); t += len / SPEED + .18;
  });
  const wipe0 = t + 2.4, wipe1 = wipe0 + 1.2;
  return { plan, wipe0, wipe1, cycle: wipe1 + .7 };
});
const CHALK_LOOP = CHALK.reduce((a, f) => a + f.cycle, 0);
// which formula is on the board at time t, and how far into it
function chalkNow(t) { let u = mod(t, CHALK_LOOP), i = 0; while (u >= CHALK[i].cycle) { u -= CHALK[i].cycle; i++; } return { f: CHALK[i], u, i }; }
function strokeAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay);
    if (d <= l) return [ax + (bx - ax) * d / l, ay + (by - ay) * d / l]; d -= l;
  }
  return pts[pts.length - 1];
}
function chalkboard(x, base, t) {
  const W = BOARD_W, H = BOARD_H, top = base - H - 13;
  line(x + 4, base, x + 8, top + H, T('#6b3f1f')); line(x + W - 2, base, x + W - 6, top + H, T('#6b3f1f'));
  R(x, top - 1, W + 2, H + 2, T('#7a4a28')); R(x + 1, top, W, H, T('#2f3d32')); R(x, top + H + 1, W + 2, 1, T('#8a5a32'));   // frame, board, chalk tray
  const bx = x + 1, by = top, chalk = T('#e6e6d6'), { f, u } = chalkNow(t);
  const wiped = u >= f.wipe0 ? Math.min(W, (u - f.wipe0) / (f.wipe1 - f.wipe0) * W) : -1;
  const dot = (px, py) => { px = Math.round(px); py = Math.round(py); if (px > wiped && u < f.wipe1 && px >= 0 && px < W && py >= 0 && py < H) P(bx + px, by + py, chalk); };
  let pen = null;
  for (const st of f.plan) {
    if (u < st.t0) break;
    const d = Math.min(st.len, (u - st.t0) * SPEED);
    for (let k = 0; k <= d * 2; k++) { const [px, py] = strokeAt(st.pts, k / 2); if (!st.dotted || Math.round(px) % 2 === 1) dot(px, py); }
    if (u < st.t1) pen = strokeAt(st.pts, d);
  }
  if (pen && u < f.wipe0) {
    // the chalk itself, held at an angle against the board
    const [px, py] = pen.map(Math.round);
    P(bx + px + 1, by + py - 1, chalk); P(bx + px + 2, by + py - 2, chalk); P(bx + px + 3, by + py - 3, T('#b8b8a8'));
  } else if (wiped < 0 || u >= f.wipe1) R(x + W - 10, top + H, 3, 1, chalk);       // resting on the tray
  if (wiped >= 0 && u < f.wipe1) {
    const ex = bx + Math.round(wiped) - 2, ey = by + 2 + Math.round(Math.abs(Math.sin(u * 9)) * (H - 6));
    R(ex, ey, 4, 3, T('#5a5a64')); R(ex, ey, 4, 1, T('#8a5a32'));
  }
}
function books(x, base) {
  R(x, base - 3, 15, 3, T('#9b2f2f')); R(x + 1, base - 6, 13, 3, T('#33407a')); R(x + 2, base - 9, 12, 3, T('#3f7a3a'));
  for (const [y, w] of [[3, 15], [6, 13], [9, 12]]) R(x + (15 - w) + w - 2, base - y + 1, 1, 1, T('#f2ece0'));
  R(x + 2, base - 11, 12, 1, T('#1e1410')); R(x + 5, base - 13, 6, 2, T('#1e1410')); R(x + 13, base - 11, 1, 3, T('#e8c050'));
}
function helix(x, base, t) {
  R(x - 5, base - 3, 11, 3, T('#8a7a6a')); R(x - 4, base - 4, 9, 1, T('#a89a88'));
  const rung = ['#e05a4a', '#4a8ae0', '#e8c050', '#4ab07a'];
  for (const front of [false, true]) for (let j = 0; j < 30; j++) {
    const a = t * 1.8 + j * .33, s1 = Math.sin(a), y = base - 5 - j;
    const ax = x + Math.round(s1 * 5), bx = x - Math.round(s1 * 5), aFront = Math.cos(a) > 0;
    if (!front && j % 3 === 0) line(ax, y, bx, y, T(rung[(j / 3) % 4]));
    if (aFront === front) P(ax, y, T(front ? '#f4efe4' : '#a8a090'));
    if (aFront !== front) P(bx, y, T(front ? '#f4efe4' : '#a8a090'));
  }
}
function scroll(x, base) {
  R(x, base - 12, 9, 10, T('#f2e6c8')); R(x - 1, base - 13, 11, 2, T('#d8c8a0')); R(x - 1, base - 3, 11, 2, T('#d8c8a0'));
  for (let j = 0; j < 4; j++) R(x + 2, base - 10 + j * 2, 5 - (j % 2), 1, T('#a89878'));
  disc(x + 4, base - 2, 1, T('#b8302a'));
}
function photoBoard(x, base) {
  R(x + 3, base - 8, 2, 8, T('#5a3418')); R(x + 25, base - 8, 2, 8, T('#5a3418'));
  R(x, base - 27, 30, 20, T('#5a3418')); R(x + 1, base - 26, 28, 18, T('#efe6d0'));
  const fields = ['#6a9a4a', '#8ab060', '#b8a060', '#5a7a9a', '#7a8a5a', '#c8b080', '#9aaa6a'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const tx = x + 2 + c * 7, ty = base - 25 + r * 6;
    if (r === 1 && c === 2) {       // the cloudy frame the checks threw out
      R(tx, ty, 6, 5, T('#f4f4f4')); P(tx + 1, ty + 1, T('#c8c8d0')); P(tx + 3, ty + 2, T('#c8c8d0'));
      line(tx, ty, tx + 5, ty + 4, T('#d02020')); line(tx + 5, ty, tx, ty + 4, T('#d02020'));
    } else {
      R(tx, ty, 6, 5, T(fields[Math.floor(hash(r, c) * fields.length)]));
      P(tx + Math.floor(hash(c, r) * 5), ty + 2, T('#e8e0c8')); line(tx, ty + 4, tx + 5, ty + Math.floor(hash(r + 3, c) * 4), T('#d8c89a'));
    }
  }
}
function balloonCam(x, y, t) {
  balloon(x, y);
  if ((t % 3.2) < .12) { const c = pk([255, 255, 230]); P(x, y + 21, c); P(x - 2, y + 18, c); P(x + 2, y + 18, c); P(x, y + 15, c); line(x - 3, y + 21, x + 3, y + 21, c); }
}
function epflBanner(x, base) {
  R(x, base - 26, 1, 26, T('#5a3418')); R(x + 26, base - 26, 1, 26, T('#5a3418'));
  R(x + 1, base - 25, 25, 9, T('#e2001a'));
  word('EPFL', x + 6, base - 23, T('#ffffff'));
}
function lectern(x, base, t) {
  R(x + 5, base - 11, 2, 11, T('#6b3f1f')); R(x + 2, base - 1, 8, 1, T('#6b3f1f'));
  R(x, base - 14, 12, 3, T('#7a4a28'));
  R(x + 1, base - 17, 5, 3, T('#f8f2e2')); R(x + 6, base - 17, 5, 3, T('#e8dec8')); R(x + 6, base - 14, 1, 3, T('#c0392b'));
  word('6/6', x, base - 25, T('#e8c050'));
  if ((t * 2 | 0) % 2) P(x + 13, base - 26, T('#fff4c0'));
}
function sail(x, y, s) {
  R(x, y, 6 * s, s, T('#6b3f1f'));
  for (let j = 0; j < 5 * s; j++) R(x + 2 * s, y - 1 - j, Math.max(1, Math.round((5 * s - j) * .5)), 1, T('#f4f4f4'));
}
function tram(x, base) {
  R(x, base - 9, 32, 8, T('#1f5fa8')); R(x, base - 5, 32, 2, T('#f4f4f4'));
  for (let i = 0; i < 5; i++) R(x + 2 + i * 6, base - 8, 4, 2, T('#bfe0f0'));
  line(x + 12, base - 9, x + 16, base - 13, T('#2a2a33')); line(x + 16, base - 13, x + 20, base - 13, T('#2a2a33'));
  P(x + 5, base - 1, T('#2a2a33')); P(x + 26, base - 1, T('#2a2a33'));
}
function serverRack(x, base, t) {
  R(x, base - 27, 13, 27, T('#14141a')); R(x + 1, base - 26, 11, 25, T('#2a2a33'));
  for (let k = 0; k < 6; k++) {
    R(x + 2, base - 25 + k * 4, 9, 3, T('#3a3a46'));
    P(x + 9, base - 24 + k * 4, hash(k, t * 5 | 0) > .4 ? pk([90, 230, 110]) : T('#2a2a33'));
    P(x + 7, base - 24 + k * 4, hash(k + 9, t * 3 | 0) > .7 ? pk([250, 180, 60]) : T('#2a2a33'));
  }
  R(x + 3, base - 30, 7, 3, T('#1e1e22')); if ((t % 2) < .25) P(x + 8, base - 29, pk([255, 60, 50]));   // the pager
  R(x - 28, base - 4, 9, 4, T('#f4efe0')); R(x - 27, base - 3, 7, 1, T('#c8bfa8'));                         // the pile of documents
  for (let k = 0; k < 4; k++) {
    const u = mod(t * .45 + k / 4, 1), px0 = x - 24, py0 = base - 6, px1 = x + 1, py1 = base - 14;
    const fx = px0 + (px1 - px0) * u, fy = py0 + (py1 - py0) * u - Math.sin(Math.PI * u) * 12;
    R(fx, fy, 3, 4, T('#fbf6ea')); P(fx + 1, fy + 1, T('#b8b0a0'));
  }
}
function constellation(x, y, a) {
  const pts = [[0, 0], [7, 10], [15, 17], [24, 21], [34, 23], [45, 24], [56, 24]];
  const c = pk(mixc(sky.top, [255, 246, 214], a)), cl2 = pk(mixc(sky.top, [200, 196, 230], a * .6));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 1; k < n; k++) if (k % 2) P(x + x0 + (x1 - x0) * k / n, y + y0 + (y1 - y0) * k / n, cl2);
  }
  for (const [px, py] of pts) { P(x + px, y + py, c); P(x + px - 1, y + py, cl2); P(x + px + 1, y + py, cl2); P(x + px, y + py - 1, cl2); P(x + px, y + py + 1, cl2); }
}
function dallah(x, base) {
  const b = T('#c8a040'), d = T('#9a7a2a'), l = T('#f0d070');
  R(x, base - 2, 7, 2, d); R(x + 1, base - 6, 5, 4, b); P(x + 2, base - 5, l); R(x + 2, base - 9, 3, 3, b); R(x + 1, base - 10, 5, 1, d); R(x + 3, base - 12, 1, 2, d);
  P(x - 1, base - 6, b); P(x - 2, base - 7, b); P(x - 3, base - 8, b);          // spout
  P(x + 7, base - 7, d); P(x + 7, base - 4, d); P(x + 8, base - 6, d); P(x + 8, base - 5, d);   // handle
  R(x + 11, base - 2, 2, 2, T('#f2ece0')); R(x + 15, base - 2, 2, 2, T('#f2ece0'));
}
function bilkentBanner(x, base) {
  R(x, base - 27, 1, 27, T('#5a3418')); R(x + 34, base - 27, 1, 27, T('#5a3418'));
  R(x + 1, base - 26, 33, 11, T('#1d3570')); R(x + 1, base - 26, 33, 1, T('#e8c050')); R(x + 1, base - 16, 33, 1, T('#e8c050'));
  word('BILKENT', x + 4, base - 23, T('#ffffff'));
}
function zurichSign(x, base) {
  R(x + 4, base - 14, 1, 14, T('#8a8a92')); R(x + 25, base - 14, 1, 14, T('#8a8a92'));
  R(x, base - 24, 30, 11, T('#ffffff')); R(x + 1, base - 23, 28, 9, T('#1f4e9c'));
  word('ZURICH', x + 3, base - 21, T('#ffffff')); P(x + 7, base - 23, T('#ffffff')); P(x + 9, base - 23, T('#ffffff'));
}
function zurichFlag(x, base, t) {
  R(x, base - 30, 1, 30, T('#6b6b72'));
  for (let i = 0; i < 12; i++) { const wv = Math.round(Math.sin(t * 3 + i * .6) * .8); for (let j = 0; j < 9; j++) P(x + 1 + i, base - 30 + j + wv, T(i / 12 + j / 9 < 1 ? '#ffffff' : '#1f6fd0')); }
}
function steam(x, y, t) {
  for (let k = 0; k < 4; k++) {
    const u = mod(t * .5 + k / 4, 1), sx0 = x + Math.round(Math.sin(t * 2 + k * 1.7) * 1.5), sy = y - u * 12;
    if (u < .8 || (k & 1)) P(sx0, sy, pk(mixc(tintRGB([230, 226, 220]), sky.bot, u * .6)));
  }
}
function lanterns(x0, x1, y, t) {
  const rope = T('#5a3418'), n = x1 - x0;
  for (let i = 0; i <= n; i++) P(x0 + i, y + Math.round(Math.sin(i / n * Math.PI) * 6), rope);
  for (let k = 1; k < 7; k++) {
    const lx = x0 + Math.round(n * k / 7), ly = y + Math.round(Math.sin(k / 7 * Math.PI) * 6);
    const glow = (Math.sin(t * 3 + k * 1.7) + 1) / 2, body = pk(mixc([235, 150, 40], [255, 214, 110], glow));
    P(lx, ly + 1, rope); R(lx - 1, ly + 2, 3, 1, T('#9a7a2a')); R(lx - 1, ly + 3, 3, 4, body); P(lx, ly + 4, pk([255, 244, 200]));
    R(lx - 1, ly + 7, 3, 1, T('#9a7a2a')); P(lx, ly + 8, T('#9a7a2a'));
    if (night > .3) for (const [dx, dy] of [[-2, 4], [2, 4], [0, 1], [0, 9], [-2, 6], [2, 6]]) if ((dx + dy + (t * 4 | 0)) % 3) P(lx + dx, ly + dy, pk(mixc(sky.top, [255, 200, 90], .35)));
  }
}
// winter: snow drifts over Lausanne and Zürich
function snowfall(t, amt) {
  for (let i = 0; i < 90; i++) {
    if (hash(i, 9) > amt) continue;
    const sp = 9 + hash(i, 4) * 14, x = mod(hash(i, 1) * VW + Math.sin(t * .8 + i) * 4 - wx * .15, VW), y = mod(hash(i, 2) * VH + t * sp, VH);
    P(x, y, pk([248, 250, 255]));
  }
}
// a camel's speech bubble
function bubble(x, y, text) {
  const w = text.length * 4 + 3;
  R(x, y, w + 2, 9, T('#3a2418')); R(x + 1, y + 1, w, 7, pk([251, 241, 220]));
  P(x + 3, y + 9, T('#3a2418')); P(x + 2, y + 10, T('#3a2418'));
  word(text, x + 3, y + 2, T('#3a2418'));
}
function rug(x, base, w) { for (let i = 0; i < w; i++) { P(x + i, base, T('#8a2a2a')); P(x + i, base + 1, T(i % 3 ? '#8a2a2a' : '#e8c050')); } }

// ---------- state ----------
let campDir = 1, gaitAmp = 0;
const mood = { blink: false, chew: false, ear: false }, say = { text: '', until: 0 };
let rest = 0, grumbled = false, lastInput = 0, nextBlink = 2, nextChew = 4, nextEar = 7, chewUntil = 0, earUntil = 0, blinkUntil = 0, lastFoot = 0;
const sayIt = (text, secs) => { say.text = text; say.until = T0 + secs; };
let wx = 0, target = 0, vel = 0, phase = 0, dir = 1, T0 = 0, lastWheel = -9, foot = 0, hurry = 1;
const CAMP_END = 3.6, prints = [], dust = [], meteors = [];
let campT = CAMP_END;   // the story starts with the traveller already sitting by the fire
const box = document.getElementById('box'), bt = document.getElementById('bt'), bw = document.getElementById('bw'), bb = document.getElementById('bb');
let shown = null, typed = 0, typing = false, fullHTML = '';
// ---------- the minimap: real coastlines, rasterised from Natural Earth into 120x80 cells ----------
const LAND = Uint8Array.from(atob('AE4AAAAP/EAP////////AC/gAABH/EHP////////AK/AAALD+AP/////////ABfAAAHB/AP/////////AA+AAAPD8AP/////////ACfgAAOFgAP/////////AAPwAAH9AAP/////////AefwAAGMAAP/////////AfD4AAGBA4//////////D/D8AAHmD///////////D+B8AAH/v///////////D+B+AK//////////////B+P+AP//////////////B+H/wf//////////////H4P/wf//////////////Hgf/g///////////////AAB/A///////////////AAP/P///////////////AAcAf///////////////AAgAf///////////////AAAB////////////////AAAR////////////////AAAP////////////////AAO/////////////////AAP/////////////////AAD/////////////////AAA/////////////////AAAf///////////4///9AAAf/////////4/H///wAAAP/////////z+D///gAAAH/////////gcH//+AAAAP///4/////B+3//4AAAAP///8/////AeP//4DAAAP///8H///+AYD//wFAAAP//z8H///8AAB//4DAAAP//g+D///8AAA//4DAf/f+OA/A///4AAAP/8BB///8AA/gf//4AAAH/8AA///8AEfgH//wAAAD/8AA///8AEPwD//4AAAB/+AA///8AEH+B//4B+AB//AA///4AAB+B//8D/AD//AA///AAGAfh//z//9v//gA///AAOAPx/gB//////wA//+AAOAHJ+A///////gA//8AAGACB+A///////gB//8CAOADg/Af//////gB//8AAAABgPAf//////AB//8AAAADAPQf//////AA//4AAAAGAEw///////AA//4AAAD4AfQP//////AA//gAAAB4AGAP//////4AD/gACnAYAHAH//////4ABwAH//gAADABz4/////ABAB///AAABAAhw/////AAAH///gAAAAQAA/////ABgP///gAAAQAAA/////AB/////gAAAEABw/////AD/////AAAAAAAA/////AD////+AAAAAAAB/////AH/////AAAAAAAB/////Af/////gAAAAAAB/////A//////4AAAAAAD/////B///////gAfAAAD/////B///////4A/AAAD/////B///////4A/8AAH/////D///////8A//gcH/////D////////w//8///////D////////4//////////D//////////////////fD////////////+////+HH/////////////////8HH/////////////f///+Df/////////////b///+D//////////////v////B//////////////p////A//////////////x////g//////////////w////w//////////////w////w//////////////4f///4'), c => c.charCodeAt(0));
const MW = 120, MH = 80, isLand = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && (LAND[(y * MW + x) >> 3] & (128 >> ((y * MW + x) & 7)));
const geo = (lon, lat) => [(lon + 12) / 64 * MW, (58 - lat) / 32 * MH];
const CITY = { lausanne: geo(6.63, 46.52), zurich: geo(8.54, 47.38), ankara: geo(32.86, 39.93), barcelona: geo(2.17, 41.39) };
const WHERE = ['lausanne', 'ankara', 'ankara', 'barcelona', 'lausanne', 'zurich', 'lausanne'];   // camp, 2017 … 2026
const mc = document.getElementById('mc'), mx = mc.getContext('2d'), mimg = mx.createImageData(MW, MH), mbuf = new Uint32Array(mimg.data.buffer);
const mbase = new Uint32Array(MW * MH);
for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
  const l = isLand(x, y), coast = l && (!isLand(x + 1, y) || !isLand(x - 1, y) || !isLand(x, y + 1) || !isLand(x, y - 1));
  const c = l ? (coast ? [154, 107, 64] : ((x * 7 + y * 13) % 11 === 0 ? [224, 196, 140] : [239, 217, 168])) : (BAYER[(x & 3) + ((y & 3) << 2)] < 3 ? [70, 108, 140] : [79, 120, 153]);
  mbase[y * MW + x] = pk(c);
}
// the route between two stops is a gentle arc; long hops arc higher
function mapPos(f) {
  const k = Math.floor(f), u = f - k, a = CITY[WHERE[chap(k)]], b = CITY[WHERE[chap(k + 1)]];
  const e = u * u * (3 - 2 * u), d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e - Math.sin(Math.PI * e) * d * .22];
}
const MP = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < MW && y < MH) mbuf[y * MW + x] = c; };
function drawMap(t) {
  mbuf.set(mbase);
  const ink = pk([58, 36, 24]), gold = pk([232, 163, 58]), cream = pk([251, 241, 220]);
  for (let k = 0; k < NCH; k++) for (let i = 0; i < 40; i += 2) { const [x, y] = mapPos(k + i / 40); MP(x, y, ink); }
  const here = shown !== null ? WHERE[chap(shown)] : null;
  for (const [name, [x, y]] of Object.entries(CITY)) {
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) MP(x + i, y + j, ink);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) MP(x + i, y + j, name === here ? gold : cream);
  }
  // Near Space Labs flew balloons: one drifts above Barcelona
  const bx = CITY.barcelona[0] - 1, by = CITY.barcelona[1] - 11 + Math.round(Math.sin(t * 1.5));
  for (const [i, j] of [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3]]) MP(bx + i, by + j, cream);
  MP(bx + .5, by + 4, ink); MP(bx + .5, by + 5, ink);
  // the traveller
  const [tx, ty] = mapPos(wx / GAP);
  if ((t * 3 | 0) % 4) { for (let j = -2; j <= 1; j++) for (let i = -2; i <= 2; i++) MP(tx + i, ty + j, ink); for (let i = -1; i <= 1; i++) { MP(tx + i, ty - 1, gold); MP(tx + i, ty, gold); } MP(tx + 1, ty - 2, gold); }
  mx.putImageData(mimg, 0, 0);
  if (bmEl.classList.contains('on')) drawBigMap(t);
}
// ride to stop i within this lap, the short way (the camp is whichever end of the lap is nearer)
function rideTo(i) {
  const k0 = Math.round(wx / GAP), lap = Math.floor(k0 / NCH) * NCH;
  let k = lap + i;
  if (i === 0 && Math.abs(lap + NCH - k0) < Math.abs(lap - k0)) k = lap + NCH;
  hurry = 1; go(k);
}
// one button per stop
const yrs = document.getElementById('yrs');
STOPS.forEach((s, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = s.sign || 'camp'; b.title = s.title;
  b.onclick = () => rideTo(i);
  yrs.appendChild(b);
});

// ---------- the big map: twice the detail, small pins, and one card per city out in open space ----------
const bmEl = document.getElementById('bigmap'), bmc = document.getElementById('bmc'), bmx = bmc.getContext('2d'), bmw = document.getElementById('bmw');
const BW2 = 240, BH2 = 160, LAND2 = Uint8Array.from(atob('AAAQPAAAAAAAAAB//+AIAAD/////////////////AAAA/IAAAAAAAAh//+AwAED/////////////////AAAN//wAAAAAADA//+BgA+D/////////////////AABE//wAAAAAAHI//+BgB/D/////////////////AAAC//gAAAAAB/Af/+hAB/H/////////////////AAAB//gAAAAADPAP/+AAB///////////////////AAAD//AAAAAAC/AH/9AAD///////////////////AAACf+AAAAAAC/wH/+AAD///////////////////AAAE/+AAAAAAH/wH/4AAD///////////////////AAAAv4AAAAAAD/Af8AAAD///////////////////AAACn/gAAAAAD+C34AAAD///////////////////AAAEn/wAAAAAD8PzwAAAD///////////////////AAAAX/4AAAAAD7nj4AAAB///////////////////AAAAH/4AAAAAB73wAAAAF///////////////////AAPcP/8AAAAAB5hADAAAB///////////////////AAP+Pn8AAAAAA6dAAAAA////////////////////AA/+AP8AAAAAA8GAAAfA////////////////////AAP/AP/gAAAAAcIDAB/h////////////////////AEf/CP/wAAAAB/wcAD//////////////////////AP/+ED/4AAAAA/x/g///////////////////////AP/4AD/wAAAAAf//////////////////////////AP/8AD/oAAAAB3//7///////////////////////Af/8AD/4AAAI////////////////////////////AH/8Df/8AAA+////////////////////////////AD/8B//8AAB/////////////////////////////AD/8C//5wAH/////////////////////////////AG/8A///4AP/////////////////////////////AH/8A///8AP/////////////////////////////AP/4B///4AP/////////////////////////////AP+AH///4Af/////////////////////////////A/4Af///wA//////////////////////////////APgAJ///AB//////////////////////////////AIAAAZ/+ADf/////////////////////////////AAAAAD//wH//////////////////////////////AAAAB///wf//////////////////////////////AAAAD///H///////////////////////////////AAAAH5mAH///////////////////////////////AAAAPwAAH///////////////////////////////AAAAYgAAH///////////////////////////////AAAAwAAAP///////////////////////////////AAAAAAAA////////////////////////////////AAAAAAAD////////////////////////////////AAAAABMD////////////////////////////////AAAAAAH/////////////////////////////////AAAAAAH/////////////////////////////////AAAAAAH/////////////////////////////////AAAAAcH/////////////////////////////////AAAAH///////////////////////////////////AAAAB///////////////////////////////////AAAAD///////////////////////////////////AAAAB///////////////////////////////////AAAAAH//////////////////////////////////AAAAAA//////////////////////////////////AAAAAAv/////////////////////////////////AAAAAAf////////////////////////w////////AAAAAAf///////////////////////8D///////gAAAAAAP///////////////////////gH//////+AAAAAAAP///////////////////8P/+Af//////wAAAAAAAB///////////////////8P/8AP//////wAAAAAAAB///////////////////4APwAH//////AAAAAAAAD///////////////////wAHwAf//////AAAAAAAAB////////8//////////AAfwA//////4AAAAAAAAA////////g//////////AA/4A//////gAAAAAAAAB////////g7/////////AAf/1//////gADAAAAAABf///////g1/////////AAH93//////AAHAAAAAAD////////wR////////7AAH4B//////AAPAAAAAAB////////gB////////4AAHAA/////+AAHAAAAAAD////////gA////////4AAGAAP////8AB/AAAAAAD/////+P/gAf///////wAAAAAD/////AA/AAAAAAD/////8H/wA////////wAAAAAB/////AAPAAAAAAD/////4B/8Af///////wAAAAAA/////gAPAAGAAAD/////AA/+AH///////wAAAAAAf////gAHAAP/wQH//+f+AA//AB///////wAAAAAAP////gAHAA///////8B8AA//gBf//////AAAAAAAD////gAHAD///////4AAAA//gAP//////AAAAAAAB////gABAB///////wAAAIf/gAP//////AAAAAAAAf///wABAB///////4AAAQP/wAB/////+AAAAAAAAP///wAAAA///////4AAA4H/wAA/////8AAAAAAAAH///4AAAA///////4AAB4B/4AAf////+AAAAAAAAH///4AAAA///////4AAA4B/8AAH/////AAAAAAAAH///8AAAA///////4AAAwA//8AH/////AAAf4AAAD///+AAAA///////wAAAwAf/4AD/////AAD/9AAAH////AAAA///////AAAAQAP/4AD/////gAH//gAAH////gAAA//////+AAAAAAD/8AD/////4Af//oAAf////gAAAf/////wAAAAYAAf/gD//////8////AB/////gAAA//////AAAAA4AAP/wD//9P8D////////////wAAA//////AAAAD4AAH/8D//xB4B////////////4AAA/////+AAAAD8AAB/+D/9wABH////////////+AAA/////8AAAAB4AAB/HD/80Bf/////////////9AAA/////8AAAAB4AAA+DB/8oB//////////////4AAB/////4AIgAB4AAAOBA/8AR//////////////wAAB/////wA8AAB4AAAOAB/+AB//////////////wAAB/////wAYAAB4AAAHgBf/ABP/////////////wAAD/////wAAAAB4AAAHgAf/ABf/////////////wAAD/////wIAAADgAAAHgAP+ABv/////////////wAAD/////4AAAAAAAAADAAH9gAP/////////////AAAB/////8IAAAAAAAAGAAL/QAf/////////////AAAC/////wAAAAAAAAAGAAD/sCv/////////////AAAA/////gAAAAAAAAAMAAQT8C//////////////AAAA/////gAAAAAAALDsAAB86AP/////////////AAAA/////AAAAAAAAP/gAAL+IgH/////////////gAAA/////AAAAAAAAP/AAAB/AAX/////////////gAAA////8AAAAAAAAD/AAAA9gAH/////////////wAAA////4AAAAAAEAA/AAAA+AAD/////////////+AAB8P//wAAAAAAeAAPAAAA+AYH//////////////AAAAD//wAAAAP3/YAHAAAAuACA//////////////gAAAH8AAAAf8///wABAAAAECACn8f/Of////////8AAADwAAAf/////wAAAAAABAAAD8H+A//////////AAADgAAB//////AAAAAAAAAABh4D8B//////////AAABgAAD//////AAAAAAAAAABAABgA//////////AAAAAAAH//////gAAAAAAAAAAAAAAA//////////AAABgAA///////wAAAAAAAAAAAAAAB//////////AAADwAB///////wAAAAAAAYAAAAABB//////////AAAD4EH///////4AAAAAAAf8AAAA8A//////////AAAD//v///////wAAAAAAAB+AAAB8A//////////AAAH//////////wAAAAAAAAAAAAD4A//////////AAAH//////////gAAAAAAAAAAAABgA//////////AAAH//////////AAAAAAAAAAAAAAAA//////////AAAP/////////+AAAAAAAAAAAAAAAB//////////AAAP/////////+AAAAAAAAAAAAAAAB//////////AAAf/////////+AAAAAAAAAAAAAAAD//////////AAB///////////AAAAAAAAAAAAAAAD//////////AAH///////////4AAAAAAAAAAAAAAH//////////AAf///////////4AAAAAAAAAAAAAAH//////////AA////////////+AAAAAAAAAAAAAAH//////////AA/////////////iAAAAAwAAAAAAAP//////////AB//////////////wAAAH+AAAAAAAP//////////AD//////////////8AAAP/AAAAAAAP//////////AD///////////////AAAf/AAAAAAAP//////////AD///////////////gAA//4AAAAAAf//////////AH///////////////gAA///gAAAAAf//////////AH///////////////gAA///gAAAAAf//////////AP///////////////wAA////gADoA///////////AP///////////////4AA////8APwB///////////AP////////////////wAf////A/6v///////////AP////////////////8A/////5//////////////AP/////////////////A////////////////////AH/////////////////h////////////////////AH/////////////////3//////////////////f/AH////////////////////////////////////B/AP///////////////////////////////////4B/AP/////////////////////////8/////////8A/Af/////////////////////////+/////////wAfA//////////////////////////+/v///////4AfA//////////////////////////+fv///////8APB///////////////////////////fv///////8APH///////////////////////////P////////8APH///////////////////////////vf///////+AHP///////////////////////////nf///////+AH////////////////////////////3P///////+AH////////////////////////////7H////////AD////////////////////////////4D////////AA////////////////////////////4D////////wA////////////////////////////8B////////wA////////////////////////////8B////////4A////////////////////////////8A////////8A////////////////////////////8Af///////+A////////////////////////////+Af///////+A////////////////////////////+AP///////+A/////////////////////////////AP///////+g'), c => c.charCodeAt(0));
const isLand2 = (x, y) => x >= 0 && y >= 0 && x < BW2 && y < BH2 && (LAND2[(y * BW2 + x) >> 3] & (128 >> ((y * BW2 + x) & 7)));
const bmImg = bmx.createImageData(BW2, BH2), bmBuf = new Uint32Array(bmImg.data.buffer), bmBase = new Uint32Array(BW2 * BH2);
for (let y = 0; y < BH2; y++) for (let x = 0; x < BW2; x++) {
  const l = isLand2(x, y), coast = l && (!isLand2(x + 1, y) || !isLand2(x - 1, y) || !isLand2(x, y + 1) || !isLand2(x, y - 1));
  bmBase[y * BW2 + x] = pk(l ? (coast ? [154, 107, 64] : ((x * 7 + y * 13) % 17 === 0 ? [226, 200, 146] : [239, 217, 168])) : (BAYER[(x & 3) + ((y & 3) << 2)] < 3 ? [70, 108, 140] : [79, 120, 153]));
}
function drawBigMap(t) {
  const B = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < BW2 && y < BH2) bmBuf[y * BW2 + x] = c; };
  const ink = pk([58, 36, 24]), gold = pk([232, 163, 58]), cream = pk([251, 241, 220]);
  bmBuf.set(bmBase);
  for (let k = 0; k < NCH; k++) for (let i = 0; i < 60; i += 3) { const [x, y] = mapPos(k + i / 60); B(x * 2, y * 2, ink); }
  const here = shown !== null ? WHERE[chap(shown)] : null;
  for (const [name, [x, y]] of Object.entries(CITY)) {
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) B(x * 2 + i, y * 2 + j, ink);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) B(x * 2 + i, y * 2 + j, name === here ? gold : cream);
  }
  const [tx, ty] = mapPos(wx / GAP);
  if ((t * 3 | 0) % 4) { for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) B(tx * 2 + i, ty * 2 + j, ink); for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) B(tx * 2 + i, ty * 2 + j, gold); }
  bmx.putImageData(bmImg, 0, 0);
}
// each city's card sits in open water or empty land, joined to its pin by a leader line
const CARD_AT = { lausanne: [2, 6], zurich: [42, 4], barcelona: [3, 66], ankara: [63, 72] };
const bmLines = document.getElementById('bmlines');
for (const city of Object.keys(CITY)) {
  const box = document.createElement('div');
  box.className = 'bml'; box.dataset.city = city; box.style.left = CARD_AT[city][0] + '%'; box.style.top = CARD_AT[city][1] + '%';
  box.innerHTML = `<strong>${city === 'zurich' ? 'Zürich' : city[0].toUpperCase() + city.slice(1)}</strong>`;
  STOPS.forEach((s, i) => {
    if (WHERE[i] !== city) return;
    const b = document.createElement('button'); b.type = 'button';
    b.dataset.long = s.sign ? `${s.sign} ${s.title}` : 'camp'; b.dataset.short = s.sign || 'camp'; b.title = s.title;
    b.onclick = () => { rideTo(i); bigMap(false); };
    box.appendChild(b);
  });
  bmw.appendChild(box);
}
function layoutCards() {
  let r = bmw.getBoundingClientRect();
  const narrow = r.width < 560;
  bmw.classList.toggle('compact', narrow);
  for (const b of bmw.querySelectorAll('.bml button')) b.textContent = narrow ? b.dataset.short : b.dataset.long;
  r = bmw.getBoundingClientRect();
  let svg = '';
  for (const box of bmw.querySelectorAll('.bml')) {
    // keep every card inside the map
    box.style.left = CARD_AT[box.dataset.city][0] + '%'; box.style.top = CARD_AT[box.dataset.city][1] + '%';
    let c = box.getBoundingClientRect();
    if (c.bottom > r.bottom - 4) box.style.top = (c.top - r.top - (c.bottom - r.bottom + 6)) + 'px';
    if (c.right > r.right - 4) box.style.left = (c.left - r.left - (c.right - r.right + 6)) + 'px';
    c = box.getBoundingClientRect();
    const [cx0, cy0] = CITY[box.dataset.city], px = cx0 / MW * r.width, py = cy0 / MH * r.height;
    // from the nearest point on the card's edge to the pin
    const ex = cl(px, c.left - r.left, c.right - r.left), ey = cl(py, c.top - r.top, c.bottom - r.top);
    svg += `<line x1="${ex}" y1="${ey}" x2="${px}" y2="${py}"/>`;
  }
  bmLines.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); bmLines.innerHTML = svg;
}
addEventListener('resize', () => { if (bmEl.classList.contains('on')) layoutCards(); });
function bigMap(on) {
  bmEl.classList.toggle('on', on);
  if (!on) return;
  track('map', 'opened the big map');
  drawBigMap(T0); layoutCards();
}
mc.addEventListener('click', e => { e.stopPropagation(); bigMap(true); });
document.getElementById('bmx').onclick = () => bigMap(false);
bmEl.addEventListener('click', e => { if (e.target === bmEl) bigMap(false); });
const yrBtns = [...yrs.children];
const nearest = () => Math.round(wx / GAP);
function go(k) { target = Math.max(0, k) * GAP; }
const moving = () => Math.abs(target - wx) > 1;
function next() {
  if (typing) { finishTyping(); return; }
  if (moving() && target > wx) { hurry = 2.6; return; }   // a second click hurries the camel along
  const k = nearest(); go(Math.abs(wx - k * GAP) < 20 ? k + 1 : (wx < k * GAP ? k : k + 1));
}
function prevStop() { hurry = 1; const k = nearest(); go(Math.abs(wx - k * GAP) < 20 ? k - 1 : (wx > k * GAP ? k : k - 1)); }
// straight to the next campfire, no riding
function skipToCamp(openJournal) {
  const k = nearest(), atCampNow = chap(k) === 0 && Math.abs(wx - k * GAP) < 1;
  if (!atCampNow) { wx = target = (Math.floor(k / NCH) + 1) * NCH * GAP; vel = 0; campT = CAMP_END; hurry = 1; prints.length = 0; dust.length = 0; }
  if (openJournal) journal(true);
}
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect(), ix = (e.clientX - r.left) / SC, iy = (e.clientY - r.top) / SC;
  for (let k = Math.floor(wx / GAP) - 1; k <= Math.floor(wx / GAP) + 2; k++) {
    if (chap(k) !== 6) continue;
    const tx = Math.round(k * GAP - wx + TSX) + 60;
    if (ix > tx - 6 && ix < tx + 18 && iy > GROUND - 30 && iy < GROUND + 4) { lens(true); return; }
  }
  if (ix > TSX - 22 && ix < TSX + 24 && iy > GROUND - FOOT - 12 && iy < GROUND + 2) { sayIt(['GRR', 'HMPH', 'GRR!'][Math.random() * 3 | 0], 1.2); sfxGrunt(); }
  next();
});
document.getElementById('b-next').onclick = next;
document.getElementById('b-prev').onclick = prevStop;
const skipBtn = document.getElementById('b-skip');
skipBtn.onclick = () => skipToCamp(false);
document.getElementById('b-jr').onclick = () => journal(true);
for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) addEventListener(ev, () => { lastInput = T0; }, { passive: true });
jr.addEventListener('wheel', e => {
  if (jEl.classList.contains('on') || lEl.classList.contains('on') || bmEl.classList.contains('on')) return;
  e.preventDefault();
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  target = Math.max(0, target + d * .55); lastWheel = T0; hurry = 1;
}, { passive: false });
addEventListener('keydown', e => {
  if (e.key === 'Escape') { journal(false); lens(false); bigMap(false); }
  if (jEl.classList.contains('on') || lEl.classList.contains('on') || bmEl.classList.contains('on')) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); prevStop(); }
  if (e.key === 'End') skipToCamp(false);
});
// on phones a swipe is a step: left for the next stop, right for the previous one
let tx0 = null, ty0 = 0;
jr.addEventListener('touchstart', e => { if (e.target.closest('.journal, .lens, .top, .box')) { tx0 = null; return; } tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; }, { passive: true });
jr.addEventListener('touchend', e => {
  if (tx0 == null) return;
  const t = e.changedTouches[0], dx = t.clientX - tx0, dy = t.clientY - ty0; tx0 = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { if (typing) finishTyping(); if (dx < 0) next(); else prevStop(); }
}, { passive: true });

// the journal: the whole CV, no animation
const jEl = document.getElementById('journal'), pg = document.getElementById('pg');
pg.innerHTML = `<button class="x" type="button" id="jx">close ✕</button><h2>THE JOURNAL</h2><p class="sub">Mohamad Fakhouri, machine learning engineer. <a href="mailto:mohahf19@gmail.com">mohahf19@gmail.com</a> · <a href="https://github.com/mohahf19" target="_blank" rel="noopener">GitHub</a></p>` +
  STOPS.slice(1).reverse().map(s => `<div class="e"><div class="y">${s.when}</div><div><strong>${s.title.toUpperCase()}</strong><p>${s.text.replace(/ <a href="#" data-lens>[^<]*<\/a>\./, '')}</p></div></div>`).join('') +
  `<h3>WRITING &amp; TALKS</h3>` +
  (window.STORY.writing || []).map(s => `<div class="e"><div class="y">${s.when}</div><div><strong>${s.title.toUpperCase()}</strong><p>${s.text}</p></div></div>`).join('') +
  versionLine();
// the release this page came from, stamped in by the deploy workflow (shows "dev" when previewing locally)
function versionLine() {
  const m = document.querySelector('meta[name="site-version"]'), v = m && m.content, built = m && m.dataset.built;
  if (!v || v.startsWith('__')) return '';
  const when = new Date(built + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return `<p class="ver"><a href="https://github.com/mohahf19/mohahf19.github.io/releases/tag/${v}" target="_blank" rel="noopener">${v}</a> · ${when}</p>`;
}
function journal(on) { jEl.classList.toggle('on', on); if (on) track('journal', 'opened the journal'); }
document.getElementById('jx').onclick = () => journal(false);
jEl.addEventListener('click', e => { if (e.target === jEl) journal(false); });
box.addEventListener('click', e => {
  const a = e.target.closest('[data-journal]'); if (a) { e.preventDefault(); journal(true); }
  const l = e.target.closest('[data-lens]'); if (l) { e.preventDefault(); lens(true); }
});

// ---------- through the telescope: a non-convex surface and two optimisers ----------
const lEl = document.getElementById('lens'), lc = document.getElementById('lc'), lx = lc.getContext('2d'), LSZ = 180;
const surf = (x, y) => .07 * (x * x + y * y) - 1.3 * Math.exp(-((x - 1.3) ** 2 + (y - .9) ** 2) / .6) - .75 * Math.exp(-((x + 1.4) ** 2 + (y + 1.1) ** 2) / .45)
  - .55 * Math.exp(-((x + .4) ** 2 + (y - 1.8) ** 2) / .35) + .18 * Math.sin(1.7 * x) * Math.cos(1.7 * y);
const sgrad = (x, y) => { const h = 1e-4; return [(surf(x + h, y) - surf(x - h, y)) / (2 * h), (surf(x, y + h) - surf(x, y - h)) / (2 * h)]; };
const lproj = (x, y, z) => [90 + (x - y) * 13, 94 + (x + y) * 6.2 - z * 22];
let lensT = 0, lpaths = null, lbg = null;
function optPath(x, y, beta) {
  const pts = [[x, y]]; let vx = 0, vy = 0;
  for (let i = 0; i < 240; i++) { const [a, b] = sgrad(x, y); vx = beta * vx - .05 * a; vy = beta * vy - .05 * b; x = cl(x + vx, -3, 3); y = cl(y + vy, -3, 3); pts.push([x, y]); }
  return pts;
}
function lensStart(random) {
  const s = random ? [-2.6 + 5.2 * Math.random(), -2.6 + 5.2 * Math.random()] : [2.36, -1.25];
  lpaths = [optPath(s[0], s[1], 0), optPath(s[0], s[1], .9)]; lensT = 0;
}
function lensSurface() {
  const c = document.createElement('canvas'); c.width = c.height = LSZ; const g = c.getContext('2d');
  g.fillStyle = '#0e1030'; g.fillRect(0, 0, LSZ, LSZ);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(235,232,255,${.3 + hash(i, 7) * .6})`; g.fillRect(hash(i, 5) * LSZ | 0, hash(i, 6) * LSZ * .5 | 0, 1, 1); }
  const N = 44, ramp = [[0, '#1b2a5a'], [.22, '#2f5fa0'], [.42, '#3f9aa0'], [.6, '#8cc47a'], [.8, '#e8cf7a'], [1, '#f0a060']];
  const col = h => { let i = 0; while (i < ramp.length - 2 && h > ramp[i + 1][0]) i++; const [a, ca] = ramp[i], [b, cb] = ramp[i + 1]; return mixc(hex(ca), hex(cb), cl((h - a) / (b - a), 0, 1)); };
  const X = i => -3 + 6 * i / N, Z = [];
  for (let i = 0; i <= N; i++) { Z[i] = []; for (let j = 0; j <= N; j++) Z[i][j] = surf(X(i), X(j)); }
  // back to front: cells further up the screen first
  for (let sdiag = 0; sdiag <= 2 * N - 2; sdiag++) for (let i = 0; i < N; i++) {
    const j = sdiag - i; if (j < 0 || j >= N) continue;
    const z = (Z[i][j] + Z[i + 1][j] + Z[i][j + 1] + Z[i + 1][j + 1]) / 4, h = (z + 1.12) / 2.44;
    const shade = cl(1 + ((Z[i][j] - Z[i + 1][j]) - (Z[i][j] - Z[i][j + 1])) * 1.6, .55, 1.35);
    const cc = col(h).map(v => v * shade);
    g.fillStyle = `rgb(${cc.map(v => cl(v | 0, 0, 255)).join(',')})`;
    g.beginPath();
    for (const [a, b] of [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]) { const [px, py] = lproj(X(a), X(b), Z[a][b]); g.lineTo(px, py); }
    g.closePath(); g.fill();
    if (i % 4 === 0 || j % 4 === 0) { g.strokeStyle = 'rgba(10,8,30,.28)'; g.lineWidth = .5; g.stroke(); }
  }
  return c;
}
function drawLens(dt) {
  lensT += dt;
  if (!lbg) lbg = lensSurface();
  lx.imageSmoothingEnabled = false; lx.drawImage(lbg, 0, 0);
  const n = Math.min(240, Math.floor(lensT * 55));
  [['#ff5a4a', lpaths[0]], ['#ffd84a', lpaths[1]]].forEach(([c, pts]) => {
    lx.strokeStyle = c; lx.lineWidth = 1; lx.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = pts[i], [px, py] = lproj(x, y, surf(x, y) + .03); i ? lx.lineTo(px, py) : lx.moveTo(px, py); }
    lx.stroke();
    const [x, y] = pts[n], [px, py] = lproj(x, y, surf(x, y) + .03);
    lx.fillStyle = '#1e1410'; lx.fillRect((px | 0) - 2, (py | 0) - 2, 5, 5); lx.fillStyle = c; lx.fillRect((px | 0) - 1, (py | 0) - 1, 3, 3);
  });
  const [sx0, sy0] = lpaths[0][0], [qx, qy] = lproj(sx0, sy0, surf(sx0, sy0) + .03);
  lx.fillStyle = '#ffffff'; lx.fillRect((qx | 0) - 1, (qy | 0) - 1, 3, 3);
}
function lens(on) { if (on) { lensStart(false); track('telescope', 'looked through the telescope'); } lEl.classList.toggle('on', on); }
document.getElementById('l-new').onclick = () => lensStart(true);
document.getElementById('l-x').onclick = () => lens(false);
lEl.addEventListener('click', e => { if (e.target === lEl) lens(false); });

// dialog: types itself out like an old adventure game
function showStop(k) {
  if (shown === k) return;
  shown = k; const s = STOPS[chap(k)];
  track('stop/' + s.title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), s.title);
  if (chap(k) === 0 && k > 0) track('lap', 'rode a full lap');
  bt.textContent = s.title.toUpperCase(); bw.textContent = s.when;
  fullHTML = chap(k) === 0 && k > 0 ? s.back : s.text; typed = 0; typing = true; bb.innerHTML = '';
  box.classList.add('on'); box.classList.remove('done');
}
function hideStop() { if (shown === null) return; shown = null; typing = false; box.classList.remove('on'); }
function finishTyping() { typing = false; bb.innerHTML = fullHTML; box.classList.add('done'); }
function typeStep(dt) {
  if (!typing) return;
  typed += dt * 55;
  const plain = fullHTML.replace(/<[^>]+>/g, '');
  if (typed >= plain.length) { finishTyping(); return; }
  bb.textContent = plain.slice(0, typed | 0);
}

// ---------- frame ----------
function draw(t) {
  const p = mod(wx, LOOP) / LOOP;
  setTime(p);
  alps = smooth(3.25, 3.9, p * NCH) * (1 - smooth(5.6, 6.3, p * NCH));
  jr.classList.toggle('day', night < .2 && p > .2 && p < .72);
  for (let y = 0; y < GROUND; y++) {
    const lv = y / (HORIZON + 6) * 7;
    for (let x = 0; x < VW; x++) buf[y * VW + x] = sky.bands[cl(Math.round(lv + BAYER[(x & 3) + ((y & 3) << 2)] / 16 - .5), 0, 7)];
  }
  if (night > .25) for (const [sx, sy, tw] of STARS) { if (tw > (night - .25) * 2.2) continue; if (Math.sin(t * 2 + tw * 40) > -.6) P(sx * VW | 0, sy * HORIZON | 0, pk([235, 232, 255])); }
  if (night > .45) for (const m of meteors) for (let k = 0; k < 6; k++) P(m.x - m.vx * k * .012, m.y - m.vy * k * .012, pk(mixc(sky.top, [255, 250, 230], 1 - k / 6)));
  // sun and moon ride opposite ends of one wheel that turns once per loop:
  // the sun is up from dawn (p .12) to dusk (p .88), the moon from dusk, over the camp, to dawn
  const ph = p < .12 ? p + 1 : p;
  const ang = ph <= .88 ? (ph - .12) / .76 * Math.PI : Math.PI + (ph - .88) / .24 * Math.PI;
  const orb = a => [VW / 2 - Math.cos(a) * (VW / 2 - 24), HORIZON + 6 - Math.sin(a) * 84];
  const [sunX, sunY] = orb(ang), [mx, my] = orb(ang + Math.PI);
  if (sunY < HORIZON + 16) {
    const hc = pk(mixc(sky.bot, [255, 236, 170], .25));
    for (let r = 13; r >= 10; r--) for (let a = 0; a < 64; a++) { const xx = sunX + Math.cos(a / 64 * 6.283) * r, yy = sunY + Math.sin(a / 64 * 6.283) * r; if (((xx | 0) + (yy | 0)) & 1) P(xx, yy, hc); }
    disc(sunX | 0, sunY | 0, 8, pk(mixc([255, 226, 140], [255, 140, 70], warm)));
  }
  if (my < HORIZON + 14) {
    // tonight's real phase: lit where the terminator says so, a faint earthshine elsewhere
    const lit = pk([240, 236, 214]), dark = pk(mixc(sky.top, [240, 236, 214], .1)), tt = Math.cos(2 * Math.PI * MOON), r = 7;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + r * .6) continue;
      const nx = x / r, w = Math.sqrt(Math.max(0, 1 - (y / r) ** 2)), on = MOON < .5 ? nx > tt * w : nx < -tt * w;
      P((mx | 0) + x, (my | 0) + y, on ? lit : dark);
    }
  }
  for (let x = 0; x < VW; x++) {
    const fx = x + wx * .25, h = farH(fx), top = Math.round(HORIZON - h), lit = farH(fx + 1) < h;
    for (let y = top; y < MIDB + 4; y++) {
      const snow = h > SNOW_H && y < top + Math.min(SNOW_D, (h - SNOW_H) * .6 + 1);
      buf[y * VW + x] = snow ? haze(lit ? '#ffffff' : '#c9cbe0', .25) : h > 18 ? haze(lit ? '#a59cb6' : '#7b7392', .45) : haze('#c9a07a', .5);
    }
  }
  // middle layer: the cities of each chapter, a lake for Lausanne, a tram for Zürich
  const kLo = Math.floor((wx - TSX) / GAP) - 4, kHi = Math.ceil((wx - TSX + VW) / GAP) + 4, cMid = haze('#8f7488', .35);
  for (let k = kLo; k <= kHi; k++) {
    const c = chap(k), m = Math.round(k * GAP * .5 + TSX + 46 - wx * .5);
    if (m < -140 || m > VW + 140) continue;
    if (c === 1) ankara(m - 10, MIDB + 3, cMid);
    if (c === 3) sagrada(m - 4, MIDB + 3, cMid, haze('#c9a8a8', .35));
    if (c === 5) zurich(m - 10, MIDB + 3, cMid);
  }
  for (let k = kLo; k <= kHi; k++) {
    const c = chap(k);
    if (c === 3) balloonCam(Math.round(k * GAP * .8 + TSX + 74 - wx * .8), 36 + Math.round(Math.sin(t * 1.3) * 2), t);
    if (c === 6) constellation(Math.round(k * GAP * .85 + TSX + 70 - wx * .85), 26, cl(night * 1.6 + .25, 0, 1));
  }
  // where Lausanne is, the dunes give way to Lake Geneva, which runs to the foot of the Alps
  const lakes = [];
  for (let k = kLo; k <= kHi; k++) if (chap(k) === 4) { const m = Math.round(k * GAP * .5 + TSX + 46 - wx * .5); lakes.push([m - 215, m + 185]); }
  const WT = MIDB - 8, SHORE = GROUND - 3;
  for (let x = 0; x < VW; x++) {
    const mx = x + wx * .5, top = Math.round(MIDB + 2.5 * Math.sin(mx * .045) + 1.8 * Math.sin(mx * .11 + 2));
    const lk = lakes.find(([a, b]) => x >= a && x <= b);
    if (!lk) { for (let y = top; y < GROUND; y++) buf[y * VW + x] = y === top ? haze('#ecc283', .2) : haze('#dcab69', .2); continue; }
    // the shoreline curls in at both ends of the lake
    const edge = Math.min(x - lk[0], lk[1] - x), wt = WT + Math.max(0, 12 - edge);
    for (let y = Math.min(top, wt); y < wt; y++) buf[y * VW + x] = y === top ? haze('#ecc283', .2) : haze('#dcab69', .2);
    for (let y = wt; y < SHORE; y++) {
      // the water mirrors the mountains and sky above it, rippling
      const ry = 2 * WT - y - 1, sx = cl(x + Math.round(Math.sin(y * 1.9 + t * 2.2)), 0, VW - 1), src = ry >= 0 ? buf[ry * VW + sx] : 0;
      const water = mixc(tintRGB([79, 128, 168]), sky.bot, .25 - (y - WT) * .015);
      const rc = [src & 255, (src >> 8) & 255, (src >> 16) & 255];
      buf[y * VW + x] = pk(mixc(rc, water, .55 + (y - WT) * .025));
      if (hash(x + Math.round(wx * .5), y + (t * 3 | 0)) > .985) buf[y * VW + x] = pk(mixc(water, [255, 255, 255], .6));
    }
    buf[SHORE * VW + x] = T('#c99a5c'); buf[(SHORE + 1) * VW + x] = T('#e6b870'); buf[(SHORE + 2) * VW + x] = T('#e6b870');
  }
  for (let k = kLo; k <= kHi; k++) {
    const c = chap(k), m = Math.round(k * GAP * .5 + TSX + 46 - wx * .5);
    if (m < -140 || m > VW + 140) continue;
    if (c === 4) {
      // two sails drifting across, and the Rolex Learning Center on the near shore
      sail(m - 150 + Math.round(mod(t * 2.5, 300)), WT + 4, 1);
      sail(m + 120 - Math.round(mod(t * 1.6 + 90, 300)), WT + 8, 2);
      rolex(m - 6, SHORE, haze('#e3ddd2', .15), haze('#8aa0b8', .2));
    }
    if (c === 5) tram(m - 30 + Math.round(mod(t * 14, 110)), GROUND - 1);
  }
  for (let y = GROUND; y < VH; y++) for (let x = 0; x < VW; x++) {
    const gxw = x + Math.round(wx), h = hash(gxw, y);
    const rip = ((gxw + (y - GROUND) * 3) % 23 + 23) % 23 < 2 && (y - GROUND) % 5 === 2;
    buf[y * VW + x] = y === GROUND ? T('#f6d697') : rip ? T('#d9a95e') : h < .05 ? T('#d4a155') : h > .985 ? T('#fbe3b0') : T('#ecbf75');
  }
  const scr = w => Math.round(w - wx + TSX);
  const campK = Math.round(wx / LOOP) * NCH, fireX = scr(campK * GAP + 46);
  if (night > .3 && fireX > -60 && fireX < VW + 60) {
    for (let y = GROUND - 44; y < VH; y++) for (let x = Math.max(0, fireX - 86); x < Math.min(VW, fireX + 86); x++) {
      const d = Math.hypot((x - fireX) * .7, (y - GROUND + 4) * 1.6) / 60;
      if (d < 1 && BAYER[(x & 3) + ((y & 3) << 2)] / 16 < (1 - d) * (1 - d) * .7) { const i = y * VW + x, c = buf[i]; buf[i] = pk(mixc([c & 255, (c >> 8) & 255, (c >> 16) & 255], [255, 160, 70], .35)); }
    }
  }
  for (const f of prints) { const x = scr(f.x); if (x > -2 && x < VW) P(x, GROUND + 1 + f.r, T('#c99550')); }
  for (let k = kLo; k <= kHi; k++) {
    const c = chap(k), sx = scr(k * GAP);
    if (sx < -110 || sx > VW + 110) continue;
    const G1 = GROUND + 1;
    // SCENES: what stands at each stop, by its position in story.js
    if (STOPS[c].sign) sign(sx + 36, GROUND + 2, STOPS[c].sign);
    if (c === 0 && LANTERNS) lanterns(sx - 34, sx + 84, G1 - 26, t);
    if (c === 0) { palm(sx - 40, G1, 20); rug(sx + 19, G1, 20); fire(sx + 46, G1, t); dallah(sx + 56, G1); steam(sx + 59, G1 - 13, t); tent(sx + 78, G1, 28, 13); }
    if (c === 1) { bilkentBanner(sx + 52, G1); chalkboard(sx + 94, G1, t); books(sx + 144, G1); }
    if (c === 2) { helix(sx + 64, G1, t); scroll(sx + 80, G1); }
    if (c === 3) photoBoard(sx + 52, G1);
    if (c === 4) { epflBanner(sx + 50, G1); lectern(sx + 84, G1, t); }
    if (c === 5) { zurichSign(sx + 54, G1); serverRack(sx + 126, G1, t); zurichFlag(sx + 152, G1, t); }
    if (c === 6) {
      telescope(sx + 60, G1);
      // a blinking arrow invites a look through it
      if (Math.abs(wx - k * GAP) < 6 && (t * 2.5 | 0) % 2) { const ax = sx + 66, ay = G1 - 24; R(ax - 1, ay, 3, 4, pk([255, 236, 160])); R(ax - 3, ay + 4, 7, 1, pk([255, 236, 160])); R(ax - 2, ay + 5, 5, 1, pk([255, 236, 160])); P(ax, ay + 6, pk([255, 236, 160])); }
    }
  }
  for (const d of dust) P(scr(d.x), Math.round(d.y), pk(mixc(tintRGB(hex('#f3d9a6')), sky.bot, .2)));

  // the traveller, and at the camp: kneel, jump down, walk to the fire, sit
  const kneel = smooth(0, 1.2, Math.max(campT, rest));
  drawCamel(TSX, GROUND + 1, phase, gaitAmp, kneel, campT < 1.2, t);
  if (campT >= 1.2) {
    const seatX = TSX + 10, seatY = GROUND + 1 - FOOT - 12 + DROP, landX = TSX + 24, sitX = fireX - 22, wdir = campDir;
    if (campT < 1.8) {
      const j = (campT - 1.2) / .6;
      drawSprite(SPR.stand0, Math.round(seatX + (landX - seatX) * j), Math.round(seatY + (GROUND + 1 - 16 - seatY) * j - Math.sin(Math.PI * j) * 10), 1, true);
    } else if (campT < 2.9) {
      const w = (campT - 1.8) / 1.1, x = landX + (sitX - landX) * w;
      drawSprite(((w * 9) | 0) % 2 ? SPR.stand1 : SPR.stand0, Math.round(x), GROUND + 1 - 16 - (((w * 9) | 0) % 2), wdir, true);
    } else drawSprite(SPR.sit, sitX, GROUND + 1 - 13, 1, true);
  }
  const css = c => `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`, key = css(sky.bands[0]) + css(T('#ecbf75')) + cvTop;
  if (key !== bgKey) { bgKey = key; jr.style.background = `linear-gradient(${css(sky.bands[0])} 0 ${cvTop + 2}px, ${css(T('#ecbf75'))} ${cvTop + 2}px)`; }
  if (WINTER) { const u = mod(wx, LOOP) / GAP; snowfall(t, smooth(3.5, 4, u) * (1 - smooth(5.5, 6, u))); }
  if (say.until > T0) bubble(TSX + 12, GROUND + 1 - FOOT - 22 + Math.round(smooth(0, 1.2, Math.max(campT, rest)) * DROP), say.text);
  cx.putImageData(img, 0, 0);
}

// ---------- visitor stats: GoatCounter events, once per visit each; nothing happens without its script ----------
const counted = new Set();
function track(path, title) {
  if (counted.has(path) || !window.goatcounter || !window.goatcounter.count) return;
  counted.add(path); window.goatcounter.count({ path, title, event: true });
}

// ---------- sound: off until asked for, all of it synthesised here ----------
// no music: footsteps, the camel's voice, and a background for each stop that fades in as you ride up
const SND = { on: false, ctx: null, beds: [], lastShutter: 0, lastTram: 0 };
function soundStart() {
  if (!SND.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const c = SND.ctx = new AC(), m = SND.master = c.createGain(); m.gain.value = .8; m.connect(c.destination);
    const nb = SND.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // a looping bed: noise (or a hum) through a filter into its own gain, silent until a stop is near
    const bed = (type, freq, q, hum) => {
      const g = c.createGain(); g.gain.value = 0; g.connect(m);
      if (hum) for (const [f, a] of hum) { const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f; og.gain.value = a; o.connect(og).connect(g); o.start(); }
      else { const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = nb; s.loop = true; s.playbackRate.value = .7 + Math.random() * .3; f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f).connect(g); s.start(0, Math.random() * 1.9); }
      return g;
    };
    SND.wind = bed('bandpass', 480, .7);
    SND.beds = [
      bed('lowpass', 420, .7),                       // camp: the low roar of the fire
      null,                                          // Bilkent: chalk only, below
      bed(null, 0, 0, [[100, .6], [200, .25], [300, .08]]),   // Çiçek Lab: equipment hum
      bed('bandpass', 1500, .35),                    // Near Space Labs: thin, high wind
      bed('lowpass', 650, .8),                       // EPFL: water on the lake shore
      bed('bandpass', 260, 1.1),                     // QuantCo: the server rack's fans
      null,                                          // Research: crickets only, below
    ];
  }
  SND.ctx.resume(); return true;
}
function noiseHit(t0, dur, freq, type, gain) {
  const c = SND.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = SND.noise; s.playbackRate.value = .8 + Math.random() * .4; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + .005); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(f).connect(g).connect(SND.master); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + .05);
}
function tone(t0, type, f0, f1, dur, gain, filt) {
  const c = SND.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  f.type = 'lowpass'; f.frequency.value = filt;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(f).connect(g).connect(SND.master); o.start(t0); o.stop(t0 + dur + .05);
  return o;
}
// padded feet in sand: a muffled thud and a little hiss
function sfxStep(v) {
  if (!SND.on || v < .3) return;
  const t0 = SND.ctx.currentTime;
  noiseHit(t0, .09, 420, 'lowpass', .18 * v); tone(t0, 'sine', 75, 45, .12, .22 * v, 400);
}
// a camel's grumble: a low, wobbling growl and a breath
function sfxGrunt() {
  if (!SND.on) return;
  const c = SND.ctx, t0 = c.currentTime, o = tone(t0, 'sawtooth', 120, 70, .55, .2, 650), lfo = c.createOscillator(), lg = c.createGain();
  lfo.frequency.value = 22; lg.gain.value = 18; lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + .6);
  noiseHit(t0 + .05, .35, 700, 'lowpass', .08);
}
// a chalk stroke: a run of tiny scratches, the way chalk skips across a board
function chalkStroke(t0, dur, v) {
  if (dur < .05) return;
  const c = SND.ctx, s = c.createBufferSource(), bp = c.createBiquadFilter(), hp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = SND.noise; s.loop = true; s.playbackRate.value = .9 + Math.random() * .2;
  bp.type = 'bandpass'; bp.frequency.value = 1900 + Math.random() * 500; bp.Q.value = .8; hp.type = 'highpass'; hp.frequency.value = 700;
  const n = Math.max(8, Math.floor(dur * 45)), curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const e = Math.min(1, i / (n * .12), (n - 1 - i) / (n * .15)); curve[i] = (.45 + .55 * Math.random()) * .11 * v * Math.max(0, e); }
  g.gain.setValueCurveAtTime(curve, t0, dur);
  s.connect(bp).connect(hp).connect(g).connect(SND.master); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
}
// one cricket: three quick pulses
function cricket(t0, v) { const f = 4100 + Math.random() * 500; for (let i = 0; i < 3; i++) tone(t0 + i * .045, 'sine', f, f * .98, .025, .05 * v, 8000); }
// how close the camel is to the nearest stop of chapter c, from 1 (there) to 0 (far)
const near = c => { const at = Math.round((wx - c * GAP) / LOOP) * LOOP + c * GAP; return cl(1 - Math.abs(wx - at) / 210, 0, 1); };
// every frame: set each stop's background, and scatter its little events
function soundTick(dt) {
  if (!SND.on || !SND.ctx) return;
  const c = SND.ctx, now = c.currentTime, roll = r => Math.random() < dt * r;
  const w = Array.from({ length: NCH }, (_, k) => near(k));
  SND.wind.gain.setTargetAtTime((.03 + .015 * Math.sin(T0 * .31) + .01 * Math.sin(T0 * .13)) * (1 - night * .4), now, .5);
  const lvl = [.16 * (.85 + .15 * Math.sin(T0 * 9) * Math.sin(T0 * 2.3)), .022 * (.7 + .3 * Math.sin(T0 * .9)), .02, .06 * (.6 + .4 * Math.sin(T0 * .5)), .05 * (.55 + .45 * Math.sin(T0 * 1.25)), .05];
  SND.beds.forEach((g, k) => { if (g) g.gain.setTargetAtTime(lvl[k] * w[k], now, .3); });
  // camp: crackles, the odd pop, crickets at night
  if (roll(14 * w[0])) noiseHit(now, .01 + Math.random() * .025, 2200 + Math.random() * 3000, 'highpass', (.06 + Math.random() * .22) * w[0]);
  if (roll(.8 * w[0])) noiseHit(now, .06, 900, 'bandpass', .3 * w[0]);
  if (roll(1.6 * (w[0] * night + w[6]))) cricket(now, w[0] + w[6]);
  // Bilkent: the sound follows the chalk you can see: a scratch per stroke, a tap for the dot, the eraser's swish
  const { f: cf, u: cu, i: ci } = chalkNow(T0), cp = SND.chalkI === ci && SND.chalkU !== undefined ? SND.chalkU : -1;
  SND.chalkU = cu; SND.chalkI = ci;
  const crossed = at => cp < at && cu >= at;
  if (w[1] > 0) {
    for (const st of cf.plan) if (crossed(st.t0)) chalkStroke(now, st.t1 - st.t0, w[1]);
    if (crossed(cf.wipe0)) { const sw = cf.wipe1 - cf.wipe0; for (let i = 0; i < 4; i++) noiseHit(now + i * sw / 4, sw / 4 + .05, 900, 'lowpass', .1 * w[1]); }
  }
  // Çiçek Lab: equipment beeps
  if (roll(.35 * w[2])) { tone(now, 'sine', 1320, 1320, .07, .05 * w[2], 5000); if (Math.random() < .4) tone(now + .12, 'sine', 1320, 1320, .07, .05 * w[2], 5000); }
  // Near Space Labs: the balloon camera's shutter, in time with its flash
  const flash = Math.floor(T0 / 3.2);
  if (flash !== SND.lastShutter) { SND.lastShutter = flash; if (w[3] > 0) { noiseHit(now, .012, 4000, 'highpass', .25 * w[3]); noiseHit(now + .06, .015, 3000, 'highpass', .18 * w[3]); } }
  // EPFL: a bird over the lake
  if (roll(.3 * w[4])) for (let i = 0; i < 2; i++) tone(now + i * .11, 'sine', 2300 + Math.random() * 400, 3400, .08, .03 * w[4], 8000);
  // QuantCo: the tram's bell
  if (w[5] > 0 && T0 - SND.lastTram > 7 + Math.random() * 4) {
    SND.lastTram = T0;
    for (const dly of [0, .28]) { tone(now + dly, 'sine', 1046, 1040, .7, .06 * w[5], 9000); tone(now + dly, 'sine', 2620, 2600, .35, .02 * w[5], 9000); }
  }
}
const sndBtn = document.getElementById('b-snd');
function setSound(on) {
  if (on && !soundStart()) return;
  SND.on = on; sndBtn.setAttribute('aria-pressed', on);
  if (!on && SND.ctx) SND.ctx.suspend();
  if (on) track('sound', 'turned the sound on');
}
sndBtn.onclick = () => setSound(!SND.on);
document.addEventListener('visibilitychange', () => { if (SND.ctx && SND.on) document.hidden ? SND.ctx.suspend() : SND.ctx.resume(); });

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; T0 += dt;
  if (T0 - lastWheel > .45 && T0 - lastWheel < .5) { const k = Math.round(target / GAP); if (Math.abs(target - k * GAP) < 110) go(k); }
  // at the camp the traveller gets off; leaving, he climbs back on before the camel stands
  const kN = nearest(), atCamp = chap(kN) === 0 && Math.abs(wx - kN * GAP) < 1 && Math.abs(target - kN * GAP) < 1;
  // at a camp he gets off and sits; leaving, he gets up, walks back and climbs on before the camel stands
  if (atCamp) { campT = Math.min(CAMP_END, campT + dt); campDir = 1; }
  else if (campT > 0) { campT = Math.max(0, campT - dt * 1.7); campDir = -1; }
  // a camel left standing at a stop long enough lies down; asked to move, it grumbles and gets up first
  const atRest = chap(kN) !== 0 && Math.abs(wx - kN * GAP) < 1 && Math.abs(target - wx) < 1;
  if (atRest && T0 - lastInput > 18) rest = Math.min(1.2, rest + dt);
  else if (rest > 0 && !atRest) { if (!grumbled) { grumbled = true; sayIt('HMPH', 1.5); sfxGrunt(); } rest = Math.max(0, rest - dt * .8); }
  if (rest === 0) grumbled = false;
  if (T0 > nextBlink) { blinkUntil = T0 + .14; nextBlink = T0 + 2.5 + Math.random() * 4; }
  if (T0 > nextChew && gaitAmp < .05) { chewUntil = T0 + 1.6 + Math.random() * 1.5; nextChew = T0 + 6 + Math.random() * 6; }
  if (T0 > nextEar) { earUntil = T0 + .25; nextEar = T0 + 4 + Math.random() * 7; }
  mood.blink = T0 < blinkUntil; mood.chew = T0 < chewUntil && gaitAmp < .05; mood.ear = T0 < earUntil;
  const held = (campT > 0 && !atCamp) || (rest > 0 && !atRest);
  const max = 95 * hurry * cl(Math.abs(target - wx) / 140, 1, 12), want = held ? 0 : cl((target - wx) * 3, -max, max);
  vel += (want - vel) * Math.min(1, dt * 6);
  if (Math.abs(target - wx) < .4 && Math.abs(vel) < 2) { vel = 0; wx = target; hurry = 1; }
  let step = vel * dt;
  if ((target - wx) * (target - wx - step) < 0) { step = target - wx; vel = 0; }   // never run past the stop
  wx += step;
  gaitAmp += ((Math.abs(vel) > 3 ? 1 : 0) - gaitAmp) * Math.min(1, dt * 7);
  if (Math.abs(vel) > 3) {
    dir = vel > 0 ? 1 : -1;
    // feet stay planted: one stance (60% of a cycle) covers one stride of ground
    phase += Math.abs(step) * .6 / STRIDE;
    // two footfalls per stride: the near pair, then the far pair
    if (Math.floor(phase * 2) !== lastFoot) { lastFoot = Math.floor(phase * 2); sfxStep(gaitAmp); }
    foot += Math.abs(step);
    if (foot > 5) { foot = 0; prints.push({ x: wx - 14 + (prints.length % 2 ? 3 : -2) + (prints.length % 4 > 1 ? 18 : 0), r: prints.length % 2 }); if (prints.length > 600) prints.shift(); }
    if (Math.random() < Math.abs(vel) * dt * .3) dust.push({ x: wx - 14 + Math.random() * 20, y: GROUND, vx: -dir * (4 + Math.random() * 6), vy: -4 - Math.random() * 5, life: .6 });
  }
  if (night > .45 && Math.random() < dt * .25) meteors.push({ x: Math.random() * VW, y: Math.random() * 30, vx: 140 + Math.random() * 80, vy: 50 + Math.random() * 30, life: .5 });
  for (const m of meteors) { m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt; }
  for (let i = meteors.length - 1; i >= 0; i--) if (meteors[i].life <= 0) meteors.splice(i, 1);
  if (lEl.classList.contains('on')) drawLens(dt);
  for (const d of dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 6 * dt; d.life -= dt; }
  for (let i = dust.length - 1; i >= 0; i--) if (dust[i].life <= 0) dust.splice(i, 1);
  const arrived = Math.abs(wx - kN * GAP) < 6 && Math.abs(vel) < 4, isCamp = chap(kN) === 0;
  if (arrived && (!isCamp || (atCamp && campT >= 2.9))) showStop(kN); else if (Math.abs(vel) > 12 || (isCamp && campT < 2.9)) hideStop();
  typeStep(dt);
  soundTick(dt);
  drawMap(T0);
  yrBtns.forEach((b, i) => b.classList.toggle('here', shown !== null && chap(shown) === i));
  // going back to camp only makes sense away from it
  const atFire = chap(kN) === 0 && Math.abs(wx - kN * GAP) < 6 && Math.abs(target - kN * GAP) < 6;
  if (skipBtn.disabled !== atFire) { skipBtn.disabled = atFire; yrBtns[0].disabled = atFire; }
  draw(T0);
  requestAnimationFrame(frame);
}
// people who asked their system for less motion start at the camp with the journal open
if (matchMedia('(prefers-reduced-motion: reduce)').matches) skipToCamp(true);
const hp = new URLSearchParams(location.hash.slice(1));
if (hp.has('lens')) setTimeout(() => lens(true), 300);
if (hp.has('journal')) journal(true);
if (hp.has('at')) { wx = target = +hp.get('at') * GAP; campT = hp.has('camp') ? +hp.get('camp') : chap(+hp.get('at')) === 0 ? CAMP_END : 0; }
requestAnimationFrame(frame);
})();
