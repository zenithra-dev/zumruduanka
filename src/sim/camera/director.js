// Otomatik yönetmen: şarkı başında çekim listesini çıkarır, her karede kamerayı o çekime göre yerleştirir.
// İki kaynak: şarkı kendi çekim listesini (shots) veriyorsa o kullanılır; yoksa müziğe göre otomatik plan (ölçü ızgarası, yoğunluk, final vuruşları).
// Zamanın fonksiyonu olarak çalışır: aynı an aynı kamerayı verir, kareler hangi sırada ya da hangi işçide işlenirse işlensin.
// Her kesme yakındaki nota başlangıcının tam anına çekilir; objektif (groupCam.fov) çekim türüne göre değişir.
//
// Şarkı verisinde çekim (zamanlar vuruş cinsinden, len yoksa sona kadar):
//   {b, len, cam: "head"}                       sap kamerası
//   {b, len, cam: "dolly", reverse?}            geniş açıdan yavaşça yaklaşan kamera
//   {b, len, cam: "orbit", from, to}            sahnenin çevresinde yay (radyan)
//   {b, len, cam: "stage"}                      gitara yakın sahne kamerası
//   {b, len, cam: "outro", k?}                  yükselip geri çekilen final
//   {b, len, who: "claude", kind?: "close"|"medium"|"guitar"|"hero", side?: ±1}   üyeye kesme
//
// Oda (direct'e room verilince): çekim listesi aynı, her tür odanın içindeki karşılığına yerleşir (ROOM). Öteki mekânlarda kamera birebir aynı.
import * as THREE from "three";
import { restHead } from "../stage/figures.js";
import { beatAt, timeAt, onsets, intensity } from "../music/clock.js";
import { hash01 } from "../rng.js";

const sm = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.min(1, Math.max(0, x));
const MOVES_GROUP = {member: true, wide: true, dolly: true, orbit: true, outro: true};
// Objektif: dikey görüş açısı (derece). Yakın planlar dar (sıkışık perspektif, yüz bozulmaz), geniş planlar geniş.
const FOV = {close: 20, guitar: 24, hero: 28, medium: 32, wide: 46, dolly: 42, orbit: 40, outro: 46};
// Üye kadrajları (kafanın hareketsiz konumuna göre): d uzaklık, lat yana açılma (d başına), look bakış noktasının kafaya göre
// yüksekliği, rise kameranın bakış noktasına göre yüksekliği (d başına: objektif değişse de bakış açısı aynı), lx bakışın sapa doğru kayması
const FRAME = {
  close:  {d: 1.55, lat: 0.42, look: -0.12, rise: 0.05, lx: 0},
  // Bel planı: kafa üstünden gitar gövdesinin altına, düz açı; sap eli alt bandın (y > 600) üstünde
  medium: {d: 1.95, lat: 0.5, look: -0.38, rise: 0.08, lx: 0.08},
  // Gitar yakın planı: köprü kemerin biraz altında, sap ~34° yukarı; bakış iki elin arasına düşer, eller ve eşik alt bandın (y > 600) üstünde
  guitar: {d: 1.63, lat: 0.6, look: -0.68, rise: 0.36, lx: 0},
  // Hero: aşağıdan, yüz ve gitar birlikte (kafa üstünden gövdenin altına); bakış sapa doğru kayık
  hero:   {d: 2.6, lat: 0.34, look: -0.4, rise: -0.22, lx: 0.16}
};
// Oda karşılıkları: konumlar kafanın hareketsiz konumuna göre karakterin çerçevesinde [sağ, yukarı, ileri] (m), çekim boyunca a → b, look bakış
// noktası. Arka plan köşe (yatak, iki duvar, peri ışıkları); kamera önde, köşeye doğru bakar: karakter sağ üçte birde, köşe ve yatak (kedi,
// peluşlar) solunda, tavan çizgisi kadrajın üstünde. Dolly karşı köşe tarafından gelir, yay yalnız önde (duvarlar arkada), final yükselip
// köşeye tepeden bakar. Hepsi room.bounds içinde ve room.avoid dışında; uzaklıklar odanın derinliğine göre kısa, objektifler dar.
const ROOM = {
  wide:  {a: [-0.1, -0.42, 2.44], b: [-0.1, -0.34, 2.3], look: [-0.5, -0.54, 0], sd: 0.5},     // sd: yandan açılış (çekim tarafı)
  crane: {a: [-0.1, -0.95, 2.4], b: [-0.1, -0.2, 2.4], look: [-0.5, -0.54, 0], sd: 0.5},
  dolly: {a: [1.15, -0.35, 2.44], b: [0.35, -0.25, 1.6], look: [-0.25, -0.5, -0.3]},
  outro: {a: [0.25, -0.3, 1.5], b: [-0.2, 0.55, 2.42], look: [-0.45, -0.38, -0.5]},
  orbit: {r: 2.35, y: -0.4, a0: 0.2, k: 0.75, look: [-0.15, -0.5, -0.3]}   // açı a0 + k·a (kulüp yayının açısı a)
};
const ROOM_FOV = {wide: 45, dolly: 42, orbit: 42, outro: 46, hero: 34};
const ROOM_FRAME = {hero: Object.assign({}, FRAME.hero, {d: 2.05})};   // kahraman ön duvara sığar; objektif kadrajı korur (28° → 34°)
const SNAP = 0.12;    // kesme bu kadar (sn) yakın nota başlangıcına çekilir
const CAT = {wide: "genis", dolly: "genis", orbit: "genis", outro: "genis", head: "sap", stage: "sahne"};
const catOf = k => CAT[k] || k;
// Otomatik planın çekim havuzları (sırayla dönülür, bir önceki çekimle aynı türden olan atlanır).
// Yoğunlukta hero ve bel planı her iki çekimden biri; doruk ve finalde yalnız yüzü ve sap elini birlikte gösteren çekimler.
const POOL = {
  calm:    ["wide", "close", "guitar", "orbit", "head", "medium", "stage", "dolly", "close", "guitar"],
  mid:     ["guitar", "hero", "head", "close", "stage", "medium", "orbit", "guitar", "close"],
  intense: ["hero", "guitar", "medium", "head", "hero", "close", "medium", "wide"],
  face:    ["hero", "medium", "wide"]
};

