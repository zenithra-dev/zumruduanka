// Çalış planları: olay listesinden bir kez kurulan, zamanın saf fonksiyonu olan sol el, duruş, parmak ve pena planları. Bedenden bağımsız
// (yalnız gitar ve nota); el pozu (members/claude.js) bunları okur. Planlar p.events başına önbellekte (WeakMap).
import { FRETS, fingerX, stringY, STR_Z } from "../../music/theory.js";
import { curveOf, PRE_IN, REL } from "../../music/bend.js";
import { beatAt, onsets } from "../../music/clock.js";

/* ---------- Sol elin pozisyon planı ---------- */
// Perde başına bir parmak: el p..p+3 penceresini tutar, sap üstündeki yeri pencerenin ortası. Yeni dilimin perdeleri
// hâlâ çalan notalarla bir pencereye sığıyorsa pencere ikisini birden kapsar; 4 perdeden geniş dilimde pencere ortalanır.
// Notalar arasında el son pencerede kalır, sonraki dilimden en çok ~0.1 sn önce (uzak kaymada biraz daha erken) kayar; eski
// pencerede çalan nota o arada biterse kayma onun bitişine ertelenir. 1.5 sn'den uzun susuşta el ev konumuna döner ve teli
// bırakır (l: 0 telde, 1 kalkık). Yalnız olay listesinden kurulur, zamanın saf fonksiyonu.
const SLICE = 0.03, REST = 1.5, HOME = 5, MAX_P = FRETS - 3, FR = 1 / 30;
export const winX = p => (fingerX(p) + fingerX(p + 3)) / 2;
export const sm = u => u * u * (3 - 2 * u);
const clampP = p => Math.min(MAX_P, Math.max(1, p));
export function handPlan(events){
  const fe = events.filter(e => e.f > 0), sl = [], rests = [], mv = [], live = [];
  for (const e of fe){ const s = sl[sl.length - 1];   // aynı anda (30 ms) basılan perdeler tek dilim
    if (s && e.t - s.t < SLICE){ s.lo = Math.min(s.lo, e.f); s.hi = Math.max(s.hi, e.f); } else sl.push({t: e.t, lo: e.f, hi: e.f}); }
  let end = -Infinity;
  for (const e of events){ if (e.t - end > REST) rests.push(end); end = Math.max(end, e.end); }   // susuş başlangıçları
  rests.push(end);
  let p = HOME, x = winX(HOME), l = 1, last = -Infinity, ri = 0, ei = 0;
  const go = (a, b, x1, l1, p1) => { mv.push({a, b, x0: x, x1, l0: l, l1, p: p1}); x = x1; l = l1; };
  const rest = r => { if (l < 1 && r > -Infinity) go(r + 0.2, r + 0.7, winX(HOME), 1, p); };
  for (const s of sl){
    while (ri < rests.length && rests[ri] < s.t) rest(rests[ri++]);
    while (ei < fe.length && fe[ei].t < s.t - 1e-6) live.push(fe[ei++]);
    for (let i = live.length - 1; i >= 0; i--) if (live[i].end <= last) live.splice(i, 1);
    let lo = s.lo, hi = s.hi, rel = -Infinity;
    for (const e of live){
      if (e.end > s.t + 0.1 && Math.max(hi, e.f) - Math.min(lo, e.f) <= 3){ lo = Math.min(lo, e.f); hi = Math.max(hi, e.f); }
      if (e.end <= s.t) rel = Math.max(rel, e.end);
    }
    const np = hi - lo > 3 ? clampP(Math.round((lo + hi - 3) / 2)) : lo >= p && hi <= p + 3 ? p : clampP(lo < p ? lo : hi - 3), nx = winX(np);
    if (l > 0) go(s.t - 0.3, s.t, nx, 0, np);
    else if (np !== p){
      const dx = Math.abs(nx - x), g = Math.min(Math.max(0.1, dx * 0.6), 0.6 * (s.t - last)), gmin = Math.min(g, Math.max(0.05, dx * 0.6));
      go(Math.max(s.t - g, Math.min(rel - FR, s.t - gmin)), s.t, nx, 0, np);
    }
    p = np; last = s.t;
  }
  while (ri < rests.length) rest(rests[ri++]);
  return mv;
}
// Planın now anındaki hali: {x: sap boyunca yer, l: kalkıklık, p: pencerenin ilk perdesi}
export function handAt(mv, now){
  let lo = 0, hi = mv.length;
  while (lo < hi){ const k = (lo + hi) >> 1; if (mv[k].a <= now) lo = k + 1; else hi = k; }
  if (!lo) return {x: winX(HOME), l: 1, p: HOME};
  const m = mv[lo - 1];
  if (now >= m.b) return {x: m.x1, l: m.l1, p: m.p};
  const u = sm((now - m.a) / (m.b - m.a));
  return {x: m.x0 + (m.x1 - m.x0) * u, l: m.l0 + (m.l1 - m.l0) * u, p: m.p};
}
const PLANS = new WeakMap();
export const planOf = p => { let mv = PLANS.get(p.events); if (!mv) PLANS.set(p.events, mv = handPlan(p.events)); return mv; };

