// Claude'un gitarı: superstrat (beyaz vernikli gövde, üstünde kan sıçraması boyası), 24 perdeli sap, sivri siyah kafa, HSH manyetikler,
// kilitli tremolo ve kolu, teller, pena ve sap kafasındaki kamera.
// Gitar yerel çerçevesi: x sap boyunca (0 eşik, L köprü, eksi taraf kafa), y teller arası (+ kalın E), z kapaktan dışarı.
import * as THREE from "three";
import { L, FRETS, fretX, STR_Z, stringY, pressX, mtof } from "../music/theory.js";
import { bendDisplacement, bendShape, PRE_IN, REL } from "../music/bend.js";
import { hash01 } from "../rng.js";

const TOP = 0.045, FB_TOP = 0.0565, HS_TOP = 0.05, TAU = Math.PI * 2;
// Gövde kenarı 7 mm yarıçapla yuvarlanır; çizilen hat tasarım hattının (4 mm bevel varsayılarak çizildi) 3 mm içi, dış yüz aynı yerde kalır.
// Kenar profili kapaktan aşağı: üst çeyrek yay (RQ), düz duvar (DEPTH), alt çeyrek yay; toplam VMAX (kenar dokusunun v'si).
const BEV = 0.007, DEPTH = TOP - 2 * BEV, RQ = Math.PI / 2 * BEV, VMAX = 2 * RQ + DEPTH;
const halfFb = x => 0.0215 + 0.007 * x / 0.47;   // klavyenin yarı genişliği (claude.js halfFb ile aynı)