// Kesme anı: b vuruşunun zamanı; 120 ms içinde nota başlangıcı varsa tam onun anı, yoksa ±1 vuruştaki en yakın başlangıç, o da yoksa null
function snapCut(p, O, b){
  const t = timeAt(p, b); let o = null;
  for (const x of O) if (!o || Math.abs(x.t - t) < Math.abs(o.t - t)) o = x;
  if (o && (Math.abs(o.t - t) <= SNAP || Math.abs(beatAt(p, o.t) - b) <= 1)) return o.t;
  return null;
}
// Kesme zamanları: açılış iki ölçü, sonra ölçü ızgarası. Çekim boyu yoğunluğa göre 4/2/1 ölçü (sakin ~5 sn, yoğun ~1.2 sn hedefi;
// tempo hızlanınca kurgu da hızlanır). Final vuruşları (sondaki susuşlu akor vuruşları ve son nota) birer kesmedir.
// doruk: son notadan en az 16 vuruş önceki cümle başı (16 vuruşluk ızgara).
function cutTimes(p, O){
  const last = O[O.length - 1], bLast = beatAt(p, last.t), H = [last.t];
  for (let i = O.length - 2; i >= 0; i--){
    const o = O[i], bo = beatAt(p, o.t);
    if (bLast - bo > 12 || o.n < 3 || o.v < 0.9 || beatAt(p, O[i + 1].t) - bo < 1.5) break;
    H.unshift(o.t);
  }
  const hb = beatAt(p, H[0]), grid = [];
  for (let b = 8; b < hb - 2.5; ){
    const bar = timeAt(p, b + 4) - timeAt(p, b), In = clamp01((intensity(p, timeAt(p, b + 2)) - 0.2) / 0.55), T = 5.2 - 4 * In;
    let L = [4, 2, 1].find(n => n * bar <= 1.45 * T) || 1;
    while (L > 1 && Math.round(b / 4) % L) L /= 2;
    grid.push(b); b += 4 * L;
  }
  const cuts = [];
  grid.map(b => snapCut(p, O, b)).concat(H).sort((a, b) => a - b).forEach(t => {
    if (t === null || t > last.t) return;
    const prev = cuts.length ? cuts[cuts.length - 1] : p.t0;
    if (H.includes(t) || beatAt(p, t) - beatAt(p, prev) >= 1.5) cuts.push(t);
  });
  return {cuts, hits: H, doruk: Math.max(0, Math.floor((bLast - 16) / 16) * 16)};
}

