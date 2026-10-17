// Oda mekânı: sıcak, loş, samimi bir genç yatak odası köşesi. Kabuk (zemin, tavan, dört duvar, süpürgelik) burada; yatak, ışık, dekor ve
// eşyalar room/ altında kendi dosyalarında (her kol kendi parçasını ayrıntılandırır). Bütün sayılar room/layout.js'te. rand() yok (ses akışını
// kaydırır), çeşitlilik hash01 ile; update zamanın saf fonksiyonu. Mekân seçilmedikçe grup sahnede değil (venues.js): kulübe maliyeti yok.
//
//   const room = createRoom({renderer});
//   room.bounds, room.avoid          kameranın kalacağı kutu (Box3) ve kaçınacağı eşya kutuları [{ad, box}]; room.inside(p)
//   room.walls                       [{ad, plane (normal odaya), o, u, n, w, h, decor: [{ad, u, v, yogunluk}]}]; dünya noktası: onWall(W, u, v)
//   room.bed                         {box, topY, seat: {hip, facing, yaw, cushionY, footY, edgeZ, thighClear (Box3)}}
//   room.slots                       kedi, peluşlar, amfi, tabela (layout.js SLOTS) ve ışık askı noktaları (LIGHTS)
//   room.textures                    kanvas dokuları (ölçüm: piksel özeti)
//   room.update(now, wall, p)        pırıltı, kedi nefesi ...
//   room.confine(cam, subject?, fov?) kamerayı odanın içine çeker
import * as THREE from "three";
import { hash01 } from "../rng.js";
import { FLOOR as FIG_FLOOR, mat } from "./figures.js";
import { canvasTexture } from "./canvas-tex.js";
import { FLOOR, CEIL, SHELL, BED, SEAT, SLOTS, LIGHTS, WALLS, CAMERA } from "./room/layout.js";
import { buildBed } from "./room/bed.js";
import { buildLights } from "./room/lights.js";
import { buildDecor, onWall } from "./room/decor.js";
import { buildProps } from "./room/props.js";

export { onWall };
const box3 = (x, y, z) => new THREE.Box3(new THREE.Vector3(x[0], y[0], z[0]), new THREE.Vector3(x[1], y[1], z[1]));

// Ahşap zemin: sıcak meşe tahtalar (0.15 m), damar ve ek yerleri; döşeme boyu 1.2 m
const PLANK = 0.15, TILE = 1.2;
function floorTexture(aniso){
  return canvasTexture(1024, 1024, (g, w, h) => {
    const n = Math.round(TILE / PLANK), bw = w / n, per = h / 6;   // damar dalgası döşeme boyunun alt katı: tekrar sınırında kesilmez
    for (let i = 0; i < n; i++){
      // Sütun başına iki ek yeri (komşulardan kaydırılmış); ikinci tahta döşeme sınırından taşar, üstte devam eder
      const x0 = i * bw, c1 = 0.5 * h * hash01(i, "zemin-ek1"), c2 = c1 + h * (0.35 + 0.3 * hash01(i, "zemin-ek2"));
      [[c1, c2], [c2, c1 + h]].forEach(([a, b], j) => {
        const k = hash01(i * 2 + j, "zemin-ton");
        for (const off of [0, -h]){
          g.fillStyle = `hsl(${27 + 4 * hash01(i * 2 + j, "zemin-hue")}, ${28 + 6 * k}%, ${27 + 6 * k}%)`; g.fillRect(x0, a + off, bw, b - a);
          g.strokeStyle = "rgba(40,22,10,0.16)"; g.lineWidth = 1.2;
          for (let s = 0; s < 9; s++){ const u = x0 + bw * (0.08 + 0.84 * hash01(s, i * 31 + j)), ph = 6.28 * hash01(s, "zemin-dalga" + i), amp = 1.5 + 2.5 * hash01(s, "zemin-genlik" + j);
            g.beginPath(); for (let y = a; y <= b + 0.5; y += 16){ const xx = u + amp * Math.sin(2 * Math.PI * y / per + ph); if (y === a) g.moveTo(xx, y + off); else g.lineTo(xx, y + off); } g.stroke(); }
          g.fillStyle = "rgba(25,14,6,0.55)"; g.fillRect(x0, b + off - 1.5, bw, 3);
        }
      });
    }
    g.fillStyle = "rgba(25,14,6,0.6)"; for (let i = 0; i <= n; i++) g.fillRect(i * bw - 1.5, 0, 3, h);
  }, {ad: "zemin", fonts: false, anisotropy: aniso, repeat: [(SHELL.x1 - SHELL.x0) / TILE, (SHELL.z1 - SHELL.z0) / TILE]});
}