// Gitarın yerleşimi (veri, duruş ya da beden başına bir kayıt): rig aynalı taşıyıcının x'i (figürün orta düzleminin iki katı), p gitarın
// taşıyıcı içindeki yeri, r dönüşü (Euler XYZ, rad). Sağ elle çalış: gitar, Claude'un orta düzlemine (x = 0.2) göre aynalanmış bir taşıyıcıda
// durur. İçteki duruş solak çerçevede kuruldu; taşıyıcı onu çevirir: sap oyuncunun soluna gider, kalın E üstte kalır.
//   manken: sap ~34° yukarı, sırt karında, köprü kemerin biraz altında. Bu duruşta iki dirsek de 60-120° arasında 1-22. perdeye ve penaya
//   yetişir; pena kolunun üst kolu düşeyden 40°'nin altında kalır (gitar daha yüksek ya da yatıkken pena dirseği omuz hizasına kalkıyordu).
export const YERLESIM = {manken: {rig: 0.4, p: [-0.2, 0.32, -0.07], r: [0, 0, -0.6]}};
export function createGuitarModel(scene, yer = YERLESIM.manken){
  // r128 negatif determinantlı nesnelerde yüz yönünü kendisi çevirir; dünya yönü gereken yerde matrixWorld kullanılmalı.
  const rig = new THREE.Group(); rig.scale.x = -1; rig.position.x = yer.rig; scene.add(rig);
  const guitar = new THREE.Group();
  guitar.rotation.set(...yer.r);
  guitar.position.set(...yer.p);
  rig.add(guitar);

  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  // add: küçük parça (sonda batch ile aynı ebeveyn ve malzemedekilerle tek çizime birleşir)
  const add = (geo, mat, x, y, z, par = guitar) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.userData.batch = true; par.add(m); return m; };
  const box = (x0, y0, z0, x1, y1, z1, mat, par) => add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, par);
  // Dik prizma (şekil xy, z0..z1); bev verilirse kenarları yuvarlak, şekil bev kadar büyür
  const prism = (sh, z0, z1, mat, x, y, par, bev = 0) => { const g = new THREE.ExtrudeGeometry(sh, bev ? {depth: z1 - z0 - 2 * bev, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 16}
    : {depth: z1 - z0, bevelEnabled: false, curveSegments: 16}); smoothSides(g, bev > 0); return add(g, mat, x, y, z0 + bev, par); };
  const std = (color, roughness, metalness = 0, map = null) => new THREE.MeshStandardMaterial({color, roughness, metalness, map});
  const chrome = std(0xdfe3e8, 0.2, 0.82), satin = std(0xc6cad0, 0.3, 0.7), steel = std(0x9ea3aa, 0.3, 0.9), blackM = std(0x26272a, 0.32, 0.85), ivory = std(0xefece5, 0.4);

  /* ---------- Gövde ---------- */
  // Superstrat hattı (tur 4 tasarımı: göğüs, perde eli, pena kolu, uyluk bölgelerine girmez), 3 mm içe alınmış; tremolo çukuru delik
  const outline = inset(superstrat(), BEV - 0.004), E = edgeTable(outline), body = new THREE.Shape(outline);
  body.closePath();
  const RECESS = [L - 0.016, -0.056, L + 0.072, 0.042];
  body.holes.push(roundRect(...RECESS, 0.008, THREE.Path));
  const paint = paintTop(outline), top = canvasTex(paint), side = canvasTex(paintSide(paint, E));
  top.repeat.set(1 / (PT.x1 - PT.x0), 1 / (PT.y1 - PT.y0)); top.offset.set(-PT.x0 / (PT.x1 - PT.x0), -PT.y0 / (PT.y1 - PT.y0)); side.wrapS = THREE.RepeatWrapping;
  const bodyGeo = new THREE.ExtrudeGeometry(body, {depth: DEPTH, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 5, curveSegments: 12, UVGenerator: sideUVs(E, (x, y) => x > RECESS[0] - 0.001 && x < RECESS[2] + 0.001 && y > RECESS[1] - 0.001 && y < RECESS[3] + 0.001)});
  smoothSides(bodyGeo); cleanBack(bodyGeo);
  // Beyaz vernik: albedo bloom eşiğinin altında (pena koruyucu "açık beyaz" iken ışıkta lekeye dönüyordu), parlaklık clearcoat'tan; alt katman yarı mat
  // ve az yansıtıcı (geniş parlaması kırmızıyı ışıkta soluklaştırıyordu)
  const lacquer = map => new THREE.MeshPhysicalMaterial({map, roughness: 0.6, reflectivity: 0.25, clearcoat: 1, clearcoatRoughness: 0.06});
  const bodyMesh = new THREE.Mesh(bodyGeo, [lacquer(top), lacquer(side)]);
  bodyMesh.position.z = BEV; guitar.add(bodyMesh);
  // Çukurun koyu tabanı (kenar yuvarlamasının dibinde) ve arkada yay boşluğunun kapağı
  const dark = std(0x0d0a09, 0.95), [rx0, ry0, rx1, ry1] = RECESS;
  prism(roundRect(rx0 + BEV, ry0 + BEV, rx1 - BEV, ry1 - BEV, 0.002), TOP - BEV - 0.0012, TOP - BEV - 0.0002, dark, 0, 0);
  prism(roundRect(rx0 - 0.01, ry0 - 0.01, rx1 + 0.01, ry1 + 0.01, 0.01), -0.0012, -0.0002, std(0x101012, 0.6), 0, 0);
  // Askı pimleri (gitar yerel): pim başının merkezi (askı ucunun takıldığı yer) ve pimin dışa ekseni (topN, bottomN). Gövde hattının verilen
  // yöndeki en dış noktasında, kalınlığın ortasında, kenarın (bevel dahil) PIN_L ötesinde: üstü boynuz ucunda, altı gövdenin alt ucunda.
  const strapPins = edgePins(body, [-0.97, 0.24], [1, 0], BEV, TOP / 2);
  const pinGeo = new THREE.LatheGeometry([[0.0062, 0], [0.0062, 0.0008], [0.0028, 0.001], [0.0028, PIN_L - 0.0016], [0.0058, PIN_L - 0.0012], [0.0058, PIN_L + 0.0006],
    [0.004, PIN_L + 0.0017], [0, PIN_L + 0.002]].map(([r, h]) => new THREE.Vector2(r, h)), 20);
  [[strapPins.top, strapPins.topN], [strapPins.bottom, strapPins.bottomN]].forEach(([p, n]) => {
    const m = add(pinGeo, chrome, 0, 0, 0); m.position.copy(p).addScaledVector(n, -PIN_L); m.quaternion.setFromUnitVectors(V(0, 1, 0), n); });

  /* ---------- Sap, klavye, kafa ---------- */
  const maple = std(0xb47a3c, 0.55), rosewood = std(0x2a1710, 0.75), gloss = new THREE.MeshPhysicalMaterial({color: 0x0b0b0d, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.05});
  const neck = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), maple);
  neck.scale.set(0.495, 0.05, 0.022); neck.position.set(0.2425, 0, 0.042); guitar.add(neck);
  const FB_END = fretX(24) + 0.0055, fbShape = new THREE.Shape();
  fbShape.moveTo(-0.004, 0.0215); fbShape.lineTo(FB_END, halfFb(FB_END)); fbShape.lineTo(FB_END, -halfFb(FB_END)); fbShape.lineTo(-0.004, -0.0215); fbShape.lineTo(-0.004, 0.0215);
  const fb = new THREE.Mesh(new THREE.ExtrudeGeometry(fbShape, {depth: 0.006, bevelEnabled: false}), rosewood);
  fb.position.z = 0.0505; guitar.add(fb);
  const fretMat = std(0xc9ccd2, 0.25, 0.9), dotMat = std(0xe8e2d2, 0.4);
  for (let n = 1; n <= FRETS; n++){ const x = fretX(n); add(new THREE.CylinderGeometry(0.0011, 0.0011, 2 * halfFb(x), 8), fretMat, x, 0, FB_TOP); }
  const dotGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.001, 16).rotateX(Math.PI / 2), sideDot = new THREE.CylinderGeometry(0.0011, 0.0011, 0.0008, 10);
  [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].forEach(n => { const x = (fretX(n - 1) + fretX(n)) / 2;
    (n % 12 ? [0] : [0.011, -0.011]).forEach(y => add(dotGeo, dotMat, x, y, FB_TOP + 0.0004));
    add(sideDot, dotMat, x, halfFb(x) + 0.0002, FB_TOP - 0.003); });
  // Kilitli eşik: teller eşikte (x = 0) bloğa oturur, üstte üç kıskaç (ikişer tel) altıgen civatalarıyla
  const nut = [box(-0.014, -0.0235, HS_TOP, 0, 0.0235, STR_Z - 0.0006, blackM)];
  const hexZ = new THREE.CylinderGeometry(0.0021, 0.0021, 0.0009, 6).rotateX(Math.PI / 2);
  [0.0144, 0, -0.0144].forEach(y => { nut.push(box(-0.0115, y - 0.0055, STR_Z + 0.0006, -0.0025, y + 0.0055, STR_Z + 0.0046, blackM)); add(hexZ, steel, -0.007, y, STR_Z + 0.005); });

  // Sap kafası: sivri, siyah parlak, logosuz; altı burgu bas kenarda tek sıra (tuşları kenarın dışında)
  const hs = new THREE.Shape();
  hs.moveTo(-0.004, -0.0215);
  hs.bezierCurveTo(-0.040, -0.0235, -0.120, -0.027, -0.219, -0.037);
  hs.bezierCurveTo(-0.205, -0.010, -0.188, 0.022, -0.172, 0.043);
  hs.bezierCurveTo(-0.120, 0.046, -0.060, 0.046, -0.026, 0.044);
  hs.bezierCurveTo(-0.012, 0.042, -0.005, 0.030, -0.004, 0.0215);
  hs.closePath();
  const head = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, {depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 24}), gloss);
  head.position.z = 0.034; guitar.add(head);
  const posts = [], postGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.014, 12).rotateX(Math.PI / 2), bushGeo = new THREE.CylinderGeometry(0.0052, 0.0052, 0.0016, 6).rotateX(Math.PI / 2);
  const shaftGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 0.014, 8);
  for (let s = 0; s < 6; s++){
    const px = -0.032 - s * 0.0255, py = 0.03 - (s < 3 ? 0 : 0.002);
    add(postGeo, chrome, px, py, HS_TOP + 0.007); add(bushGeo, chrome, px, py, HS_TOP + 0.0008);
    box(px - 0.0065, py - 0.006, 0.0215, px + 0.0065, py + 0.012, 0.0315, chrome);
    add(shaftGeo, chrome, px, py + 0.018, 0.0265);
    box(px - 0.0068, py + 0.0245, 0.0215, px + 0.0068, py + 0.029, 0.0315, chrome);
    posts.push(new THREE.Vector3(px, py, HS_TOP + 0.011));
  }

  /* ---------- Sap kafasındaki kamera ---------- */
  const camRig = new THREE.Group();
  camRig.position.set(-0.165, -0.002, HS_TOP); camRig.rotation.z = -0.05;
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.006), new THREE.MeshStandardMaterial({color: 0x222326, roughness: 0.6}));
  clamp.position.z = 0.003; camRig.add(clamp);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.028, 10), new THREE.MeshStandardMaterial({color: 0x2c2d31}));
  arm.rotation.x = Math.PI / 2; arm.position.z = 0.02; camRig.add(arm);
  const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.044, 0.03), new THREE.MeshStandardMaterial({color: 0x101113, roughness: 0.35}));
  camBody.position.z = 0.045; camRig.add(camBody);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.008, 24), new THREE.MeshStandardMaterial({color: 0x050505, metalness: 0.5, roughness: 0.1}));
  lens.rotation.z = Math.PI / 2; lens.position.set(0.019, 0, 0.047); camRig.add(lens);
  const recLed = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 10, 10), new THREE.MeshBasicMaterial({color: 0x441111}));
  recLed.position.set(0.012, 0.016, 0.0605); camRig.add(recLed);
  guitar.add(camRig);

  /* ---------- Teller ---------- */
  // Kalibre (çap, m; 10-46 takım): kalın üçü nikel sarımlı (sarım deseni, daha pürüzlü), ince üçü düz çelik. Her tel burgudan eşiğe, eşikten
  // köprüye tek bir şerit: şerit kameraya döner, üstü silindir normaliyle gölgelenir (tüp taklidi). Genişliği kalınlık + titreşim + 1 piksel;
  // kaplama piksel başına analitik hesaplanır: kenarlar kenar yumuşatmasız çizimde de basamaklanmaz, titreşen tel saydam bir iğe yayılır.
  // İnce tel ekranda 1.2 pikselden ince çizilmez; o zaman parlaklığı (gerçek/çizilen)^0.3 kadar kısılır (uzak çekimde kaybolmaz, kalından ayrılır).
  const GAUGE = [0.00117, 0.00091, 0.00066, 0.00043, 0.00033, 0.000254];
  const AMP = [0.0012, 0.0011, 0.001, 0.0009, 0.0008, 0.0007];   // vuruşta konuşan boyun ortasındaki titreşim yarı genliği (m), v = 1
  // Nokta düzeni: burgu, eşik, eşikten basma noktasına NB parça, perde teli, perdeden köprüye NS parça (boş telde eşikten köprüye eşit aralık)
  const NB = 6, NS = 36, NP = NB + NS + 3, CROWN = FB_TOP + 0.0011, DIP = 0.0005;   // perde telinin tepesi; parmak altında tel DIP kadar iner
  const sm = u => u * u * (3 - 2 * u);
  const SU = {uH: {value: 720}, uMinPx: {value: 1.2}};   // çizilen tamponun yüksekliği (px, her çizimde), en ince çizim (px)
  const VERT = `attribute float aSide;
attribute float aA;
attribute float aR;
attribute float aU;
attribute vec3 aTan;
uniform float uH, uMinPx;
varying vec3 vSV;
varying float vX, vR, vRt, vA, vPx, vU;`;
  // Şerit kenarı: tel eksenine ve bakışa dik; px bu derinlikte bir pikselin metresi
  const VERT_MAIN = `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
vec3 tv = normalize((modelViewMatrix * vec4(aTan, 0.0)).xyz), sv = cross(tv, normalize(-mvPosition.xyz));
float sl = length(sv); sv = sl > 1e-6 ? sv / sl : normalize(cross(tv, vec3(0.0, 1.0, 0.0)) + vec3(0.0, 0.0, 1e-3));
float px = 2.0 * max(-mvPosition.z, 1e-4) / (projectionMatrix[1][1] * uH), r = max(aR, 0.5 * uMinPx * px);
vec4 c0 = projectionMatrix * mvPosition, c1 = projectionMatrix * vec4(mvPosition.xyz + sv * px, 1.0);
vec2 sd = c1.xy / c1.w - c0.xy / c0.w; sd = length(sd) > 1e-9 ? normalize(sd * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0)) : vec2(0.0, 1.0);
vSV = sv; vX = aSide * (r + aA + px); vR = r; vRt = aR; vA = aA; vPx = px * (abs(sd.x) + abs(sd.y)); vU = aU;   // kare pikselin tele dik genişliği
mvPosition.xyz += sv * vX;
gl_Position = projectionMatrix * mvPosition;`;
  // Kaplama: merkezi A·sin(ωt) ile gidip gelen r yarıçaplı telin, p genişliğinde piksel kutusunda zaman ortalaması (arksinüs dağılımı);
  // gAs(u) = ∫0..u asin(clamp(s)) ds. A → 0 iken düz telin kutu süzgeçli kenarı.
  const FRAG = `uniform float uWind, uPitch, uEnv;
varying vec3 vSV;
varying float vX, vR, vRt, vA, vPx, vU;
float gAs(float u){ float a = min(abs(u), 1e4), b = min(a, 1.0); return a < 1.0 ? b * asin(b) + sqrt(max(0.0, 1.0 - b * b)) - 1.0 : PI_HALF * a - 1.0; }
float strCov(float x, float r, float A, float p){ A = max(A, 1e-6); float h = 0.5 * p;
  return A / (PI * p) * (gAs((x + h + r) / A) - gAs((x - h + r) / A) - gAs((x + h - r) / A) + gAs((x - h - r) / A)); }`;
  const FRAG_COV = `diffuseColor.a *= clamp(strCov(vX, vR, vA, max(vPx, 1e-7)), 0.0, 1.0) * pow(vRt / vR, 0.3);
if (diffuseColor.a < 0.002) discard;
float wk = uWind * clamp(1.0 - 2.0 * fwidth(vU) / uPitch, 0.0, 1.0) * vR / (vR + vA);   // sarım deseni yalnız çözülebildiği yakınlıkta
diffuseColor.rgb *= 1.0 - 0.3 * wk * (0.5 + 0.5 * cos(6.2832 * vU / uPitch));`;
  const FRAG_NORMAL = `float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
float sAc = clamp(vX / (vR + vA), -1.0, 1.0) * (vR + 0.5 * vA) / (vR + vA);   // titreşen tel iğde bakışa yakın gölgelenir (silindirin ortalaması)
vec3 normal = normalize(vSV * sAc + normalize(vViewPosition) * sqrt(max(0.0, 1.0 - sAc * sAc)));   // D3D bölmesi yaklaşık: x/x > 1 → NaN, bloom karartır
vec3 geometryNormal = normal;`;
  // Ortam haritası yok: metal tel yalnız ışık parlamasıyla görünürdü; yansıyan yönde yarıküre ışığının gök/yer rengi ortam yansıması sayılır
  const FRAG_ENV = `#if NUM_HEMI_LIGHTS > 0
{ vec3 rv = reflect(-geometry.viewDir, geometry.normal);
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) radiance += uEnv * mix(hemisphereLights[i].groundColor, hemisphereLights[i].skyColor, 0.5 * dot(rv, hemisphereLights[i].direction) + 0.5); }
#endif`;
  function strMat(color, roughness, wind){
    const U = {uWind: {value: wind}, uPitch: {value: 0.0003}, uEnv: {value: 2.5}};
    const m = new THREE.MeshStandardMaterial({color, metalness: 0.8, roughness, transparent: true, depthWrite: false, side: THREE.DoubleSide});
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, SU, U);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\n" + VERT).replace("#include <project_vertex>", VERT_MAIN);
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + FRAG).replace("#include <color_fragment>", "#include <color_fragment>\n" + FRAG_COV)
        .replace("#include <normal_fragment_begin>", FRAG_NORMAL).replace("#include <lights_fragment_maps>", "#include <lights_fragment_maps>\n" + FRAG_ENV);
    };
    return m;
  }
  const wound = strMat(0xc9c1ae, 0.38, 1), plain = strMat(0xe6e9ec, 0.22, 0), V2 = new THREE.Vector2();
  const onDraw = r => { const t = r.getRenderTarget(); SU.uH.value = t ? t.height : r.getDrawingBufferSize(V2).y; };
  const strings = [];
  for (let s = 0; s < 6; s++){
    const n = NP * 2, geo = new THREE.BufferGeometry();
    const at = (name, k) => { const a = new THREE.BufferAttribute(new Float32Array(n * k), k); geo.setAttribute(name, a); return a.array; };
    const Nn = at("normal", 3), S = at("aSide", 1), R = at("aR", 1);
    at("position", 3); at("aTan", 3); at("aA", 1); at("aU", 1);
    for (const k of ["position", "aTan", "aA", "aU"]) geo.attributes[k].setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++){ Nn[i * 3 + 2] = 1; S[i] = i & 1 ? 1 : -1; R[i] = GAUGE[s] / 2; }
    const idx = []; for (let i = 0; i < NP - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    geo.setIndex(idx);
    const mat = s < 3 ? wound : plain, mesh = new THREE.Mesh(geo, mat), pts = new Float32Array(NP * 3);
    mesh.frustumCulled = false; mesh.onBeforeRender = onDraw; guitar.add(mesh);
    // pts: telin ekseni (burgu, sonra eşikten köprüye); pos aynı dizinin eşik→köprü kısmı (x artan). amp, note: o karedeki titreşim ve nota (ölçüm)
    strings.push({mesh, mat, base: mat.color, pts, pos: pts.subarray(3), amp: 0, note: null});
  }
  // Teli yerleştirir: f basılan perde (0 boş tel), d basma noktasında yana itme (m, gitar y'si; bend.js bendDisplacement · bendShape ile tel boyunca),
  // A titreşimin konuşan boyun ortasındaki yarı genliği (m), fv titreşen notanın perdesi (iğ o notanın konuşan boyunda, perdeden köprüye)
  function layoutString(s, f, d, A, fv){
    const st = strings[s], g = st.mesh.geometry, q = st.pts, P = g.attributes.position.array, T = g.attributes.aTan.array, W = g.attributes.aA.array, U = g.attributes.aU.array;
    const xp = f > 0 ? pressX(f) : 0, xf = f > 0 ? fretX(f) : 0, zc = CROWN + GAUGE[s] / 2, zp = STR_Z - DIP, xv = fv > 0 ? fretX(fv) : 0;
    q[0] = posts[s].x; q[1] = posts[s].y; q[2] = posts[s].z;
    for (let i = 1; i < NP; i++){
      const x = f > 0 ? (i <= NB + 1 ? xp * (i - 1) / NB : xf + (L - xf) * (i - NB - 2) / NS) : L * (i - 1) / (NP - 2);
      // Basılı tel: eşikten parmağa hafif iner, perde telinin tepesine değer, oradan köprüye düz çıkar
      q[i * 3] = x; q[i * 3 + 1] = stringY(s, x) + (d ? d * bendShape(xp, x) : 0);
      q[i * 3 + 2] = f <= 0 ? STR_Z : x <= xp ? STR_Z - DIP * x / xp : x <= xf ? zp + (zc - zp) * (x - xp) / (xf - xp) : zc + (STR_Z - zc) * (x - xf) / (L - xf);
    }
    for (let i = 0; i < NP; i++){
      const a = Math.max(0, i - 1) * 3, b = Math.min(NP - 1, i + 1) * 3, x = q[i * 3], tx = q[b] - q[a], ty = q[b + 1] - q[a + 1], tz = q[b + 2] - q[a + 2], l = Math.hypot(tx, ty, tz) || 1;
      const w = A > 0 && i > 0 && x > xv && x < L ? A * Math.sin(Math.PI * (x - xv) / (L - xv)) : 0;
      for (let j = 2 * i; j < 2 * i + 2; j++){ P[j * 3] = x; P[j * 3 + 1] = q[i * 3 + 1]; P[j * 3 + 2] = q[i * 3 + 2]; T[j * 3] = tx / l; T[j * 3 + 1] = ty / l; T[j * 3 + 2] = tz / l; W[j] = w; U[j] = x; }
    }
    for (const k of ["position", "aTan", "aA", "aU"]) g.attributes[k].needsUpdate = true;
  }
  // Çizilen telin x'teki ekseni (gitar çerçevesi) → {y, z}: ölçüm (tools/sync-check.mjs) ve parmak ucunu tele oturtmak için
  function stringAt(s, x){
    const q = strings[s].pts; let i = 1; while (i < NP - 2 && q[(i + 1) * 3] < x) i++;
    const a = i * 3, b = a + 3, u = q[b] > q[a] ? Math.min(1, Math.max(0, (x - q[a]) / (q[b] - q[a]))) : 0;
    return {y: q[a + 1] + (q[b + 1] - q[a + 1]) * u, z: q[a + 2] + (q[b + 2] - q[a + 2]) * u};
  }
  // Titreşimin konuşan boyun ortasındaki yarı genliği (m), sesin zaman çizgisinde: tel modelinin temel harmonik sönümü (audio/guitar.js ksBuffer:
  // tur başına d; palm mute'ta 0.9), nota bitince sesin bırakma zaman sabiti (playback.js: 0.12 sn, palm mute 0.04)
  function ring(e, now){
    const d = e.m ? 0.9 : 0.9988 - (e.midi - 40) * 0.000055, lam = Math.max(-mtof(e.midi) * Math.log(d), e.pm ? 6 : 0);
    return AMP[e.s] * (e.v ?? (e.h ? 0.85 : 1)) * (e.pm ? 0.5 : 1) * Math.exp(-lam * (now - e.t)) * (now > e.end ? Math.exp(-(now - e.end) / (e.m ? 0.04 : 0.12)) : 1);
  }
  // Vuruşta 15 ms'de açılır; legato (penasız) notada 60 ms'de, önceki notanın titreşimini devralarak
  function vibAmp(e, p, now){
    const k = sm(Math.min(1, (now - e.t) / (e.h ? 0.06 : 0.015))), a = ring(e, now) * k;
    return e.h && p ? a + ring(p, e.t) * (1 - k) : a;
  }
  // Her kare, yalnız (now, olaylar)'dan: telin notası c (son başlayan), ondan önceki p, ön bükmesi başlamış olabilecek sonraki n.
  // Telin şekli (basılı perde, bükme) sahibinden: ön bükmedeki n, yoksa bitişinden REL sonrasına kadar c. İğ c'den; aynı telde yeni nota eskisini keser.
  // Ön bükme aynı teldeki önceki nota bitmeden başlamaz (o zaman kısa sürede, gerekirse vuruşta birden itilir). calm: azaltılmış hareket.
  function updateStrings(now, events, calm){
    const cur = [], prv = [], nxt = [];
    if (events) for (const e of events){
      if (e.t <= now){ prv[e.s] = cur[e.s]; cur[e.s] = e; }
      else if (e.t - PRE_IN <= now){ if (!nxt[e.s]) nxt[e.s] = e; }
      else break;
    }
    for (let s = 0; s < 6; s++){
      const c = cur[s], n = nxt[s], st = strings[s];
      const pt = n && n.pre && n.f > 0 ? Math.max(n.t - PRE_IN, c ? c.end : -Infinity) : Infinity;
      let f = 0, d = 0;
      if (now >= pt){ f = n.f; d = pt === n.t - PRE_IN ? bendDisplacement(n, now) : bendDisplacement(n, n.t) * sm(Math.min(1, (now - pt) / Math.max(1e-3, n.t - 0.03 - pt))); }
      else if (c && c.f > 0 && now < c.end + REL){ f = c.f; d = bendDisplacement(c, now); }
      st.amp = c ? vibAmp(c, prv[s], now) * (calm ? 0.35 : 1) : 0; st.note = c || null;
      layoutString(s, f, d, st.amp, c ? c.f : 0);
    }
  }
  updateStrings(0, null, false);

  const pickShape = new THREE.Shape();
  pickShape.moveTo(0, -0.012); pickShape.quadraticCurveTo(0.012, -0.004, 0.01, 0.008); pickShape.quadraticCurveTo(0, 0.014, -0.01, 0.008); pickShape.quadraticCurveTo(-0.012, -0.004, 0, -0.012);
  const pick = new THREE.Mesh(new THREE.ExtrudeGeometry(pickShape, {depth: 0.0012, bevelEnabled: false}), new THREE.MeshStandardMaterial({color: 0xe25b2a, roughness: 0.4}));
  // Pena dik durur: ucu (şeklin (0, -0.012) köşesi) tellere (-z) bakar, yüzü vuruş yönünde (±y). Yerini her karede claude.js pickAt verir.
  pick.rotation.x = Math.PI / 2; pick.position.set(0.575, 0, STR_Z + 0.016 + 0.012); guitar.add(pick);

  /* ---------- Gövde üstü donanım ---------- */
  // hardware: el/kol ölçümünün katıları (solids.hardware). Kutu ya da prizma kendisi; başka biçimler (yatık civata) için görünmez sınır kutusu.
  const hardware = [...nut];
  const proxy = m => { m.updateMatrix(); m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrix), s = b.getSize(V()), c = b.getCenter(V());
    const p = new THREE.Mesh(new THREE.BoxGeometry(s.x, s.y, s.z), chrome); p.position.copy(c); p.visible = false; m.parent.add(p); hardware.push(p); };
  // Manyetikler HSH: siyah çerçeve, krem kapaklar (gövdenin boya dokusunu paylaşır: sıçrama üstlerine de düşer), krom vida kutupları
  const cover = std(0xf0ebe0, 0.45, 0, top), ringM = std(0x121214, 0.55), poleGeo = new THREE.CylinderGeometry(0.0021, 0.0021, 0.0016, 12).rotateX(Math.PI / 2);
  [[0.515, 1], [0.5605, 0], [0.607, 1]].forEach(([x, hum]) => {
    hardware.push(prism(roundRect(-(hum ? 0.023 : 0.0125), -(hum ? 0.044 : 0.0425), hum ? 0.023 : 0.0125, hum ? 0.044 : 0.0425, 0.005), TOP, TOP + 0.0035, ringM, x, 0));
    (hum ? [x - 0.0095, x + 0.0095] : [x]).forEach(bx => {
      const c = box(bx - 0.0087, -0.0345, TOP + 0.002, bx + 0.0087, 0.0345, TOP + 0.009, cover); paintUV(c.geometry, bx, 0); hardware.push(c);
      for (let s = 0; s < 6; s++) add(poleGeo, chrome, bx, stringY(s, bx), TOP + 0.0092);
    });
  });
  // Ses ve ton düğmesi (beyaz, boya dokusuyla), beşli seçici
  const knobM = std(0xf3f0ea, 0.35, 0, top);
  [[0.700, -0.093], [0.738, -0.114]].forEach(([x, y]) => { const k = prism(disc(0.0105), TOP, TOP + 0.016, knobM, x, y, guitar, 0.0015); paintUV(k.geometry, x, y);
    box(x - 0.0006, y + 0.003, TOP + 0.016, x + 0.0006, y + 0.0095, TOP + 0.0163, blackM); });
  const sel = new THREE.Group(); sel.position.set(0.668, -0.122, TOP); sel.rotation.z = -0.55; guitar.add(sel);
  box(-0.013, -0.0035, 0, 0.013, 0.0035, 0.0007, ringM, sel); box(-0.0012, -0.0012, 0, 0.0012, 0.0012, 0.008, chrome, sel); box(-0.003, -0.0048, 0.0062, 0.003, 0.0048, 0.0125, ivory, sel);

  // Kilitli tremolo (Floyd tipi), çukurda yüzer: taban plakası, bıçak kenarları dikmelerde, altı eyer (tel teması x = L, arkada tel kıskacı ve
  // civatası), arkada ince akort vidaları, tiz yanda kol yuvası. bridge grubu dinlenmede birim dönüşüm (ölçüm katıları gitar yerelinde kalır).
  const bridge = new THREE.Group(); guitar.add(bridge);
  const PZ = TOP + 0.0045, hexX = new THREE.CylinderGeometry(0.0026, 0.0026, 0.006, 6).rotateZ(Math.PI / 2);
  hardware.push(box(L - 0.012, -0.036, TOP + 0.001, L + 0.066, 0.036, PZ, satin, bridge), box(L - 0.012, -0.0405, TOP + 0.001, L - 0.003, 0.0405, PZ, satin, bridge),
    box(L + 0.036, -0.0505, TOP + 0.001, L + 0.052, -0.036, PZ, satin, bridge), box(L + 0.046, -0.034, PZ, L + 0.066, 0.034, TOP + 0.0075, satin, bridge),
    prism(disc(0.0055), TOP + 0.001, TOP + 0.0065, chrome, L + 0.044, -0.048, bridge));
  [-0.0373, 0.0373].forEach(y => hardware.push(prism(disc(0.004), TOP, TOP + 0.0062, chrome, L - 0.009, y)));
  const knurl = new THREE.Shape(Array.from({length: 40}, (_, i) => { const a = i / 40 * TAU, r = i & 1 ? 0.0041 : 0.0045; return new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)); }));
  for (let s = 0; s < 6; s++){
    const y = stringY(s, L), w = 0.0048;
    hardware.push(box(L - 0.002, y - w, PZ, L + 0.005, y + w, Math.min(0.059, STR_Z - GAUGE[s] / 2), chrome, bridge), box(L + 0.005, y - w, PZ, L + 0.017, y + w, 0.056, chrome, bridge),
      box(L + 0.008, y - 0.003, 0.056, L + 0.014, y + 0.003, 0.0572, steel, bridge), prism(knurl, TOP + 0.0075, 0.0585, chrome, L + 0.058, 1.05 * y, bridge));
    proxy(add(hexX, chrome, L + 0.020, y, 0.0525, bridge));
  }
  // Kol: krom, yuvadan dik çıkar, 8 mm yarıçapla döner, 5.7° yükselerek uzanır, beyaz uçlu. Dinlenme yönü yaw −25° (0 = +x kuyruk, eksi = tiz yanın dışı).
  const armG = new THREE.Group(); armG.position.set(L + 0.044, -0.048, TOP + 0.0065); bridge.add(armG);
  const armCurve = Object.assign(new THREE.Curve(), {getPoint: (t, o = V()) => armAt(-0.004 + t * (ARM_LEN + 0.004), o)});
  armG.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 48, 0.003, 10, false), chrome));
  const tip = new THREE.Mesh(new THREE.LatheGeometry([[0.0031, -0.002], [0.0045, 0.0015], [0.0045, 0.0235], [0.0036, 0.0268], [0.0016, 0.028], [0, 0.0282]].map(([r, h]) => new THREE.Vector2(r, h)), 16), ivory);
  tip.position.copy(armAt(ARM_LEN)); tip.quaternion.setFromUnitVectors(V(0, 1, 0), V(Math.cos(TIP_RISE), 0, Math.sin(TIP_RISE))); armG.add(tip);
  // Tremolo: pivot köprünün bıçak ekseninin ortası (eksen gitar y), socket kol yuvasının gövde üstündeki noktası (eksen gitar z); gitar yerel.
  // setArm(a), a = {yaw: yuva ekseni çevresinde dinlenme yönünden açı (rad), dive: dalış (rad, +: plakanın arkası kalkar, eyerler sapa doğru gider,
  // tel gevşer; sapa dönük kolun ucu gövdeye iner)}: yalnız a'dan kurar (zamanın saf fonksiyonu, durum biriktirmez). Ses tarafı (bend.js) bağlanana
  // kadar dive 0 kalır. armPts(): kolun ekseni [{p: gitar yerel, r: yarıçap}] (ölçüm, sync-check), yuva ağzından uca.
  const pivot = V(L - 0.009, 0, TOP), YAW0 = -25 * Math.PI / 180, MA = new THREE.Matrix4();
  function setArm(a = {}){
    bridge.rotation.y = -(a.dive || 0); bridge.position.copy(pivot).sub(pivot.clone().applyEuler(bridge.rotation)); armG.rotation.z = YAW0 + (a.yaw || 0);
    bridge.updateMatrix(); armG.updateMatrix();
  }
  function armPts(){
    MA.multiplyMatrices(bridge.matrix, armG.matrix); const A = ARM, e = A.up + A.R * (Math.PI / 2 - A.rise);
    const P = [0, A.up, A.up + (e - A.up) / 2, e, e + A.len / 2, ARM_LEN].map(u => ({p: armAt(u).applyMatrix4(MA), r: 0.003})), t = armAt(ARM_LEN);
    return P.concat([0, 0.0235].map(h => ({p: t.clone().add(V(Math.cos(TIP_RISE) * h, 0, Math.sin(TIP_RISE) * h)).applyMatrix4(MA), r: 0.0045})));
  }
  setArm();
  const tremolo = {pivot, socket: V(L + 0.044, -0.048, TOP), arm: armG, setArm, armPts};

  batch(guitar, new Set(hardware));
  rig.updateMatrixWorld(true);   // gitar sabit: ilk karede de localToWorld doğru dünya konumunu versin
  // solids: el/kol çarpışma ölçümünün katıları (tools/sync-check.mjs): gitarın doğrudan çocukları (hardware'de birim dönüşümlü köprü grubu da),
  // döndürülmemiş; BoxGeometry kutu, ExtrudeGeometry şeklinin xy dış hattı ve z kalınlığıyla prizma sayılır (bevel dış hattı genişletir).
  // body: gövde (çukur deliği ölçümde dolu sayılır); hardware: köprü, eyerler, kıskaçlar, ince akort vidaları, manyetikler, eşik.
  // Teller: stringAt(s, x) çizilen eksen; strings[s].pos aynı eksen (x artan).
  return { rig, guitar, strings, updateStrings, stringAt, GAUGE, pick, recLed, camRig, HS_TOP, TOP, FB_TOP, solids: {body: bodyMesh, neck, fretboard: fb, hardware}, strapPins, tremolo };
}