/* ---------- Perde elinin duruş planı ---------- */
// Duruş planı: alçak (0) ile yüksek (1) duruş arasında kare kare (DT) en ucuz yol (Viterbi). Duruşun saniyelik bedeli pencereden: alçak duruş
// 14. perdeden sonra gövdeye girer, yüksek duruş alçak perdelerde bileği zorlar, ev konumunda alçak durulur. Geçiş R_DUR sürer, bedeli TC artı o
// aralıkta basan parmaklar, nota başları ve elin yolu: geçiş susuşa ya da sakin bir yere oturur, hızlı kayma dizisine düşmez; pencere kısa süre
// alçalıp yükselirse duruş değişmez. → [{a, b, to}], olay listesinden bir kez (zamanın saf fonksiyonu).
const DT = 1 / 30, R_DUR = 0.7, TC = 1, ACT = 1.5, ONS = 0.15, MOV = 4, HOME_C = 3;
const LO_C = p => p <= 14 ? 0 : p === 15 ? 3 : p === 16 ? 10 : 30, HI_C = p => p >= 15 ? 0.1 : p >= 13 ? 0.5 : p >= 11 ? 1.5 : p >= 9 ? 3 : 6;
export function regimePlan(mv, events, F){
  const N = Math.ceil((events.reduce((a, e) => Math.max(a, e.end), 0) + 2) / DT), D = Math.round(R_DUR / DT), fr = t => Math.min(N, Math.max(0, Math.round(t / DT)));
  const act = new Float64Array(N + 1), ons = new Float64Array(N + 1), c = [new Float64Array(N), new Float64Array(N)], S = new Float64Array(N + 1);
  for (const e of events){ const a = F.get(e); if (!(e.f > 0)) continue; ons[fr(e.t)] += ONS;
    if (a){ act[fr(a.a)]++; act[fr(Math.min(tailOf(e), a.cut) + LIFT)]--; } }
  let n = 0, px = handAt(mv, 0).x;
  for (let i = 0; i < N; i++){ const h = handAt(mv, i * DT), lo = h.l > 0.5 ? 0 : LO_C(h.p), hi = h.l > 0.5 ? HOME_C : HI_C(h.p); n += act[i];
    c[0][i] = lo * DT; c[1][i] = hi * DT; S[i + 1] = S[i] + (Math.max(lo, hi) + ACT * n) * DT + ons[i] + MOV * Math.abs(h.x - px); px = h.x; }
  const B = [new Float64Array(N + 1).fill(Infinity), new Float64Array(N + 1).fill(Infinity)], from = [new Int32Array(N + 1), new Int32Array(N + 1)]; B[0][0] = 0;
  for (let i = 1; i <= N; i++) for (let s = 0; s < 2; s++){
    B[s][i] = B[s][i - 1] + c[s][i - 1]; from[s][i] = -1;
    if (i >= D){ const v = B[1 - s][i - D] + TC + S[i] - S[i - D]; if (v < B[s][i]){ B[s][i] = v; from[s][i] = i - D; } }
  }
  const out = []; let s = B[1][N] < B[0][N] ? 1 : 0;
  for (let i = N; i > 0; ){ const j = from[s][i]; if (j < 0){ i--; continue; } out.push({a: j * DT, b: i * DT, to: s}); s = 1 - s; i = j; }
  return out.reverse();
}
// Yüksek duruşun payı r (0..1)
export function regimeAt(R, now){
  let lo = 0, hi = R.length; while (lo < hi){ const k = (lo + hi) >> 1; if (R[k].a <= now) lo = k + 1; else hi = k; }
  if (!lo) return 0;
  const g = R[lo - 1], u = sm(Math.min(1, (now - g.a) / (g.b - g.a)));
  return g.to ? u : 1 - u;
}
const REGS = new WeakMap();
export const regOf = p => { let R = REGS.get(p.events); if (!R) REGS.set(p.events, R = regimePlan(planOf(p), p.events, fplanOf(p))); return R; };

