// Sahnedeki kişileri kurar ve her karede canlandırır: nefes/salınım, göz kırpma, enstrüman pozu, ışık şovu.
// Kişinin kendi geometrisi ve pozu members/ altında; burası ortak olanı yapar. Figür kancaları (varsa, yoksa mankenin yolu):
//   fig.life(L)              nefes, salınım ve beden dili sayılarını kendi gövdesine uygular (L: life'ın sayıları)
//   fig.commit(now, wall)    pozdan (IK) sonra: duruşu kendi gövdesine aktarır (Kanade: vekil → kemikler, ifade); aynı karede ölçüm bayat okumaz
//   fig.late(ctx)            karenin sonunda (askı ve kamera yerinde, odada confine'dan sonra): ikincil hareket (saç, etek, bakış)
import * as THREE from "three";
import { rand } from "../rng.js";
import { beatAt, accents, intensity } from "../music/clock.js";
import { FLOOR, worldOf, setFigVisible } from "./figures.js";
import { MEMBER_RIGS } from "./members/index.js";
import { lifeL } from "./members/groove.js";

// Göz kırpma takvimi (kurulumda tohumlu üreteçle, f.blinks; render işçileri aynı anda kırptırır): wall anında süren kırpmanın başından geçen süre
// (sn, 0..BLINK), kırpma yoksa -1. Gözünü kendisi çizen figür (Kanade) bunu okur.
export const BLINK = 0.14;
export function blinkAt(f, wall){
  let lo = 0, hi = f.blinks.length;
  while (lo < hi){ const m = (lo + hi) >> 1; if (f.blinks[m] <= wall) lo = m + 1; else hi = m; }
  const T = lo > 0 ? f.blinks[lo - 1] : -1;
  return T >= 0 && wall < T + BLINK ? wall - T : -1;
}