// Küçük parçalar tek çizimde: aynı ebeveyn ve malzemedeki işaretli ağlar birleşir; ölçüm katısı olanlar (keep) aynı geometriyle görünmez kalır
function batch(root, keep){
  const G = new Map();
  root.traverse(o => { if (!o.isMesh || !o.userData.batch) return; const k = G.get(o.parent) || G.set(o.parent, new Map()).get(o.parent); (k.get(o.material) || k.set(o.material, []).get(o.material)).push(o); });
  for (const [par, k] of G) for (const [mat, ms] of k){
    const gs = ms.map(m => { m.updateMatrix(); return (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix); }), out = new THREE.BufferGeometry();
    for (const [a, n] of [["position", 3], ["normal", 3], ["uv", 2]]){ const A = new Float32Array(gs.reduce((t, g) => t + g.attributes.position.count, 0) * n); let o = 0;
      for (const g of gs){ A.set(g.attributes[a].array, o); o += g.attributes.position.count * n; } out.setAttribute(a, new THREE.BufferAttribute(A, n)); }
    par.add(new THREE.Mesh(out, mat));
    ms.forEach(m => { if (keep.has(m)) m.visible = false; else par.remove(m); });
  }
}

/* ---------- Kol ekseni ---------- */
// Kol grubunun yerelinde (yuva ağzı başlangıç, +x kolun yönü, +z yukarı): u eksen boyunca uzunluk (m; eksi: yuvanın içinde)
const ARM = {up: 0.008, R: 0.008, rise: 0.1, len: 0.1}, TIP_RISE = 0.244, ARM_LEN = ARM.up + ARM.R * (Math.PI / 2 - ARM.rise) + ARM.len;
function armAt(u, o = new THREE.Vector3()){
  const {up, R, rise, len} = ARM, A = Math.PI / 2 - rise;
  if (u <= up) return o.set(0, 0, u);
  if (u <= up + R * A){ const f = (u - up) / R; return o.set(R - R * Math.cos(f), 0, up + R * Math.sin(f)); }
  const e = Math.min(u - up - R * A, len); return o.set(R - R * Math.cos(A) + e * Math.cos(rise), 0, up + R * Math.sin(A) + e * Math.sin(rise));
}