/* ---------- Perde parmakları ---------- */
// Perde başına bir parmak: her basılan nota başladığı anki pencerede (handAt) perdesine göre bir parmak alır (işaret pencerenin ilk perdesi,
// serçe dördüncüsü); o parmak pencerenin uzağında kalmış eski bir notadaysa eski nota bırakılır, yakın bir notadaysa en yakın boştaki alınır.
// Aynı tel ve perdede hâlâ tutulan nota (yeniden vurulan akor) parmağını kalkmadan yenisine devreder; notanın kendi parmağı ya da (boş parmak
// kalmadıysa) en yakını önceki dilimden tutulan ve bitmek üzere olan bir notadaysa o devralınır, eskisinin kuyruğu kesilir; yine parmaksız kalan
// nota, perdesine yakın bir parmak boşalınca onu alır. El notanın perdesini pencereden çıkaran bir kaymaya başlarsa nota bırakılır. Olay
// listesinden bir kez (zamanın saf fonksiyonu).
// Parmak notadan LEAD önce tele iner (ön bükmede PRE_IN daha erken: tel çalmadan itilir), bittikten sonra LIFT'te kalkar (bükülen notada tel
// REL'de bırakılınca).
export const LEAD = 0.06, LIFT = 0.06;
const bends = e => { const c = curveOf(e); return !!(c.vib || e.bend || e.pre); };
const leadOf = e => LEAD + (e.pre ? PRE_IN : 0), tailOf = e => e.end + (bends(e) ? REL : 0);
const STEAL = 0.3, OWN = 0.1, LOOK = 0.05;
export function fingerPlan(events, mv){
  // held: parmağı tutan nota {j, b: kalkış, e, sh: parmağı kalkmadan devreden aynı yerdeki eski notalar}; wait: parmaksız çalan notalar.
  // Atama {j, cut, a}: a parmağın inişinin başladığı an (notadan leadOf önce; bekleyen notada parmağın boşaldığı an)
  const out = new Map(), held = [], wait = [], j0Of = (e, p) => Math.min(3, Math.max(0, e.f - p));
  const release = (x, t) => { for (const n of [x.e, ...x.sh]){ const a = out.get(n); a.cut = Math.min(a.cut, t); } };
  // el notanın perdesini pencereden çıkaran bir kaymaya başlarsa nota o an bırakılır
  const cutOf = (e, t) => { for (const m of mv) if (m.a >= t && m.a < tailOf(e) && (e.f < m.p - 1 || e.f > m.p + 4)) return m.a; return Infinity; };
  const give = (e, j, cut, a, sh = []) => { out.set(e, {j, cut, a}); held.push({j, b: Math.min(tailOf(e), cut), e, sh}); };
  // t'ye kadar kalkan parmaklar sırayla; boşalan parmak, perdesi o parmağa yakın bekleyen notaya geçer
  const free = t => { for (;;){ let i = -1; held.forEach((x, k) => { if (x.b <= t && (i < 0 || x.b < held[i].b)) i = k; }); if (i < 0) return;
    const x = held.splice(i, 1)[0], p = handAt(mv, x.b).p, w = wait.findIndex(n => n.end > x.b + LEAD && Math.abs(j0Of(n, p) - x.j) <= 1);
    if (w >= 0){ const n = wait.splice(w, 1)[0], cut = cutOf(n, x.b); if (cut > x.b + LEAD) give(n, x.j, cut, x.b); } } };
  for (const e of events){
    if (!(e.f > 0)) continue;
    free(e.t); for (let i = wait.length - 1; i >= 0; i--) if (wait[i].end <= e.t) wait.splice(i, 1);
    // tarayarak çalınan akorda el ilk telden hemen sonra kayabilir: nota az sonraki pencereye sığıyorsa parmağı o pencereden
    const p = handAt(mv, e.t).p, q = handAt(mv, e.t + LOOK).p, j0 = j0Of(e, e.f >= q && e.f <= q + 3 ? q : p), cut = cutOf(e, e.t);
    // pencereden uzakta kalmış eski nota parmağını bırakır: yeni notanın inişi başlarken kalkar
    for (let i = held.length - 1; i >= 0; i--){ const x = held[i]; if (x.j === j0 && (x.e.f < p - 1 || x.e.f > p + 4)){ release(x, e.t - leadOf(e)); held.splice(i, 1); } }
    // devredilebilir: önceki dilimden tutulan ve STEAL (kendi parmağında OWN) içinde bitecek nota
    const old = (x, d = STEAL) => x.e.t < e.t - SLICE && x.b < e.t + d, take = i => { const x = held.splice(i, 1)[0]; release(x, e.t - leadOf(e)); return x.j; };
    let k = held.findIndex(x => x.e.s === e.s && x.e.f === e.f), j = -1, sh = [];
    if (k >= 0){ const x = held.splice(k, 1)[0]; j = x.j;   // aynı yer: hedef aynı; bükülen notada eski bırakılır
      if (bends(x.e) || bends(e)) release(x, e.t); else sh = [x.e, ...x.sh]; }
    else if ((k = held.findIndex(x => x.j === j0 && old(x, OWN))) >= 0) j = take(k);   // kendi parmağı biten notadaysa onu alır
    else for (const d of [0, 1, -1, 2, -2, 3, -3]){ const q = j0 + d; if (q >= 0 && q <= 3 && !held.some(x => x.j === q)){ j = q; break; } }
    // boş parmak yoksa devredilebilir notanın parmağı (yenisine en yakını, eşitse en önce biteni) alınır
    if (j < 0){ k = -1; held.forEach((x, i) => { const y = held[k], dx = Math.abs(x.j - j0), dy = y ? Math.abs(y.j - j0) : 9;
      if (old(x) && (dx < dy || (dx === dy && x.b < y.b))) k = i; });
      if (k >= 0) j = take(k); }
    if (j >= 0) give(e, j, cut, e.t - leadOf(e), sh); else wait.push(e);
  }
  free(Infinity);
  return out;
}
const FPLANS = new WeakMap();
export const NOFING = new Map();
export const fplanOf = p => { let F = FPLANS.get(p.events); if (!F) FPLANS.set(p.events, F = fingerPlan(p.events, planOf(p))); return F; };
// Parmak başına o an basan notalar [{e, w}] (w: basma payı 0..1; bir parmakta en çok iki nota: biri kalkarken öbürü iner)
export function pressed(events, now, F){
  const by = [[], [], [], []];
  if (events) for (const e of events){
    if (e.t - LEAD - PRE_IN > now) break;
    const a = F.get(e); if (a === undefined) continue;
    const end = Math.min(tailOf(e), a.cut), w = Math.min(1, (now - a.a) / LEAD, 1 - (now - end) / LIFT);
    if (w > 0) by[a.j].push({e, w, up: now > end});   // up: parmak kalkıyor
  }
  return by;
}

