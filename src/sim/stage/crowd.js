// Seyirci: instanced silüetler. Sahne önünde ayakta kalabalık, tiyatroda basamaklarda oturanlar.
// Enerji müziğin yoğunluğundan (clock.js intensity): sakin yerde hafif salınım, dorukta zıplama ve havada kollar, son vuruştan sonra tezahürat.
// Hareket vuruşa (beatAt) oturur; kişiler arası çeşitlilik (faz, tip, eşik) durumsuz hash01 ile. Kurulumdaki rand() çağrıları
// aynen kalır: rastgele akış sesi de belirler, sayıları değişirse ses değişir.
import * as THREE from "three";
import { rand, hash01 } from "../rng.js";
import { beatAt, intensity, accentAt } from "../music/clock.js";
import { FLOOR } from "./figures.js";

const ARM = 0.42;                 // kol boyu (m); kol omuzdan döner
const HOLD = 4, STEP = 0.25, REL = 2.5;   // enerji: son HOLD sn'nin tepesi, REL sn'de söner (coşku birden gelir, yavaş gider)
const clamp01 = x => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const arc = x => 4 * x * (1 - x);  // 0..1 fazında zıplama yayı: vuruşta yerde, arada tepede
const frac = x => x - Math.floor(x);
// Yoğunluk → seyirci enerjisi 0..1 (dağkralı: sinsi ~0, tur 3 ~0.4, doruk 1)
const excite = I => ss(0.25, 0.8, I);
// Zamanın saf fonksiyonu: geçmiş, aynı fonksiyonun daha erken t'lerde örneklenmesiyle okunur (kare sırası önemsiz)
function energyAt(p, now){
  let e = 0;
  for (let j = 0; j * STEP <= HOLD; j++) e = Math.max(e, intensity(p, now - j * STEP) * Math.exp(-j * STEP / REL));
  return excite(e);
}
// Final: son nota başlangıcından hemen sonra tezahürat; gücü son 6 sn'nin coşkusuna göre (ağıtta bile biraz alkış)
const finale = new WeakMap();
function cheerAt(p, now){
  let f = finale.get(p);
  if (!f){
    const t = p.events.length ? p.events[p.events.length - 1].t : p.t0; let m = 0;
    for (let x = t - 6; x <= t; x += STEP) m = Math.max(m, intensity(p, x));
    finale.set(p, f = {t, amp: 0.35 + 0.65 * excite(m)});
  }
  return f.amp * ss(f.t + 0.15, f.t + 0.9, now);
}

