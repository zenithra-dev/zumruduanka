// Otomatik yönetmen: şarkı başında çekim listesini çıkarır, her karede kamerayı o çekime göre yerleştirir.
// İki kaynak: şarkı kendi çekim listesini (shots) veriyorsa o kullanılır; yoksa kim öne çıkıyorsa ona kesen otomatik plan.
// Zamanın fonksiyonu olarak çalışır: aynı an aynı kamerayı verir, kareler hangi sırada ya da hangi işçide işlenirse işlensin.
//
// Şarkı verisinde çekim (zamanlar vuruş cinsinden, len yoksa sona kadar):
//   {b, len, cam: "head"}                       sap kamerası
//   {b, len, cam: "dolly", reverse?}            geniş açıdan yavaşça yaklaşan kamera
//   {b, len, cam: "orbit", from, to}            sahnenin çevresinde yay (radyan)
//   {b, len, cam: "stage"}                      gitara yakın sahne kamerası
//   {b, len, cam: "outro", k?}                  yükselip geri çekilen final
//   {b, len, who: "sahmeran", kind?: "close"|"medium"|"guitar", side?: ±1}   üyeye kesme
import * as THREE from "three";
import { restHead } from "../stage/figures.js";

const sm = x => x * x * (3 - 2 * x);
const MOVES_GROUP = {member: true, wide: true, dolly: true, orbit: true, outro: true};

