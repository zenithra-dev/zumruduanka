// Oda mekânı: sıcak, loş, samimi bir genç yatak odası köşesi. Kabuk (zemin, tavan, dört duvar, süpürgelik), yatak, ışık, dekor, eşyalar ve amfi
// room/ altında kendi dosyalarında (her kol kendi parçasını ayrıntılandırır). Bütün sayılar room/layout.js'te. rand() yok (ses akışını
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
import { FLOOR as FIG_FLOOR } from "./figures.js";
import { FLOOR, CEIL, SHELL, BED, SEAT, SLOTS, LIGHTS, WALLS, CAMERA } from "./room/layout.js";
import { buildBedding } from "./room-props.js";
import { buildCat } from "./cat.js";
import { buildLights } from "./room/lights.js";
import { buildDecor, onWall } from "./room/decor.js";
import { buildProps } from "./room/props.js";
import { buildAmp } from "./room/amp.js";
import { buildShell } from "./room/shell.js";

export { onWall };
const box3 = (x, y, z) => new THREE.Box3(new THREE.Vector3(x[0], y[0], z[0]), new THREE.Vector3(x[1], y[1], z[1]));

export function createRoom({renderer} = {}){
  if (FLOOR !== FIG_FLOOR) throw new Error("room/layout.js FLOOR figures.js ile aynı olmalı");
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  const group = new THREE.Group(), textures = [];
  const parts = {bed: buildBedding({aniso}), lights: buildLights(), decor: buildDecor({aniso}), props: buildProps(), amp: buildAmp({aniso})};
  parts.cat = buildCat({aniso, surfaceAt: parts.bed.surfaceAt});   // kara kedi (cat.js) battaniyenin gerçek yüzeyinde
  // Kabuk (room/shell.js): zemin, duvarlar, tavan, süpürgelik; ampullerin ışık haritası için ışık parçasını kullanır
  const shell = buildShell({aniso, lights: parts.lights}), walls = shell.walls;
  [shell, ...Object.values(parts)].forEach(p => { group.add(p.group); (p.textures || []).forEach(t => textures.push(t)); });

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
    [parts.bed, parts.props, parts.amp, parts.cat].forEach(p => p.group.traverse(o => { if (o.isMesh) out.push(new THREE.Box3().setFromObject(o)); })); return out; }
  // Tembel dokular (kabuk, amfi; room/tex.js): ilk güncellemede ya da dokular ilk okunduğunda bir kez boyanır (kulüp kurulumu ödemez)
  const paint = () => [shell, ...Object.values(parts)].forEach(p => p.paint && p.paint());
  function update(now, wall, p){ paint(); parts.lights.update(now, wall, p); parts.props.update(now, wall, p); parts.cat.update(now, wall, p); }

  const slots = Object.assign({}, SLOTS, {isik: LIGHTS});
  const room = {group, parts, get textures(){ paint(); return textures; }, walls, bed, slots, bounds, avoid, shell: SHELL, subject: subj, free: false, lastPull: 0, inside, confine, solids, update,
    level: wall => parts.lights.level(wall)};
  return room;
}