/* ---------- Pena hareketi ---------- */
// Vuruş planı: legato olmayan her nota başlangıcı (clock.js onsets: 40 ms içindeki notalar tek vuruş) bir pena vuruşudur. Yön ızgaradan: vuruşta
// aşağı (kalın telden inceye), arada yukarı; komşu vuruş 3/8 vuruştan yakınsa 16'lık ızgara. Pena ucu teli nota anında keser: T - CIN..T + COUT
// boyunca telin üstünde, teli iterek yavaşça geçer (nota karesinde uç tele 1 mm'den yakın), sonra yön dönüşüne (telden AMP ötede, tellerin üstünde)
// yumuşakça gider. Akorda uç telleri sırayla tarar. Aynı yöne iki vuruş arasında pena tellerin üstünden geri döner. Uzun susuşta tellerin üstünde
// bekler. Anahtarlar pena ucunun tel koordinatında (s: 0 kalın E ... 5 ince e, ara değerler teller arası) ve yüksekliğinde; x palm mute payından
// (mu) gelir: palm mute koşusunda el köprüye kayar ve yaslanır, geçiş komşu vuruşlar arasında en az RAMP sürer. Yalnız olaylardan, zamanın saf fonksiyonu.
const PX = 0.575, PX_M = 0.612, DEPTH = 0.0006, RISE = 0.004, RISE2 = 0.008, HOVER = 0.016, CIN = 0.015, COUT = 0.035, E1 = 0.0004, E2 = 0.0008, PREST = 1.2, RAMP = 0.3, RAKE = 0.1;
export const SP = stringY(0, PX) - stringY(1, PX);   // tel aralığı (m): metre → tel birimi
const amp = gap => Math.min(0.008, Math.max(0.003, 0.05 * gap)) / SP;
export function pickPlan(p){
  const ev = p.events, S = onsets(p).filter(o => !o.h), K = [], M = [];
  const key = (t, s, z, lin) => { K.push({t, s, z, lin}); };
  const rest = t => key(t, 2.5, STR_Z + HOVER, false);
  const st = S.map((o, i) => {   // d: tel biriminde yön (+1 aşağı vuruş: kalından inceye)
    const b = beatAt(p, o.t), near = Math.min(i ? b - beatAt(p, S[i - 1].t) : 9, i + 1 < S.length ? beatAt(p, S[i + 1].t) - b : 9);
    const g = near < 0.375 ? 4 : 2, d = ((Math.round(b * g) % 2) + 2) % 2 ? -1 : 1, notes = ev.slice(o.i, o.i + o.n);
    return {d, m: o.m ? 1 : 0, ss: notes.map(e => e.s).sort((a, c) => d * (a - c)), ts: notes.map(e => e.t).sort((a, c) => a - c)};
  });
  // Tarama (arpej, sweep): RAKE'ten yakın ardışık tek notalar teller boyunca hep aynı yöne ilerliyorsa tek vuruş olur, yönü ilerleyişten
  for (let i = 0; i + 1 < st.length; ){
    const a = st[i], b = st[i + 1], n = a.ss.length, dir = Math.sign(b.ss[0] - a.ss[n - 1]);
    if (b.ss.length === 1 && dir && a.m === b.m && b.ts[0] - a.ts[n - 1] < RAKE && (n === 1 || Math.sign(a.ss[1] - a.ss[0]) === dir)){
      a.d = dir; a.ss.push(b.ss[0]); a.ts.push(b.ts[0]); st.splice(i + 1, 1);
    } else i++;
  }
  const zc = STR_Z - DEPTH, zl = STR_Z + RISE;
  st.forEach((s, i) => {
    const pv = st[i - 1], nx = st[i + 1], n = s.ss.length, t0 = s.ts[0], t1 = s.ts[n - 1];
    const gp = pv ? t0 - pv.ts[pv.ts.length - 1] : 9, gn = nx ? nx.ts[0] - t1 : 9, sl = s.ss[n - 1];
    if (gp > PREST){ const a = t0 - Math.min(CIN, 0.2 * gp); rest(a - 0.6); key(a - 0.15, s.ss[0] - s.d * amp(0.3), zl, false); }
    for (let j = 0; j < n; j++){   // her tel: giriş, nota anı, çıkış (vuruş içinde tel aralığının çoğu telde geçer, sonraki tele hızla atlar)
      const a = j ? 0.15 * (s.ts[j] - s.ts[j - 1]) : 0.2 * gp, b = j + 1 < n ? 0.7 * (s.ts[j + 1] - s.ts[j]) : 0.4 * gn;
      key(s.ts[j] - Math.min(CIN, a), s.ss[j] - s.d * E1 / SP, zc, true); key(s.ts[j], s.ss[j], zc, true); key(s.ts[j] + Math.min(COUT, b), s.ss[j] + s.d * E2 / SP, zc, false);
    }
    const ex = t1 + Math.min(COUT, 0.4 * gn), A = amp(gn);
    if (!i) M.push({t: t0, v: s.m});
    if (nx && nx.m !== s.m){ const c = (t1 + nx.ts[0]) / 2, r = Math.max(RAMP, 0.8 * gn) / 2; const a = Math.max(c - r, M[M.length - 1].t); M.push({t: a, v: s.m}, {t: Math.max(c + r, a + 0.05), v: nx.m}); }
    if (gn > PREST){ key(ex + 0.12, sl + s.d * A, zl, false); rest(ex + 0.45); return; }
    const en = nx.ts[0] - Math.min(CIN, 0.2 * gn);   // sonraki temasın girişi
    if (nx.d !== s.d) key((ex + en) / 2, s.d > 0 ? Math.max(sl, nx.ss[0]) + A : Math.min(sl, nx.ss[0]) - A, zl, false);
    else { key(ex + (en - ex) / 3, sl + s.d * A, zl, false); key(ex + 2 * (en - ex) / 3, nx.ss[0] - nx.d * A, STR_Z + RISE2, false); }
  });
  return {K, M};
}
// Sıralı {t} dizisinde t'si now'dan büyük olmayan son öğenin indeksi (yoksa -1)
const lastAt = (A, now) => { let lo = 0, hi = A.length; while (lo < hi){ const k = (lo + hi) >> 1; if (A[k].t <= now) lo = k + 1; else hi = k; } return lo - 1; };
// Planın now anındaki pena ucu {x, y, z} (gitar çerçevesi) ve palm mute payı mu; plan dışında tellerin üstünde bekler
const _tip = {x: PX, y: 0, z: 0, mu: 0};
export function pickAt(P, now){
  const {K, M} = P, k = lastAt(K, now), j = lastAt(M, now);
  let s = 2.5, z = STR_Z + HOVER, mu = 0;
  if (K.length){ const a = K[Math.max(0, k)], b = K[k + 1];
    if (k < 0 || !b){ s = a.s; z = a.z; } else { const u = (now - a.t) / (b.t - a.t), w = a.lin ? u : sm(u); s = a.s + (b.s - a.s) * w; z = a.z + (b.z - a.z) * w; } }
  if (M.length){ const a = M[Math.max(0, j)], b = M[j + 1]; mu = j < 0 || !b ? a.v : a.v + (b.v - a.v) * sm((now - a.t) / (b.t - a.t)); }
  _tip.mu = mu; _tip.x = PX + (PX_M - PX) * mu; _tip.y = stringY(s, _tip.x); _tip.z = z;
  return _tip;
}
const PICKS = new WeakMap();
export const NOPICK = {K: [], M: []};
export const pickOf = p => { let P = PICKS.get(p.events); if (!P) PICKS.set(p.events, P = pickPlan(p)); return P; };