/* ---------- Gövde hattı ---------- */
// Tur 4 tasarımı (bevel öncesi, 4 mm bevel varsayımıyla): üst boynuz ucu 12. perde hizasında ve göğsün önünde alçak, alt boynuz derin oyuk (24. perde)
function superstrat(){
  const s = new THREE.Shape(); s.moveTo(0.445, 0.0285);
  [[0.405, 0.0285, 0.345, 0.047, 0.322, 0.071], [0.332, 0.077, 0.372, 0.076, 0.405, 0.079], [0.430, 0.082, 0.445, 0.098, 0.470, 0.112],
    [0.510, 0.124, 0.585, 0.122, 0.640, 0.140], [0.700, 0.158, 0.790, 0.162, 0.832, 0.118], [0.868, 0.076, 0.866, -0.050, 0.836, -0.095],
    [0.800, -0.150, 0.720, -0.158, 0.650, -0.148], [0.590, -0.138, 0.535, -0.140, 0.492, -0.136], [0.462, -0.133, 0.444, -0.126, 0.440, -0.110],
    [0.446, -0.080, 0.466, -0.048, 0.478, -0.0285]].forEach(c => s.bezierCurveTo(...c));
  s.closePath(); return s;
}
// Kapalı hattı d kadar içe kaydırır: 1 mm aralıklı örnek, sivri köşede kendini kesen noktalar (hatta d'den yakın) atılır; ~3 mm aralıklı noktalar
function inset(shape, d){
  const P = shape.getSpacedPoints(1500).slice(0, -1), N = P.length, sg = Math.sign(THREE.ShapeUtils.area(P)), Q = [];
  for (let i = 0; i < N; i++){ const a = P[(i + N - 1) % N], b = P[(i + 1) % N], tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty);
    const q = new THREE.Vector2(P[i].x - sg * ty / l * d, P[i].y + sg * tx / l * d);
    if (P.every(p => p.distanceToSquared(q) > d * d * 0.97)) Q.push(q); }
  return Q.filter((q, i) => i % 3 === 0);
}
// Dış hat boyunca yay uzunluğu (kenar dokusunun u'su): at(s) → [x, y, dışa nx, ny]; near(x, y, i) → en yakın hat noktası {s, d, i}
function edgeTable(Q){
  const N = Q.length, sg = Math.sign(THREE.ShapeUtils.area(Q)), S = [0], Nr = [];
  for (let i = 1; i <= N; i++) S.push(S[i - 1] + Q[i % N].distanceTo(Q[i - 1]));
  for (let i = 0; i < N; i++){ const a = Q[(i + N - 1) % N], b = Q[(i + 1) % N], l = a.distanceTo(b); Nr.push([sg * (b.y - a.y) / l, -sg * (b.x - a.x) / l]); }
  const P = S[N];
  function at(s){
    s = ((s % P) + P) % P; let lo = 0, hi = N; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const j = (lo + 1) % N, u = (s - S[lo]) / (S[lo + 1] - S[lo]), nx = Nr[lo][0] + (Nr[j][0] - Nr[lo][0]) * u, ny = Nr[lo][1] + (Nr[j][1] - Nr[lo][1]) * u, nl = Math.hypot(nx, ny);
    return [Q[lo].x + (Q[j].x - Q[lo].x) * u, Q[lo].y + (Q[j].y - Q[lo].y) * u, nx / nl, ny / nl];
  }
  function seg(i, x, y){ const a = Q[i], b = Q[(i + 1) % N], ex = b.x - a.x, ey = b.y - a.y, l = ex * ex + ey * ey, u = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / l));
    return {s: S[i] + u * Math.sqrt(l), d: Math.hypot(x - a.x - u * ex, y - a.y - u * ey), i}; }
  function near(x, y, h = 0){
    let b = null; for (let k = -12; k <= 12; k++){ const r = seg(((h + k) % N + N) % N, x, y); if (!b || r.d < b.d) b = r; }
    if (b.d > 2.2 * BEV) for (let i = 0; i < N; i++){ const r = seg(i, x, y); if (r.d < b.d) b = r; }
    return b;
  }
  return {Q, P, at, near};
}
// Kenar UV'leri (hole(x, y): çukurun duvarı): u = hat boyunca yay / çevre, v = kapaktan aşağı kenar profilinin boyu / VMAX (tuvalin üstü kapak kenarı); kapak UV'si gitar x,y (m)
function sideUVs(E, hole){
  let h = 0;
  const one = (V, i) => { const x = V[i * 3], y = V[i * 3 + 1], z = V[i * 3 + 2];
    if (hole(x, y)) return [0.5, 1.5 / SH];   // çukurun duvarı: kenar dokusunun boyasız alt satırı
    const r = E.near(x, y, h); h = r.i;
    const p = z >= DEPTH ? RQ * Math.atan2(r.d, z - DEPTH) / (Math.PI / 2) : z >= 0 ? RQ + DEPTH - z : RQ + DEPTH + RQ * Math.atan2(-z, r.d) / (Math.PI / 2);
    return [r.s / E.P, 1 - p / VMAX]; };
  return {
    generateTopUV: (g, V, a, b, c) => [a, b, c].map(i => new THREE.Vector2(V[i * 3], V[i * 3 + 1])),
    generateSideWallUV(g, V, a, b, c, d){
      const q = [a, b, c, d].map(i => one(V, i)), u = q.map(x => x[0]);
      if (Math.max(...u) - Math.min(...u) > 0.5) q.forEach(x => { if (x[0] < 0.5) x[0] += 1; });   // hattın başlangıcını (sap cebinin altı) geçen dörtgen
      return q.map(([x, y]) => new THREE.Vector2(x, y));
    }
  };
}
// Prizmanın kenar normalleri: aynı noktayı paylaşan yan yüzlerin normalleri ortalanır (60°'den keskin kırık korunur); cap: yuvarlak kenarlı
// prizmada kapağa değen halka kapağın normalini alır
function smoothSides(geo, cap = true){
  const G = geo.groups.find(g => g.materialIndex === 1), P = geo.attributes.position.array, N = geo.attributes.normal.array, M = new Map(), out = N.slice();
  let z0 = Infinity, z1 = -Infinity; for (let i = 2; i < P.length; i += 3){ z0 = Math.min(z0, P[i]); z1 = Math.max(z1, P[i]); }
  const key = i => ((Math.round(P[i * 3] * 1e5) + 131072) * 262144 + Math.round(P[i * 3 + 1] * 1e5) + 131072) * 8192 + Math.round(P[i * 3 + 2] * 1e5) + 1024;   // 0.01 mm ızgara
  for (let i = G.start; i < G.start + G.count; i++){ const k = key(i), a = M.get(k); if (a) a.push(i); else M.set(k, [i]); }
  for (const A of M.values()) for (const i of A){
    let x = 0, y = 0, z = 0; const pz = P[i * 3 + 2];
    for (const j of A) if (N[i * 3] * N[j * 3] + N[i * 3 + 1] * N[j * 3 + 1] + N[i * 3 + 2] * N[j * 3 + 2] > 0.5){ x += N[j * 3]; y += N[j * 3 + 1]; z += N[j * 3 + 2]; }
    if (cap && pz > z1 - 1e-7){ x = 0; y = 0; z = 1; } else if (cap && pz < z0 + 1e-7){ x = 0; y = 0; z = -1; }
    const l = Math.hypot(x, y, z) || 1; out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
  }
  N.set(out);
}
// Kapaklar düz (üçgenlemenin sıfır alanlı üçgeni sıfır normal bırakıyordu); arka kapak boyasız: kapak dokusunun gövde dışındaki temiz köşesi
function cleanBack(geo){
  const G = geo.groups.find(g => g.materialIndex === 0), P = geo.attributes.position.array, U = geo.attributes.uv.array, N = geo.attributes.normal.array;
  for (let i = G.start; i < G.start + G.count; i++){ const b = P[i * 3 + 2] < 0; N[i * 3] = N[i * 3 + 1] = 0; N[i * 3 + 2] = b ? -1 : 1; if (b){ U[i * 2] = PT.x0 + 0.004; U[i * 2 + 1] = PT.y0 + 0.004; } }
}
const roundRect = (x0, y0, x1, y1, r, T = THREE.Shape) => { const s = new T(); s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false); s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false); return s; };
const disc = r => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, TAU, false); return s; };
// Doku koordinatı gitar yerel x,y (m): manyetik kapakları ve düğmeler gövdenin boya dokusunu paylaşır
function paintUV(geo, ox, oy){ const P = geo.attributes.position, uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++){ uv[i * 2] = ox + P.getX(i); uv[i * 2 + 1] = oy + P.getY(i); } geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); }
const inside = (Q, x, y) => { let c = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++){ const a = Q[i], b = Q[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };

/* ---------- Kan sıçraması boyası ---------- */
// Desen yalnız hash01 ile (rand() yok): her çalıştırmada aynı. Kapak tuvali gitar yerel x,y'yi (m) gövdenin biraz dışına kadar kaplar; kenar dokusu
// oradan örneklenir (kenarı saran boya), altına duvardan akan damlalar eklenir. Yerçekimi +x: asılı gitarda kuyruk aşağıda, akıntılar kuyruğa iner.
const PT = {x0: 0.29, x1: 0.89, y0: -0.1875, y1: 0.1875, w: 2048, h: 1280}, PS = PT.w / (PT.x1 - PT.x0), SW = 4096, SH = 160;   // PS: piksel / m; SW × SH kenar dokusu
const INK = {base: "#e3e6ea", blood: "#5c0318", red: "#8a0624", bright: "#ad0f2f", pink: "#c62c55"};
// [x, y, yarıçap (m), akıntı]: büyük lekeler alt bombede ve tiz yanda, ikisi manyetiklerin üstünde, kenara yakın olanlar kenardan taşar
const SPLATS = [[0.785, 0.045, 0.042, 3], [0.585, -0.105, 0.034, 2], [0.405, 0.058, 0.02, 2], [0.548, 0.028, 0.016, 1], [0.70, 0.125, 0.028, 2],
  [0.47, -0.095, 0.012, 1], [0.835, -0.07, 0.014, 1], [0.66, -0.133, 0.011, 0], [0.50, 0.095, 0.008, 0], [0.745, -0.045, 0.009, 1], [0.625, 0.078, 0.007, 0], [0.36, 0.07, 0.007, 0]];
// Savrulma izleri [merkez x, y, yarıçap (m), başlangıç ve bitiş açısı (rad), damla]: bas kenardan manyetiklere ve alt bombeden tiz kenara inen iki yay
const CASTS = [[0.66, 0.02, 0.15, 2.2, 3.5, 22], [0.92, 0.05, 0.2, 3.3, 4.1, 16]];
const canvas = (w, h) => Object.assign(document.createElement("canvas"), {width: w, height: h});
function canvasTex(c){ const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
function paintTop(Q){
  const c = canvas(PT.w, PT.h), g = c.getContext("2d");
  g.fillStyle = INK.base; g.fillRect(0, 0, PT.w, PT.h);
  SPLATS.forEach(([x, y, r, d], k) => splat(g, k, x, y, r, d));
  CASTS.forEach((c, k) => castOff(g, k, ...c));
  for (let i = 0, k = SPLATS.length; k < SPLATS.length + 9 && i < 400; i++){
    const x = 0.33 + 0.53 * hash01(i, 511), y = -0.15 + 0.3 * hash01(i, 512);
    if (inside(Q, x, y)) splat(g, k++, x, y, 0.003 + 0.007 * hash01(i, 513) ** 2, 0);
  }
  // seyrek zerreler bütün kapakta
  for (let i = 0; i < 260; i++){ const x = 0.32 + 0.55 * hash01(i, 521), y = -0.16 + 0.32 * hash01(i, 522); if (!inside(Q, x, y)) continue;
    g.fillStyle = hash01(i, 523) < 0.6 ? INK.red : INK.blood; g.beginPath(); g.arc((x - PT.x0) * PS, (PT.y1 - y) * PS, 0.5 + 1.1 * hash01(i, 524) ** 3, 0, TAU); g.fill(); }
  g.fillStyle = INK.base; g.fillRect(0, PT.h - 40, 40, 40);   // arka kapağın örneklediği köşe
  return c;
}
// Tek sıçrama (k: desen sırası): üst üste binen loblardan organik ana leke (ortası koyu birikinti, çevresinde seyrelmiş pembe hale), lekeden
// fışkıran incelen parmaklar (uçlarında boncuk, bazen kopmuş damla), uçuş yönünde uzayan kuyruklu uydu damlalar, ince sprey ve aşağı (+x) inen akıntılar
function splat(g, k, x, y, r, drips){
  const q = (c, i = 0) => hash01(i, k * 32 + c), X = (x - PT.x0) * PS, Y = (PT.y1 - y) * PS, R = r * PS, mm = PS / 1000;
  const tone = [INK.blood, INK.red, INK.blood, INK.bright][Math.floor(q(0) * 4)], P = (s, a) => [X + s * Math.cos(a), Y - s * Math.sin(a)];
  const th = q(40) * TAU, fw = a => Math.max(0, Math.cos(a - th));   // fırlatma yönü: o yanda parmaklar uzun, damlalar sık ve uzakta
  const dot = (px, py, rr) => { g.beginPath(); g.arc(px, py, Math.max(0.5, rr), 0, TAU); g.fill(); };
  const lobes = [{a: 0, d: 0, s: 0.7}].concat(Array.from({length: 3 + Math.floor(q(1) * 4)}, (_, i) => ({a: q(2, i) * TAU, d: R * (0.22 + 0.38 * q(3, i)), s: 0.24 + 0.3 * q(4, i)})));
  const lobe = (L, i, m) => { const ph = [q(5, i), q(6, i), q(7, i)].map(v => v * TAU), [cx, cy] = P(L.d, L.a);
    g.beginPath(); for (let j = 0; j < 96; j++){ const t = j / 96 * TAU, v = R * L.s * m * (1 + 0.09 * Math.sin(2 * t + ph[0]) + 0.06 * Math.sin(3 * t + ph[1]) + 0.035 * Math.sin(7 * t + ph[2]));
      g.lineTo(cx + v * Math.cos(t), cy - v * Math.sin(t)); } g.closePath(); g.fill(); };
  g.fillStyle = INK.pink; g.globalAlpha = 0.1; lobes.forEach((L, i) => lobe(L, i, 1.18)); g.globalAlpha = 1;
  g.fillStyle = tone; lobes.forEach((L, i) => lobe(L, i, 1));
  // parmaklar: kenardan çıkar, kalınlığı uca doğru ~0.3 mm'ye iner, hafif kıvrılır
  const ns = 8 + Math.floor(q(8) * 12);
  for (let i = 0; i < ns; i++){
    const a = q(9, i) * TAU, s0 = R * 0.5, len = R * (0.3 + 1.5 * q(10, i) ** 2) * (0.55 + 0.9 * fw(a)), w0 = R * (0.035 + 0.075 * q(11, i)), w1 = (0.22 + 0.3 * q(12, i)) * mm, bend = (q(13, i) - 0.5) * 0.35;
    const C = u => { const s = s0 + len * u, b = a + bend * u * u; return P(s, b); }, W = u => w0 + (w1 - w0) * u ** 0.55, Lh = [], Rh = [];
    for (let j = 0; j <= 16; j++){ const u = j / 16, [cx, cy] = C(u), b = a + bend * u * u, nx = -Math.sin(b), ny = -Math.cos(b), w = W(u); Lh.push([cx + nx * w, cy + ny * w]); Rh.push([cx - nx * w, cy - ny * w]); }
    g.fillStyle = tone; g.beginPath(); Lh.concat(Rh.reverse()).forEach(([px, py]) => g.lineTo(px, py)); g.closePath(); g.fill();
    const [ex, ey] = C(1); if (q(14, i) < 0.75) dot(ex, ey, w1 * (1.6 + 1.6 * q(15, i)));
    if (q(16, i) < 0.35){ const [dx, dy] = P(s0 + len + (1.5 + 4 * q(17, i)) * mm, a + bend); g.fillStyle = INK.red; dot(dx, dy, w1 * (1 + 1.5 * q(18, i))); }
  }
  // ortadaki koyu birikinti
  const gr = g.createRadialGradient(X, Y, 0, X, Y, R * 0.62); gr.addColorStop(0, "rgba(46,2,8,0.72)"); gr.addColorStop(0.6, "rgba(46,2,8,0.4)"); gr.addColorStop(1, "rgba(46,2,8,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R * 0.62, 0, TAU); g.fill();
  // uydu damlalar: uzaklaştıkça küçülür, uçuş yönünde uzar; uzunların ucunda kuyruk ve kopmuş zerre
  for (let i = 0, n = Math.round(r * 1300); i < n; i++){
    const a = q(41, i) < 0.65 ? th + (q(19, i) - 0.5) * 2.2 : q(19, i) * TAU, d = (1.1 + 2.9 * q(20, i) ** 1.5) * (1 + 0.35 * fw(a)), s = Math.max(0.5, R * 0.075 * (1.08 - 0.3 * (d - 1.1)) * (0.25 + 0.75 * q(21, i) ** 1.5)), e = 1 + 2.2 * (d - 1.1) / 2.9 * q(22, i);
    const [px, py] = P(R * d, a), ca = Math.cos(a), sa = -Math.sin(a);
    g.fillStyle = [INK.red, INK.blood, INK.pink, INK.bright][Math.floor(q(23, i) * 4)];
    g.beginPath(); g.ellipse(px, py, s * e, s, -a, 0, TAU); g.fill();
    if (e > 1.5 && s > 1.2){ g.beginPath(); g.moveTo(px + ca * s * e * 0.7 - sa * s * 0.45, py + sa * s * e * 0.7 + ca * s * 0.45); g.lineTo(px + ca * s * e * 2.1, py + sa * s * e * 2.1);
      g.lineTo(px + ca * s * e * 0.7 + sa * s * 0.45, py + sa * s * e * 0.7 - ca * s * 0.45); g.fill(); if (q(24, i) < 0.5) dot(px + ca * s * e * 2.8, py + sa * s * e * 2.8, s * 0.3); }
  }
  for (let i = 0, n = Math.round(r * 9000); i < n; i++){ const [px, py] = P(R * (1 + 3.8 * q(26, i) ** 2.2), q(25, i) * TAU);
    g.fillStyle = q(27, i) < 0.6 ? INK.bright : INK.pink; g.globalAlpha = 0.5 + 0.5 * q(28, i); dot(px, py, (0.1 + 0.3 * q(29, i) ** 2) * mm); }
  g.globalAlpha = 1; g.fillStyle = tone;
  for (let j = 0; j < drips; j++){
    const a = (q(30, j) - 0.5) * 1.0, w = (2.2 + 2.4 * q(31, j)) * mm, len = (12 + 58 * q(30, j + 9)) * mm, f = q(31, j + 9) * TAU, sl = (q(30, j + 19) - 0.5) * 0.12;
    const [x0, y0] = P(R * 0.55, a), at = s => y0 + s * sl + Math.sin(s / (8 * mm) + f) * 0.5 * mm;
    for (let s = 0; s <= len; s += 0.5) dot(x0 + s, at(s), w / 2 * (0.6 + 0.4 * Math.exp(-s / (6 * mm))) * (1 + 0.08 * Math.sin(s / (3 * mm) + f)));
    dot(x0 + len + 0.25 * w, at(len), w * 0.62);
  }
}
// Savrulma izi: bir yay boyunca dizilen, yaya hizalı uzun damlalar (yay boyunca küçülür)
function castOff(g, k, x, y, rad, a0, a1, n){
  const q = (c, i = 0) => hash01(i, 900 + k * 16 + c), mm = PS / 1000, cx = (x - PT.x0) * PS, cy = (PT.y1 - y) * PS;
  for (let i = 0; i < n; i++){
    const u = (i + 0.5 * q(0, i)) / n, a = a0 + (a1 - a0) * u, R = rad * PS * (1 + 0.04 * (q(1, i) - 0.5)), s = (0.5 + 1.6 * (1 - u) * (0.5 + q(2, i))) * mm, e = 1.6 + 1.8 * q(3, i);
    const px = cx + R * Math.cos(a), py = cy - R * Math.sin(a), dir = a + Math.sign(a1 - a0) * Math.PI / 2;
    g.fillStyle = [INK.red, INK.blood, INK.bright][Math.floor(q(4, i) * 3)]; g.beginPath(); g.ellipse(px, py, s * e, s, -dir, 0, TAU); g.fill();
  }
}
// Kenar dokusu (4096 × 160): kapak kenarından aşağı, üstteki yuvarlak kısım ve duvarın ilk 3 mm'si kapak tuvalinden (kenarı saran boya);
// boyanın duvara ulaştığı yerlerden aşağı akıntılar. En alttaki 4 mm boyasız (çukur duvarı oradan örnekler).
function paintSide(top, E){
  const W = SW, H = SH, c = canvas(W, H), g = c.getContext("2d");
  g.fillStyle = INK.base; g.fillRect(0, 0, W, H);
  const S = top.getContext("2d").getImageData(0, 0, PT.w, PT.h), D = g.getImageData(0, 0, W, H);
  if (!S || !D) return c;   // tuvalsiz ortam (node ölçüm araçları)
  const s = S.data, d = D.data, rows = Math.ceil((RQ + 0.003) / VMAX * H), pu = W / E.P / 1000, pv = H / VMAX / 1000, TW = PT.w * 4;
  for (let col = 0; col < W; col++){
    const [x, y, nx, ny] = E.at((col + 0.5) / W * E.P);
    for (let row = 0; row < rows; row++){
      const t = (row + 0.5) / H * VMAX, X = (x + nx * t - PT.x0) * PS - 0.5, Y = (PT.y1 - y - ny * t) * PS - 0.5;
      const x0 = Math.max(0, Math.min(PT.w - 2, Math.floor(X))), y0 = Math.max(0, Math.min(PT.h - 2, Math.floor(Y))), fx = X - x0, fy = Y - y0, o = (row * W + col) * 4, b = (y0 * PT.w + x0) * 4;
      for (let k = 0; k < 3; k++) d[o + k] = (s[b + k] * (1 - fx) + s[b + 4 + k] * fx) * (1 - fy) + (s[b + TW + k] * (1 - fx) + s[b + TW + 4 + k] * fx) * fy;
    }
  }
  g.putImageData(D, 0, 0);
  const last = rows - 1, red = col => d[(last * W + col) * 4] - d[(last * W + col) * 4 + 1] > 70, end = H - 0.004 * pv * 1000;
  for (let col = 0, k = 0; col < W; k++){
    if (!red(col)){ col++; continue; }
    let e = col; while (e < W && red(e)) e++;
    if (e - col >= 3 && hash01(k, 531) < 0.6){
      const cc = col + (e - col) * (0.3 + 0.4 * hash01(k, 532)), w = Math.max(2, Math.min(e - col, (1.6 + 2.0 * hash01(k, 533)) * pu)), len = Math.min(end - last, (4 + 26 * hash01(k, 534) ** 2) * pv), o = (last * W + Math.floor(cc)) * 4;
      g.fillStyle = `rgb(${d[o]},${d[o + 1]},${d[o + 2]})`;
      for (let v = 0; v <= len; v += 0.5){ const k2 = 0.55 + 0.45 * Math.exp(-v / (4 * pv)); g.beginPath(); g.ellipse(cc, last - 1 + v, w / 2 * k2, w / 2 * k2 * pv / pu, 0, 0, TAU); g.fill(); }
      g.beginPath(); g.ellipse(cc, last - 1 + len + 0.3 * w * pv / pu, w * 0.6, w * 0.6 * pv / pu, 0, 0, TAU); g.fill();
    }
    col = e;
  }
  return c;
}

// Gövde hattında (d1, d2 yönlerinde) en dıştaki iki nokta: pim başı kenardan bev + PIN_L ötede, z yüksekliğinde; n hattın dışa normali
const PIN_L = 0.009;
function edgePins(shape, d1, d2, bev, z){
  const P = shape.getSpacedPoints(400), N = P.length - 1;
  const one = ([dx, dy]) => {
    let k = 0; for (let i = 1; i < N; i++) if (P[i].x * dx + P[i].y * dy > P[k].x * dx + P[k].y * dy) k = i;
    const a = P[(k + N - 1) % N], b = P[(k + 1) % N], n = new THREE.Vector3(b.y - a.y, a.x - b.x, 0).normalize();
    if (n.x * dx + n.y * dy < 0) n.negate();
    return {p: new THREE.Vector3(P[k].x, P[k].y, z).addScaledVector(n, bev + PIN_L), n};
  };
  const t = one(d1), b = one(d2);
  return {top: t.p, bottom: b.p, topN: t.n, bottomN: b.n};
}