export function createCrowd(scene){
  const P = [];   // arm alanı artık kullanılmıyor (kollar tipten gelir); rand() sırası bozulmasın diye çekilmeye devam eder
  for (let row = 0; row < 4; row++) for (let i = 0; i < 16; i++){
    const x = -3.0 + i * 0.4 + (row % 2) * 0.2 + (rand() - 0.5) * 0.12, z = 2.65 + row * 0.36 + (rand() - 0.5) * 0.1;
    P.push({x, z, y: FLOOR, h: 0.88 + rand() * 0.14, ph: rand() * 6.28, arm: rand() < 0.38, sd: rand() < 0.5 ? -1 : 1, seat: false});
  }
  for (let k = 0; k < 6; k++) for (let i = 0; i < 26; i++){
    const r = 6.55 + k * 0.75, a = -1.05 + (i + rand() * 0.5) / 26 * 2.1;
    if (rand() < 0.25) continue;
    P.push({x: r * Math.sin(a), z: 1.2 + r * Math.cos(a), y: FLOOR + 0.43 + k * 0.42, h: 0.62 + rand() * 0.08, ph: rand() * 6.28, arm: rand() < 0.2, sd: rand() < 0.5 ? -1 : 1, seat: true, ry: Math.PI + a});
  }
  // Kişinin davranışı (rand() tüketmez): vuruşa göre faz kayması, tip (zıplayan / sallanan / yumruk), katılma eşiği, iki kol mu, el sallama hızı
  P.forEach((q, i) => {
    const t = hash01(i, "seyirci-tip");
    q.off = (hash01(i, "seyirci-faz") - 0.5) * 0.16;
    q.tip = t < 0.4 ? "zipla" : t < 0.75 ? "salla" : "yumruk";
    q.esik = hash01(i, "seyirci-esik") * 0.45;
    q.iki = hash01(i, "seyirci-kol") < 0.6;
    q.el = 0.9 + hash01(i, "seyirci-el") * 0.8;
    q.elf = hash01(i, "seyirci-elfaz") * 6.28;
    q.cosku = 0.6 + 0.4 * hash01(i, "seyirci-cosku");
    q.fwd = q.seat ? 1 : -1;   // sahneye doğru yerel z (ayaktakiler dönmemiş, oturanlar ry ile sahneye dönük)
  });
  const sil = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1}); // renk örnekten gelir; lineerde iki koyu rengin çarpımı kapkara olur
  const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.12, 1, 10), sil, P.length);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 10), sil, P.length);
  const armGeo = new THREE.CylinderGeometry(0.022, 0.03, ARM, 6); armGeo.translate(0, ARM / 2, 0);   // dönme noktası omuzda
  const arm = new THREE.InstancedMesh(armGeo, sil, P.length * 2);   // kişi başına iki kol: 2i sağ, 2i+1 sol
  const col = new THREE.Color();
  // Örnek renkleri sRGB'de seçilir, lineere çevrilip yazılır (linearize yalnız malzeme rengini çevirir)
  P.forEach((q, i) => { col.setHSL(0.05 + rand() * 0.08, 0.25, 0.1 + rand() * 0.08).convertSRGBToLinear(); body.setColorAt(i, col); head.setColorAt(i, col); arm.setColorAt(2 * i, col); arm.setColorAt(2 * i + 1, col); });
  [body, head, arm].forEach(m => { m.frustumCulled = false; scene.add(m); });
  const C = {P, body, head, arm, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), qa: new THREE.Quaternion(), e: new THREE.Euler(),
    c: new THREE.Vector3(), o: new THREE.Vector3(), sc: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1)};

  // Kol: omuz gövdenin üst yanında (C.c gövde merkezi, C.q gövde dönüşü). θ 0 dimdik yukarı, π aşağı sarkık; kol yan düzlemde dışa açılır.
  function armAt(i, side, th, ry, sway, bh){
    C.o.set(side * 0.15, bh / 2 - 0.035, 0).applyQuaternion(C.q).add(C.c);
    C.e.set(0, ry, sway - side * th); C.qa.setFromEuler(C.e);
    C.m4.compose(C.o, C.qa, C.one); C.arm.setMatrixAt(2 * i + (side > 0 ? 0 : 1), C.m4);
  }

  function update(now, wall, p, envName){
    const beat = beatAt(p, now), theater = envName === "theater";
    const E = p ? energyAt(p, now) : 0, cheer = p ? cheerAt(p, now) : 0;
    // Hızlı tempoda zıplayanlar iki vuruşta bir zıplar (yumuşak geçiş); vurgudan ~0.12 sn sonra (tepki süresi) ek bir sıçrama
    const rate = p ? (beatAt(p, now + 0.05) - beatAt(p, now - 0.05)) / 0.1 : 0, half = ss(2.0, 2.8, rate);
    const kick = p ? accentAt(p, now - 0.12) : 0;
    C.P.forEach((q, i) => {
      const vis = !q.seat || theater, base = vis ? q.y : -50, ry = q.ry || 0, bh = q.h * 0.78;
      const e = ss(q.esik, q.esik + 0.5, E), u = beat + q.off, ch = cheer * q.cosku, beatArc = arc(frac(u));
      const free = Math.abs(Math.sin(wall * q.el * 3.1 + q.elf));   // finalde vuruştan bağımsız, kişiye özgü
      const hop = q.seat ? 0.012 * e * beatArc + 0.02 * ch * free
        : q.tip === "zipla" ? (0.02 + 0.09 * e) * e * ((1 - half) * beatArc + half * arc(frac(u / 2))) + 0.04 * e * kick + 0.08 * ch * free
        : (0.012 + 0.02 * e) * e * beatArc + 0.03 * ch * free;
      // Salınım: hep biraz (nefes, ağırlık), enerjiyle iki vuruşta bir yana; sallananlarda daha geniş
      const sway = 0.035 * Math.sin(wall * 0.7 + q.ph) + (q.tip === "salla" ? 0.07 : 0.02) * e * Math.sin(Math.PI * u);
      C.e.set(0, ry, sway); C.q.setFromEuler(C.e); C.c.set(q.x, base + hop + bh / 2, q.z);
      C.m4.compose(C.c, C.q, C.sc.set(1, bh, 1)); C.body.setMatrixAt(i, C.m4);
      // Kafa: gövdenin üstünde, vuruşta hafif öne ve aşağı (baş sallama)
      const nod = 0.025 * e * beatArc;
      C.o.set(0, bh / 2 + 0.1 - nod * 0.4, nod * q.fwd).applyQuaternion(C.q).add(C.c);
      C.m4.compose(C.o, C.q, C.sc.set(1, 1.1, 1)); C.head.setMatrixAt(i, C.m4);
      // Kollar: sakinde yanda; enerjiyle kalkar (yumruk önce, zıplayan sonra, sallanan yalnız en coşkulu yerde), vuruşta yukarı vurur,
      // arada biraz iner; finalde havada, kişiye özgü hızla sallanır. Görünmeyen kişinin kolları da gövdesiyle birlikte aşağıda kalır.
      // Kalkış oranı açıya keskinleştirilerek çevrilir: ara oranlar yatay duran kol değil, kalkmakta olan kol olur.
      const r1 = ss(0.2, 0.75, Math.max(q.tip === "yumruk" ? ss(0.15, 0.55, e) : q.tip === "zipla" ? ss(0.45, 0.85, e) : ss(0.7, 1, e), ch));
      const r2 = q.iki ? Math.max(r1 * ss(0.5, 0.9, e), ss(0.2, 0.75, ch)) : 0;
      const pump = (q.tip === "yumruk" ? 0.4 : 0.15) * (0.5 - 0.5 * Math.cos(2 * Math.PI * u)), wave = 0.3 * Math.sin(wall * q.el * 2 + q.elf);
      const down = Math.PI - 0.14 - 0.1 * e, up = q.tip === "salla" ? 0.5 : 0.3;
      armAt(i, q.sd, down + (up - down) * r1 + r1 * (1 - ch) * pump + ch * r1 * q.sd * wave, ry, sway, bh);
      armAt(i, -q.sd, down + (up - down) * r2 + r2 * (1 - ch) * pump - ch * r2 * q.sd * wave, ry, sway, bh);
    });
    C.body.instanceMatrix.needsUpdate = C.head.instanceMatrix.needsUpdate = C.arm.instanceMatrix.needsUpdate = true;
  }
  // Sahne şovu olmayan mekanda (oda) kalabalık gizli; sim.js o zaman update çağırmaz
  function setVisible(v){ [body, head, arm].forEach(m => { m.visible = !!v; }); }
  return { update, setVisible };
}