export function createRoom({renderer} = {}){
  if (FLOOR !== FIG_FLOOR) throw new Error("room/layout.js FLOOR figures.js ile aynı olmalı");
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  const group = new THREE.Group(), W = SHELL.x1 - SHELL.x0, D = SHELL.z1 - SHELL.z0, cx = (SHELL.x0 + SHELL.x1) / 2, cz = (SHELL.z0 + SHELL.z1) / 2;
  const textures = [];
  // Kabuk: içe bakan düzlemler. Zemin ahşap, duvarlar bej / sıcak gri boya, tavan kırık beyaz, beyaz süpürgelik.
  const ftex = floorTexture(aniso); textures.push(ftex);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xffffff, {map: ftex, roughness: 0.72})); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, FLOOR, cz); group.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xd9d2c6, {roughness: 0.95})); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, CEIL, cz); group.add(ceil);
  const paint = mat(0xb7a690, {roughness: 0.92}), trim = mat(0xe6e1d8, {roughness: 0.6});
  const walls = WALLS.map(L => {
    const n = new THREE.Vector3(...L.n), mid = L.w / 2, c = new THREE.Vector3(L.o[0] + L.u[0] * mid, FLOOR + (CEIL - FLOOR) / 2, L.o[1] + L.u[1] * mid);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L.w, CEIL - FLOOR), paint); m.position.copy(c); m.rotation.y = Math.atan2(n.x, n.z); group.add(m);
    const sk = new THREE.Mesh(new THREE.BoxGeometry(L.w, 0.08, 0.014), trim); sk.position.copy(c).setY(FLOOR + 0.04).addScaledVector(n, 0.007); sk.rotation.y = m.rotation.y; group.add(sk);
    return {ad: L.ad, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, c), o: L.o, u: L.u, n: L.n, w: L.w, h: CEIL - FLOOR, decor: L.decor, mesh: m};
  });
  const parts = {bed: buildBed(), lights: buildLights(), decor: buildDecor({aniso}), props: buildProps()};
  Object.values(parts).forEach(p => { group.add(p.group); (p.textures || []).forEach(t => textures.push(t)); });

  const bounds = box3(CAMERA.bounds.x, CAMERA.bounds.y, CAMERA.bounds.z);
  const avoid = CAMERA.avoid.map(a => ({ad: a.ad, box: box3(a.x, a.y, a.z)}));
  const V = (...a) => new THREE.Vector3(...a);
  const seat = {hip: V(SEAT.x, SEAT.cushionY + SEAT.hipUp, SEAT.hipZ), facing: V(...SEAT.facing), yaw: Math.atan2(SEAT.facing[0], SEAT.facing[2]),
    cushionY: SEAT.cushionY, footY: SEAT.footY, edgeZ: SEAT.edgeZ, thighClear: box3([SEAT.thigh.x0, SEAT.thigh.x1], [SEAT.thigh.y0, SEAT.thigh.y1], [SEAT.thigh.z0, SEAT.thigh.z1])};
  const bed = {box: box3([BED.frame.x0, BED.frame.x1], [FLOOR, BED.head.top], [BED.frame.z0, BED.frame.z1]), topY: BED.blanket.top, seat};
  const subj = V(...CAMERA.subject);

  // Kamera sınırı: bounds içinde ve avoid kutularının dışında mı
  const inside = p => bounds.containsPoint(p) && !avoid.some(a => a.box.containsPoint(p));
  // Işın C + f·k'nin kutuya giriş ve çıkış parametresi (yoksa null)
  function slab(b, C, f){
    let t0 = -Infinity, t1 = Infinity;
    for (const k of ["x", "y", "z"]){
      if (Math.abs(f[k]) < 1e-9){ if (C[k] < b.min[k] || C[k] > b.max[k]) return null; continue; }
      let a = (b.min[k] - C[k]) / f[k], c = (b.max[k] - C[k]) / f[k]; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    }
    return t0 <= t1 ? [t0, t1] : null;
  }
  const _f = V(), _q = V(), _p = V();
  // Dışarıda (ya da bir eşyanın içinde) kalan kamerayı bakış yönünde konuya doğru içeri çeker: bakış yönü aynı kalır, yalnız yaklaşır;
  // objektif kadrajı korumak için açılır (konu düzleminde aynı genişlik, en çok fovMax; fov false ise dokunulmaz). Saf fonksiyon: aynı poz
  // aynı sonucu verir, içerideki kamera değişmez. Dönen değer çekme boyu (m), -1: ışın yolu yok, kutuya kıstırıldı (room.lastPull: yalnız ölçüm için).
  function confine(cam, subject = subj, fov = true){ return (room.lastPull = pull(cam, subject, fov)); }
  function pull(cam, subject, fov){
    const C = cam.position;
    if (room.free || inside(C)) return 0;
    _f.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const d = Math.max(CAMERA.near + 0.05, _q.subVectors(subject, C).dot(_f)), r = slab(bounds, C, _f);
    let k = r ? Math.max(0, r[0]) + 1e-4 : null;
    for (let it = 0; k !== null && it < 8; it++){
      _p.copy(C).addScaledVector(_f, k);
      const hit = avoid.find(a => a.box.containsPoint(_p)); if (!hit) break;
      const s = slab(hit.box, C, _f); k = s ? s[1] + 1e-4 : null;
    }
    if (k === null || k > Math.min(r[1], d - CAMERA.near)){
      C.clamp(bounds.min, bounds.max);
      for (const a of avoid) if (a.box.containsPoint(C)) C.y = Math.min(bounds.max.y, a.box.max.y + 0.01);
      return -1;
    }
    C.addScaledVector(_f, k);
    if (fov){
      const f = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * d / (d - k)) * 180 / Math.PI, nf = Math.max(cam.fov, Math.min(CAMERA.fovMax, f));
      if (nf !== cam.fov){ cam.fov = nf; cam.updateProjectionMatrix(); }
    }
    return k;
  }
  // Eşyaların gerçek kutuları (her ağın dünya kutusu): kamera ölçümünün payından bağımsız denetimi
  function solids(){ group.updateMatrixWorld(true); const out = [];
    [parts.bed, parts.props].forEach(p => p.group.traverse(o => { if (o.isMesh) out.push(new THREE.Box3().setFromObject(o)); })); return out; }
  function update(now, wall, p){ parts.lights.update(now, wall, p); parts.props.update(now, wall, p); }

  const slots = Object.assign({}, SLOTS, {isik: LIGHTS});
  const room = {group, parts, textures, walls, bed, slots, bounds, avoid, shell: SHELL, subject: subj, free: false, lastPull: 0, inside, confine, solids, update,
    level: wall => parts.lights.level(wall)};
  return room;
}