export function createDirector({FIG, groupCam, orbit, placeCams}){
  let cam = "group"; // o anki çekimin kamerası: "group" | "head" | "stage"

  function authored(list, spb, t0, songEnd){
    let side = 1;
    return list.map(s => {
      side = -side;
      const t = t0 + s.b * spb, end = s.len === undefined ? Math.max(songEnd + 5, t + 1) : t0 + (s.b + s.len) * spb;
      const cam = s.cam || (s.who ? "member" : "dolly");
      return {t, end, who: s.who || "wide", kind: s.kind || (s.who ? "medium" : "wide"), side: s.side || side, glide: false, crane: false,
        cam, from: s.from || 0, to: s.to || 0, reverse: !!s.reverse, k: s.k || 3};
    });
  }
  // Kim öne çıkıyorsa kamera ona keser: vokalde Şahmeran, gitar anında Claude (dönüşümlü sap kamerası), davul geçişinde Erlik.
  function autoPlan(p, spb, t0, ros){
    const bar = spb * 4, nBars = Math.ceil((p.end - t0) / bar) + 1, shots = [];
    const has = k => ros.includes(k) && (k === "claude" || p.band);
    const over = (L, a, b) => (L || []).reduce((s, e) => s + Math.max(0, Math.min(b, e.end) - Math.max(a, e.t)), 0);
    const cnt = (L, a, b, f) => (L || []).reduce((s, e) => s + (e.t >= a && e.t < b && (!f || f(e)) ? 1 : 0), 0);
    let cur = null, n = 0, side = 1, gi = 0;
    const push = (b, who, kind, len) => { side = -side; cur = {t: t0 + b * bar, end: t0 + (b + len) * bar, who, kind, side, glide: kind !== "fill" && kind !== "head" && shots.length % 3 === 2, crane: shots.filter(x => x.who === "wide").length % 2 === 1, cam: kind === "head" ? "head" : who === "wide" ? "wide" : "member"}; shots.push(cur); };
    for (let b = 0; b < nBars; b++){
      const a = t0 + b * bar, z = a + bar;
      if (cur && a < cur.end) continue;
      if (b < 2){ push(b, "wide", "wide", 2); continue; }
      const vox = over(p.voxEv, a, z + bar) / (bar * 2), gtr = cnt(p.events, a, z + bar), keys = cnt(p.keysEv, a, z + bar), bass = cnt(p.bassEv, a, z + bar);
      const fill = cnt(p.drumEv, z - spb, z, e => e.k === "tom" || e.k === "snare" || e.k === "crash") >= 3;
      if (fill && has("erlik") && (!cur || cur.who !== "erlik")){ push(b, "erlik", "fill", 1); continue; }
      n++;
      let pick;
      if (n % 4 === 0) pick = ["wide", "wide"];
      else {
        const sc = [["claude", gtr * 1.2], ["umay", bass * 0.8], ["ulgen", keys * 1.5], ["erlik", cnt(p.drumEv, a, z) * 0.3]].filter(x => has(x[0])).sort((x, y) => y[1] - x[1]);
        const top = sc.length ? sc[(cur && cur.who === sc[0][0] && sc.length > 1) ? 1 : 0][0] : "wide";
        pick = top === "claude" ? ["claude", n % 3 === 1 ? (gi++ % 2 ? "head" : "guitar") : "close"] : [top, "medium"];
        if (vox > 0.25 && has("sahmeran")){ const others = sc.map(x => x[0]); pick = n % 4 === 1 ? ["sahmeran", "close"] : n % 4 === 3 ? ["sahmeran", "medium"] : [others[(n >> 2) % Math.max(1, others.length)] || "wide", "medium"]; }
      }
      push(b, pick[0], pick[1], 2);
    }
    return shots;
  }
  function planShots(p, spb, t0, ros){
    return p.song.shots ? authored(p.song.shots, spb, t0, p.end) : autoPlan(p, spb, t0, ros);
  }

  const _H = new THREE.Vector3(), _F = new THREE.Vector3(), _R = new THREE.Vector3(), _L = new THREE.Vector3();
  function directPose(now, wall, sh, ros){
    cam = "group";
    const u0 = sh ? Math.min(1, Math.max(0, (now - sh.t) / (sh.end - sh.t))) : 0;
    switch (sh && sh.cam){
      case "head": cam = "head"; return;
      case "stage": cam = "stage"; orbit.theta = -0.5 + u0 * 0.6; orbit.r = 1.3; orbit.phi = 1.3; placeCams(); return;
      case "dolly": { const u = sh.reverse ? 1 - u0 : u0; groupCam.position.set(0.1 - 0.4 * u, 0.55, 5.0 - 0.6 * u); groupCam.lookAt(0, 0.1, -0.8); return; }
      case "orbit": { const a = sh.from + (sh.to - sh.from) * u0; groupCam.position.set(Math.sin(a) * 3.8, 0.65, -0.6 + Math.cos(a) * 3.8); groupCam.lookAt(0, 0.05, -0.8); return; }
      case "outro": { const k = sm(Math.min(1, u0 * sh.k)); groupCam.position.set(0, 0.5 + 0.5 * k, 4.0 + 2.0 * k); groupCam.lookAt(0, 0.15, -0.9); return; }
    }
    if (!sh || sh.who === "wide" || !FIG[sh.who] || !ros.includes(sh.who)){
      const sd = sh ? sh.side : 1, ue = sm(u0);
      if (sh && sh.crane) groupCam.position.set(0.15 + sd * 0.9 * (1 - ue), 0.35 + 0.75 * ue, 4.3 - 0.3 * ue);
      else groupCam.position.set(0.15 + 0.45 * Math.sin(wall * 0.12) + sd * 0.6 * (1 - ue), 0.8 + 0.1 * ue, 4.55 - 0.5 * ue);
      groupCam.lookAt(0, -0.05, -0.8); return;
    }
    const f = FIG[sh.who], u = sm(u0), sd = sh.side;
    f.g.updateMatrixWorld(true); f.head.getWorldPosition(_H);
    _F.set(0, 0, 1).applyQuaternion(f.g.quaternion); _R.set(1, 0, 0).applyQuaternion(f.g.quaternion);
    let d = 1.15, lat = 0.42, hy = -0.08, look = -0.14;
    if (sh.kind === "medium"){ d = 2.0; lat = 0.5; hy = -0.2; look = -0.42; }
    if (sh.kind === "fill"){ d = 1.55; lat = 0.55; hy = -0.38; look = -0.5; }
    if (sh.kind === "guitar"){ d = 0.95; lat = 0.6; hy = -0.3; look = -0.62; }
    // Önde başka bir üye kadrajı kapatıyorsa diğer tarafı ya da daha yakın açıyı seç (çekim başına bir kez).
    // Hesap üyelerin hareketsiz konumlarıyla yapılır; hangi karede hesaplandığından bağımsız aynı sonucu verir.
    if (!sh.cfg){
      const H0 = restHead(f), tgt = H0.clone().add(new THREE.Vector3(0, look, 0)), opts = [];
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
    // El kamerası hissi: yakın planlarda çok küçük, yavaş titreşim
    const hh = 0.005 * d; groupCam.position.x += hh * (Math.sin(wall * 1.3) + 0.5 * Math.sin(wall * 2.9 + 1)); groupCam.position.y += hh * 0.7 * Math.sin(wall * 1.7 + 2);
    groupCam.lookAt(_H.x, _H.y + look, _H.z);
  }

  // Bazı geçişler kesme yerine yumuşak kayma: önceki çekimin bitiş konumundan yeni çekime 0.9 sn'de akar.
  // Başlangıç konumu önceki çekimin bitiş anından hesaplanır, "son karede kamera neredeydi"den değil.
  const camPrev = {sh: null, from: null};
  function direct(now, wall, playing, ros){
    const shots = playing && playing.shots ? playing.shots : null;
    let sh = shots ? shots.find(x => now >= x.t && now < x.end) : null;
    if (!sh && shots && shots.length && now >= shots[shots.length - 1].t) sh = shots[shots.length - 1];
    if (sh !== camPrev.sh){
      camPrev.sh = sh; camPrev.from = null;
      const idx = sh && sh.glide ? shots.indexOf(sh) : -1;
      if (idx > 0 && MOVES_GROUP[shots[idx - 1].cam]){
        const prev = shots[idx - 1];
        directPose(prev.end, prev.end, prev, ros);
        camPrev.from = {pos: groupCam.position.clone(), q: groupCam.quaternion.clone()};
        // Kayma yolu bir üyenin içinden geçecekse normal kesmeye dön
        directPose(sh.t + 0.9, sh.t + 0.9, sh, ros); const A = camPrev.from.pos, B = groupCam.position.clone();
        for (let k = 1; k < 12 && camPrev.from; k++){ const P = A.clone().lerp(B, k / 12);
          Object.keys(FIG).forEach(n => { if (!camPrev.from || !ros.includes(n)) return; const o = restHead(FIG[n]);
            if (Math.hypot(P.x - o.x, P.z - o.z) < 0.45 && P.y < o.y + 0.2) camPrev.from = null; }); }
      }
    }
    directPose(now, wall, sh, ros);
    if (camPrev.from && sh){
      const k = Math.min(1, (now - sh.t) / 0.9), e = k * k * (3 - 2 * k);
      if (k < 1){
        groupCam.position.lerpVectors(camPrev.from.pos, groupCam.position.clone(), e);
        if (groupCam.quaternion.slerpQuaternions) groupCam.quaternion.slerpQuaternions(camPrev.from.q, groupCam.quaternion.clone(), e);
        else THREE.Quaternion.slerp(camPrev.from.q, groupCam.quaternion.clone(), groupCam.quaternion, e);
      }
      else camPrev.from = null;
    }
  }
  return { planShots, direct, directPose, get cam(){ return cam; } };
}