// karakter: üyenin gövdesi ("kanade" varsayılan, "manken" tur 4'ün gövdesi: yedek ve ölçüm tabanı). ready / whenReady: üyelerin gövdesi (Kanade'nin
// VRM'i) takılı mı.
export function createRigs({scene, model, hemi, drawBanner, karakter}){
  const parts = {}, FIG = {}, LIGHTS = {}, beams = {};
  MEMBER_RIGS.forEach(M => { const m = M.build({scene, model, karakter}); parts[M.id] = m; FIG[M.id] = m.fig; LIGHTS[M.id] = m.light; });

  // Göz kırpma: kafadaki küçük göz kürelerini bul. Kırpma anları baştan, tohumlu üreteçle hesaplanır;
  // böylece kareleri paylaşan render işçileri aynı anda kırptırır.
  Object.values(FIG).forEach(f => {
    f.eyes = f.head.children.filter(m => m.geometry && m.geometry.type === "SphereGeometry" && m.geometry.parameters.radius < 0.016 && m.position.z > 0.1);
    f.eyeY = f.eyes.map(m => m.scale.y);
    f.blinks = []; let t = 1 + rand() * 3;
    for (let i = 0; i < 600; i++){ f.blinks.push(t); t += 0.14 + (rand() < 0.2 ? 0.25 : 2.2 + rand() * 3.5); }
  });
  function blink(f, wall){
    const d = blinkAt(f, wall), k = d >= 0 ? Math.max(0.08, Math.abs(d / 0.07 - 1)) : 1;
    f.eyes.forEach((m, i) => { m.scale.y = f.eyeY[i] * k; });
  }
  // Tepede renkli ışık hüzmeleri: sahneyi boş bırakmamak için kişinin üstüne ve iki yanına
  const beamList = [];
  MEMBER_RIGS.forEach(M => {
    const p = worldOf(FIG[M.id], new THREE.Vector3(0, 0, 0));
    [[0, M.beam], [-1.6, 0xff3a24], [1.6, 0x9cc4ff], [-0.8, 0x47f0a2], [0.9, 0xbcd8ff]].forEach(([dx, col], i) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.3, 28, 1, true), new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
      c.position.set(p.x + dx, FLOOR + 1.65, p.z - (i ? 0.6 : 0)); c.userData.col = col; scene.add(c); beamList.push(c); if (i === 0) beams[M.id] = c;
    });
  });
  let rosterKey = "";
  // Sap kamerasında üye neyin görüneceğini kendisi seçer (headCam)
  function applyRoster(roster, headCamOn){
    MEMBER_RIGS.forEach(M => {
      const on = roster.includes(M.id);
      setFigVisible(FIG[M.id], on, on && headCamOn);
      if (on && headCamOn && M.headCam) M.headCam(parts[M.id]);
      LIGHTS[M.id].visible = on; (parts[M.id].extras || []).forEach(x => { x.visible = on; });
    });
    const key = roster.join(",");
    if (key !== rosterKey){ rosterKey = key; drawBanner(roster); }
  }
  // Nefes, salınım ve beden dili. Üyenin groove(p, t) duruşu ({lean, bob, head, drop, spread}, zamanın saf fonksiyonu) üç yerde okunur:
  // kafa şimdiki anın, göğüs LAG sonrasının, pelvis 2·LAG sonrasının duruşunu alır; yani pelvis önden gider, göğüs ve kafa onu gecikmeyle
  // izler (aynı fonksiyon farklı t'de: durum birikmez) ve kafanın vuruşu tam vuruşa düşer.
  // Sayılar her figürde aynı (members/groove.js lifeL): L = {br nefes, rx/rz/ry üst gövdenin eğimi, drop pelvisin inişi, nod kafanın eğimi, look
  // kafanın yana dönüşü, spread ayakların açılması}; fig.life(L) varsa figür uygular, yoksa mankenin grupları (mankenLife).
  // LEAN_Z: öne eğilirken kalçanın geri kayma kolu = gitarın dayandığı yükseklik (göbek, kalçadan ~0.22): o hizada gövde yerinde kalır,
  // gitar sahneye sabit olduğu için içine girmez (kemer hizası 0.06 iken dorukta gövde gitara 11 mm giriyordu)
  const LEAN_Z = 0.22;
  function life(fig, wall, now, p, groove){
    const L = lifeL(fig, wall, now, p, groove);
    if (fig.life) fig.life(L); else mankenLife(fig, L);
  }
  function mankenLife(fig, L){
    const u = fig.up;
    if (u.userData.y0 === undefined) u.userData.y0 = u.position.y;
    fig.torso.scale.set(1 + 0.018 * L.br, 1 + 0.01 * L.br, 1 + 0.03 * L.br);
    u.rotation.x = L.rx; u.rotation.z = L.rz; u.rotation.y = L.ry;
    u.position.y = u.userData.y0 + 0.004 * L.br - L.drop;
    u.position.z = -LEAN_Z * Math.sin(u.rotation.x);   // öne eğilirken kalça geri: gitara yaslanan karın yerinde kalır
    fig.nod(L.nod); fig.head.rotation.y = L.look; fig.stance(L.spread);
  }
  // Vurgu flaşı: vurgulardan (clock.js accents) aralarında en az FLASH_GAP sn olanlar seçilir, her biri ~0.3 sn'de sönen bir darbe.
  // Işığa duyarlı epilepsi sınırı (ITU-R BT.1702, Harding): herhangi bir saniyede 3'ten fazla tam ekran parlama olmamalı; 0.5 sn aralık
  // saniyede en çok 2 verir (eskiden vurgu zarfının türeviydi ve Dağ Kralı'nda saniyede 7 flaş çıkıyordu). Seçim p başına bir kez, sırayla.
  const FLASH_GAP = 0.5, FLASH_TAU = 0.12, flashCache = new WeakMap();
  function flashes(p){
    let f = flashCache.get(p); if (f) return f;
    f = []; let last = -9;
    for (const a of accents(p)) if (a.t - last >= FLASH_GAP){ f.push(a); last = a.t; }
    flashCache.set(p, f); return f;
  }
  function flashAt(p, now){
    if (!p) return 0;
    let h = 0;
    for (const a of flashes(p)){ if (a.t > now) break; if (now - a.t < 1) h = Math.max(h, a.w * Math.exp(-(now - a.t) / FLASH_TAU)); }
    return Math.min(1, h) * (0.55 + 0.45 * intensity(p, now));
  }
  let flash = 0, stage = true;   // stage: mekanda sahne şovu var mı (ENVS show; odada yok: hüzme ve flaş kapalı)
  // Her karede: kişiyi çalınan notalara göre pozlar, ışık şovunu günceller. hemiBase: mekanın temel ortam ışığı.
  function updateBand(now, wall, p, hemiBase){
    const beat = beatAt(p, now);   // ortak ritim saati: şarkının gerçek vuruşu (çalmıyorken 90 BPM boşta)
    if (wall === undefined) wall = now;
    MEMBER_RIGS.forEach(M => life(FIG[M.id], wall, now, p, M.groove));
    Object.values(FIG).forEach(f => blink(f, wall));
    const ctx = {now, wall, p, beat};
    MEMBER_RIGS.forEach(M => M.pose(parts[M.id], ctx));
    MEMBER_RIGS.forEach(M => { const f = FIG[M.id]; if (f.commit) f.commit(now, wall); });
    // Işık şovu: vurguda flaş (hüzmeler kendi renginde parlar; pozlama darbesini sim.js Finish'e verir), hüzmeler ritimle salınır,
    // yoğun yerde biraz daha dolgun. Ortam ışığı (hemi) flaşta değişmez: eklenen beyaz ışık siyahları açıp görüntüyü grileştiriyordu.
    flash = stage ? flashAt(p, now) : 0;
    const I = intensity(p, now);
    beamList.forEach((b, i) => {
      const sw = p ? 0.16 : 0.05, ph = i * 1.3;
      b.rotation.z = sw * Math.sin(beat * Math.PI / 4 + ph); b.rotation.x = sw * 0.6 * Math.cos(beat * Math.PI / 4 + ph * 0.7);
      b.material.opacity = 0.04 + (p ? 0.012 * I + 0.02 * Math.max(0, Math.sin(beat * Math.PI / 2 + i)) + 0.025 * flash : 0);
      b.material.color.setHex(b.userData.col).multiplyScalar(1 + 0.8 * flash);
    });
    hemi.intensity = hemiBase;
  }
  function setStage(on){ stage = !!on; beamList.forEach(b => { b.visible = stage; }); }
  // Geç kanca (sim.update'in sonunda): ctx = {now, wall, p, model, strap, cam: o karenin kamerası, headCam}
  function late(ctx){ MEMBER_RIGS.forEach(M => { const f = FIG[M.id]; if (f.late) f.late(ctx); }); }
  const figs = Object.values(FIG);
  return { FIG, LIGHTS, beams, parts, applyRoster, updateBand, late, setStage, invalidateBanner(){ rosterKey = ""; }, get flash(){ return flash; },
    get ready(){ return figs.every(f => f.ready !== false); }, whenReady: ms => Promise.all(figs.map(f => f.whenReady ? f.whenReady(ms) : null)) };
}