export function createDirector({FIG, groupCam, orbit, placeCams}){
  let cam = "group"; // o anki çekimin kamerası: "group" | "head" | "stage"

  function authored(p, list, songEnd){
    const O = onsets(p), at = b => { const s = snapCut(p, O, b); return s === null ? timeAt(p, b) : s; };
    let side = 1;
    return list.map(s => {
      side = -side;
      const t = at(s.b), end = s.len === undefined ? Math.max(songEnd + 5, t + 1) : at(s.b + s.len);
      const cam = s.cam || (s.who ? "member" : "dolly");
      return {t, end, who: s.who || "wide", kind: s.kind || (s.who ? "medium" : "wide"), side: s.side || side, glide: false, crane: false,
        cam, from: s.from || 0, to: s.to || 0, reverse: !!s.reverse, k: s.k || 3};
    });
  }
  // Tek kişilik sahne için otomatik plan: sakin yerde geniş, yüz ve gitar; yoğunlukta hero ve bel planı ağırlıklı; dorukta yalnız yüzlü çekimler.
  // Aynı türden (geniş/dolly/yay aynı sayılır) iki çekim arka arkaya gelmez. Çeşitlilik hash01 ile (rand() akışına dokunmaz).
  function autoPlan(p){
    const O = onsets(p), base = {who: "claude", side: 1, glide: false, crane: false, cam: "member", from: 0, to: 0, reverse: false, k: 3};
    if (!O.length) return [Object.assign({}, base, {t: p.t0, end: p.end + 5, who: "wide", kind: "wide", cam: "dolly"})];
    const {cuts, hits, doruk} = cutTimes(p, O), T = [p.t0].concat(cuts.filter(t => t > p.t0)), cnt = {}, shots = [];
    let prev = "genis", orb = 0;
    T.forEach((t, i) => {
      const end = i + 1 < T.length ? T[i + 1] : Math.max(p.end + 5, t + 1), sh = Object.assign({}, base, {t, end, side: i % 2 ? 1 : -1});
      if (i === 0){ shots.push(Object.assign(sh, {who: "wide", kind: "wide", cam: "dolly"})); return; }
      if (i === T.length - 1 && hits.includes(t)){ shots.push(Object.assign(sh, {who: "wide", kind: "wide", cam: "outro"})); return; }
      const e = Math.min(end, p.end), In = clamp01(([0.2, 0.5, 0.8].reduce((s, f) => s + intensity(p, t + (e - t) * f), 0) / 3 - 0.2) / 0.55);
      const cls = beatAt(p, t) >= doruk - 0.5 || t >= hits[0] ? "face" : In >= 0.7 ? "intense" : In >= 0.35 ? "mid" : "calm";
      const pool = POOL[cls], outroNext = i === T.length - 2 && hits.includes(T[i + 1]); let k;
      do { cnt[cls] = (cnt[cls] || 0) + 1; k = pool[(cnt[cls] - 1) % pool.length]; } while (catOf(k) === prev || (outroNext && catOf(k) === "genis"));
      sh.kind = k;
      if (k === "wide") Object.assign(sh, {who: "wide", cam: "wide", crane: hash01(i, "vinc") < 0.5});
      else if (k === "orbit"){ orb++; Object.assign(sh, {who: "wide", cam: "orbit", from: orb % 2 ? -0.35 : 0.35, to: orb % 2 ? 0.25 : -0.25}); }
      else if (k === "stage") Object.assign(sh, {who: "wide", cam: "stage"});
      else if (k === "dolly") Object.assign(sh, {who: "wide", cam: "dolly", reverse: hash01(i, "geri") < 0.5});
      else if (k === "head") sh.cam = "head";
      else sh.glide = (cls === "calm" || cls === "mid") && prev === "genis" && hash01(i, "kayma") < 0.6;
      prev = catOf(k); shots.push(sh);
    });
    return shots;
  }
  function planShots(p){
    return p.song.shots ? authored(p, p.song.shots, p.end) : autoPlan(p);
  }
  const fovOf = sh => !sh ? FOV.wide : sh.cam === "member" ? FOV[sh.kind] || FOV.medium : FOV[sh.cam] || FOV.wide;
  function setFov(f){ if (groupCam.fov !== f){ groupCam.fov = f; groupCam.updateProjectionMatrix(); } }

  const _H = new THREE.Vector3(), _F = new THREE.Vector3(), _R = new THREE.Vector3(), _L = new THREE.Vector3(), _U = new THREE.Vector3(0, 1, 0);
  // Kafanın hareketsiz konumu ve yüz çerçevesi (kamera yalnız zamana bağlı kalır, canlı bedene değil)
  function frameOf(f){ _H.copy(restHead(f)); _F.set(0, 0, 1).applyQuaternion(f.g.quaternion); _R.set(1, 0, 0).applyQuaternion(f.g.quaternion); }
  const local = (v, o, k = 1) => v.copy(_H).addScaledVector(_R, o[0] * k).addScaledVector(_U, o[1] * k).addScaledVector(_F, o[2] * k);
  const mix = (v, a, b, u) => { const P = local(new THREE.Vector3(), a); return local(v, b).sub(P).multiplyScalar(u).add(P); };
  // Odada geniş planlar, dolly, yay ve final; sap, sahne ve üye çekimleri false (sap ve sahne kulüptekiyle aynı, üye çekimi ROOM_FRAME ile)
  function roomPose(wall, sh, u0, ros){
    const c = sh ? sh.cam : "wide", f = FIG[ros[0]];
    if (c === "head" || c === "stage" || !f || (c === "member" && FIG[sh.who] && ros.includes(sh.who))) return false;
    frameOf(f); const P = groupCam.position, S = sh && sh.crane ? ROOM.crane : ROOM[c] || ROOM.wide;
    setFov(ROOM_FOV[c] || ROOM_FOV.wide);
    if (c === "orbit"){ const a = S.a0 + S.k * (sh.from + (sh.to - sh.from) * u0); local(P, [S.r * Math.sin(a), S.y, S.r * Math.cos(a)]); }
    else if (c === "dolly" || c === "outro") mix(P, S.a, S.b, c === "outro" ? sm(Math.min(1, u0 * sh.k)) : sh.reverse ? 1 - u0 : u0);
    // Geniş plan: yandan açılıp yerine oturur (vinç: alçaktan yükselir), çok yavaş salınım
    else { const ue = sm(u0); mix(P, S.a, S.b, ue).addScaledVector(_R, (sh ? sh.side : 1) * S.sd * (1 - ue) + (S === ROOM.crane ? 0 : 0.1 * Math.sin(wall * 0.12))); }
    // Elde tutulan kamera hissi: üye çekimlerindeki gibi çok küçük, yavaş titreşim (açıyla ölçekli)
    local(_L, S.look); const hh = 0.004 * P.distanceTo(_L) * groupCam.fov / 40;
    P.x += hh * (Math.sin(wall * 1.1) + 0.5 * Math.sin(wall * 2.3 + 1)); P.y += hh * 0.7 * Math.sin(wall * 1.5 + 2);
    groupCam.lookAt(_L); return true;
  }
  function directPose(now, wall, sh, ros, R){
    cam = "group";
    setFov(fovOf(sh));
    const u0 = sh ? Math.min(1, Math.max(0, (now - sh.t) / (sh.end - sh.t))) : 0;
    if (R && roomPose(wall, sh, u0, ros)) return;
    if (R && sh && ROOM_FOV[sh.kind]) setFov(ROOM_FOV[sh.kind]);
    switch (sh && sh.cam){
      case "head": cam = "head"; return;
      case "stage": cam = "stage"; orbit.theta = 0.5 - u0 * 0.6; orbit.r = 1.3; orbit.phi = 1.3; placeCams(); return;   // sap tarafından gövdeye doğru yay
      case "dolly": { const u = sh.reverse ? 1 - u0 : u0; groupCam.position.set(0.1 - 0.4 * u, 0.55, 5.0 - 0.6 * u); groupCam.lookAt(0, 0.1, -0.8); return; }
      case "orbit": { const a = sh.from + (sh.to - sh.from) * u0; groupCam.position.set(Math.sin(a) * 3.8, 0.65, -0.6 + Math.cos(a) * 3.8); groupCam.lookAt(0, 0.05, -0.8); return; }
      case "outro": { const k = sm(Math.min(1, u0 * sh.k)); groupCam.position.set(0, 0.5 + 0.5 * k, 4.0 + 2.0 * k); groupCam.lookAt(0, 0.15, -0.9); return; }
    }
    if (!sh || sh.who === "wide" || !FIG[sh.who] || !ros.includes(sh.who)){
      const sd = sh ? sh.side : 1, ue = sm(u0);
      setFov(FOV.wide);   // kadrajı kurulamayan üye çekimi de geniş açıya döner
      if (sh && sh.crane) groupCam.position.set(0.15 + sd * 0.9 * (1 - ue), 0.35 + 0.75 * ue, 4.3 - 0.3 * ue);
      else groupCam.position.set(0.15 + 0.45 * Math.sin(wall * 0.12) + sd * 0.6 * (1 - ue), 0.8 + 0.1 * ue, 4.55 - 0.5 * ue);
      groupCam.lookAt(0, -0.05, -0.8); return;
    }
    // Kadraj kafanın hareketsiz konumuna kurulur (canlı kafa değil): kamera yalnız zamana bağlı kalır, kayma başlangıcı gibi
    // başka bir an için kurulan pozlar o anın değil bu karenin bedenine bakmaz. Bedenin salınımı kadrajda görünür.
    const f = FIG[sh.who], u = sm(u0), sd = sh.side, fr = (R && ROOM_FRAME[sh.kind]) || FRAME[sh.kind] || FRAME.medium, look = fr.look, hy = look + fr.rise * fr.d;
    _H.copy(restHead(f));
    _F.set(0, 0, 1).applyQuaternion(f.g.quaternion); _R.set(1, 0, 0).applyQuaternion(f.g.quaternion);
    let d = fr.d, lat = fr.lat;
    // Önde başka bir üye kadrajı kapatıyorsa diğer tarafı ya da daha yakın açıyı seç (çekim başına bir kez).
    // Hesap üyelerin hareketsiz konumlarıyla yapılır; hangi karede hesaplandığından bağımsız aynı sonucu verir.
    if (!sh.cfg){
      const H0 = _H.clone(), tgt = H0.clone().add(new THREE.Vector3(0, look, 0)), opts = [];
      [[sd, 1, 1], [-sd, 1, 1], [sd, 0.7, 0.5], [-sd, 0.7, 0.5], [sd, 0.5, 0.2], [-sd, 0.5, 0.2]].forEach(([sg, dm, lm], oi) => {
        const c = H0.clone().addScaledVector(_F, d * dm).addScaledVector(_R, sg * lat * lm * d * dm).add(new THREE.Vector3(0, hy, 0));
        let pen = oi * 0.01;
        Object.keys(FIG).forEach(k => { if (k === sh.who || !ros.includes(k)) return;
          const o = restHead(FIG[k]); o.y -= 0.3;
          const ab = tgt.clone().sub(c), t = Math.min(1, Math.max(0, o.clone().sub(c).dot(ab) / ab.lengthSq()));
          if (t > 0.02 && t < 0.92){ const q = c.clone().addScaledVector(ab, t); const dist = Math.hypot(q.x - o.x, q.z - o.z) + Math.max(0, Math.abs(q.y - o.y) - 0.45); if (dist < 0.42) pen += 1 + (0.42 - dist); } });
        opts.push({pen, sg, dm, lm});
      });
      opts.sort((x, y) => x.pen - y.pen); sh.cfg = opts[0];
    }
    const C = sh.cfg; d *= C.dm * (1.07 - 0.12 * u); lat *= C.lm;
    groupCam.position.copy(_H).addScaledVector(_F, d).addScaledVector(_R, C.sg * (lat + 0.12 * u * C.lm) * d).add(_L.set(0, hy, 0));
    // El kamerası hissi: çok küçük, yavaş titreşim; dar objektif titreşimi büyüttüğü için açıyla ölçeklenir
    const hh = 0.005 * d * groupCam.fov / 40; groupCam.position.x += hh * (Math.sin(wall * 1.3) + 0.5 * Math.sin(wall * 2.9 + 1)); groupCam.position.y += hh * 0.7 * Math.sin(wall * 1.7 + 2);
    _L.copy(_H).addScaledVector(_R, fr.lx); groupCam.lookAt(_L.x, _H.y + look, _L.z);
  }

  // Bazı geçişler kesme yerine yumuşak kayma: önceki çekimin bitiş konumundan (ve objektifinden) yeni çekime 0.9 sn'de akar.
  // Başlangıç konumu önceki çekimin bitiş anından hesaplanır, "son karede kamera neredeydi"den değil.
  // Odada (room) kayma yolu kabuğun içinde ve eşya kutularının dışında kalmalı; mekân değişince kayma yeniden kurulur.
  const camPrev = {sh: null, from: null, R: null};
  function direct(now, wall, playing, ros, R = null){
    const shots = playing && playing.shots ? playing.shots : null;
    let sh = shots ? shots.find(x => now >= x.t && now < x.end) : null;
    if (!sh && shots && shots.length && now >= shots[shots.length - 1].t) sh = shots[shots.length - 1];
    if (sh !== camPrev.sh || R !== camPrev.R){
      camPrev.sh = sh; camPrev.R = R; camPrev.from = null;
      const idx = sh && sh.glide ? shots.indexOf(sh) : -1;
      if (idx > 0 && MOVES_GROUP[shots[idx - 1].cam]){
        const prev = shots[idx - 1];
        directPose(prev.end, prev.end, prev, ros, R);
        camPrev.from = {pos: groupCam.position.clone(), q: groupCam.quaternion.clone(), fov: groupCam.fov};
        // Kayma yolu bir üyenin içinden geçecekse normal kesmeye dön
        directPose(sh.t + 0.9, sh.t + 0.9, sh, ros, R); const A = camPrev.from.pos, B = groupCam.position.clone();
        for (let k = 1; k < 12 && camPrev.from; k++){ const P = A.clone().lerp(B, k / 12); if (R && !R.inside(P)) camPrev.from = null;
          Object.keys(FIG).forEach(n => { if (!camPrev.from || !ros.includes(n)) return; const o = restHead(FIG[n]);
            if (Math.hypot(P.x - o.x, P.z - o.z) < 0.45 && P.y < o.y + 0.2) camPrev.from = null; }); }
      }
    }
    directPose(now, wall, sh, ros, R);
    if (camPrev.from && sh){
      const k = Math.min(1, (now - sh.t) / 0.9), e = k * k * (3 - 2 * k);
      if (k < 1){
        groupCam.position.lerpVectors(camPrev.from.pos, groupCam.position.clone(), e);
        if (groupCam.quaternion.slerpQuaternions) groupCam.quaternion.slerpQuaternions(camPrev.from.q, groupCam.quaternion.clone(), e);
        else THREE.Quaternion.slerp(camPrev.from.q, groupCam.quaternion.clone(), groupCam.quaternion, e);
        setFov(camPrev.from.fov + (groupCam.fov - camPrev.from.fov) * e);
      }
      // from kayma bitince de silinmez: aynı çekimde geriye atlanan kare de kaymayı yeniden bulmalı
    }
  }
  // Odada sabit grup kamerası (sim camMode "group"): geniş planın oturmuş konumu, çok yavaş salınım; kesme yok
  function fixed(wall, ros){ cam = "group"; roomPose(wall, null, 1, ros); }
  return { planShots, direct, directPose, fixed, get cam(){ return cam; } };
}
