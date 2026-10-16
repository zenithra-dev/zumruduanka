// Claude'un gitarı: Stratocaster tipi gövde, sap, teller, pena ve sap kafasındaki kamera.
// Gitar yerel çerçevesi: x sap boyunca (0 eşik, L köprü, eksi taraf kafa), y teller arası (+ kalın E), z kapaktan dışarı.
import * as THREE from "three";
import { L, FRETS, fretX, STR_Z, stringY, pressX, mtof } from "../music/theory.js";
import { bendDisplacement, bendShape, PRE_IN, REL } from "../music/bend.js";

export function createGuitarModel(scene){
  // Sağ elle çalış: gitar, Claude'un orta düzlemine (x = 0.2) göre aynalanmış bir taşıyıcıda durur. İçteki duruş solak
  // çerçevede kuruldu (sap ~34° yukarı, sırt karında, köprü kemerin biraz altında); taşıyıcı onu çevirir: sap oyuncunun soluna
  // gider, kalın E üstte kalır. Bu duruşta iki dirsek de 60-120° arasında 1-22. perdeye ve penaya yetişir; pena kolunun üst kolu
  // düşeyden 40°'nin altında kalır (gitar daha yüksek ya da yatıkken pena dirseği omuz hizasına kalkıyordu).
  // r128 negatif determinantlı nesnelerde yüz yönünü kendisi çevirir; dünya yönü gereken yerde matrixWorld kullanılmalı.
  const rig = new THREE.Group(); rig.scale.x = -1; rig.position.x = 0.4; scene.add(rig);
  const guitar = new THREE.Group();
  guitar.rotation.z = -0.6;
  guitar.position.set(-0.2, 0.32, -0.07);
  rig.add(guitar);

  // Sunburst dokusu
  function sunburstTexture(){
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(256, 256, 30, 256, 256, 300);
    gr.addColorStop(0, "#f2b445"); gr.addColorStop(0.42, "#d9861e"); gr.addColorStop(0.66, "#8a2a10");
    gr.addColorStop(0.82, "#3a120a"); gr.addColorStop(1, "#140604");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.globalAlpha = 0.07;
    for (let i = 0; i < 160; i++){ g.strokeStyle = i % 2 ? "#000" : "#fff"; g.beginPath(); g.moveTo(0, i * 3.2); g.bezierCurveTo(170, i*3.2 + 12, 340, i*3.2 - 12, 512, i*3.2 + 4); g.stroke(); }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const sb = sunburstTexture();
  // Gövde kapak UV'leri metre cinsinden: x 0.33..0.87, y -0.19..0.18
  sb.repeat.set(1 / 0.54, 1 / 0.37); sb.offset.set(-0.33 / 0.54, 0.19 / 0.37);

  const body = new THREE.Shape();
  body.moveTo(0.42, 0.03);
  body.bezierCurveTo(0.40, 0.06, 0.34, 0.09, 0.355, 0.118);
  body.bezierCurveTo(0.37, 0.145, 0.45, 0.15, 0.52, 0.132);
  body.bezierCurveTo(0.60, 0.115, 0.66, 0.168, 0.75, 0.162);
  body.bezierCurveTo(0.85, 0.156, 0.875, 0.02, 0.85, -0.07);
  body.bezierCurveTo(0.83, -0.17, 0.70, -0.178, 0.62, -0.152);
  body.bezierCurveTo(0.56, -0.132, 0.52, -0.152, 0.46, -0.152);
  body.bezierCurveTo(0.41, -0.152, 0.375, -0.132, 0.39, -0.11);
  body.bezierCurveTo(0.40, -0.08, 0.42, -0.05, 0.42, -0.03);
  body.lineTo(0.42, 0.03);
  const bodyGeo = new THREE.ExtrudeGeometry(body, {depth: 0.037, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 40});
  const bodyMesh = new THREE.Mesh(bodyGeo, [
    new THREE.MeshPhysicalMaterial({map: sb, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08}),
    new THREE.MeshPhysicalMaterial({color: 0x1a0704, roughness: 0.3, clearcoat: 1})
  ]);
  bodyMesh.position.z = 0.004; guitar.add(bodyMesh);
  const TOP = 0.045;

  // Pena koruyucu
  const pg = new THREE.Shape();
  pg.moveTo(0.43, 0.035);
  pg.bezierCurveTo(0.44, 0.07, 0.50, 0.085, 0.55, 0.07);
  pg.bezierCurveTo(0.60, 0.055, 0.63, 0.045, 0.64, 0.03);
  pg.lineTo(0.64, -0.03);
  pg.bezierCurveTo(0.67, -0.04, 0.73, -0.06, 0.76, -0.10);
  pg.bezierCurveTo(0.77, -0.13, 0.72, -0.145, 0.64, -0.13);
  pg.bezierCurveTo(0.56, -0.115, 0.50, -0.14, 0.45, -0.13);
  pg.bezierCurveTo(0.41, -0.12, 0.405, -0.09, 0.43, -0.035);
  pg.lineTo(0.43, 0.035);
  // Eskimiş parşömen: açık beyaz, ışık altında bloom eşiğini aşıp beyaz lekeye dönüyordu
  const pgMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(pg, {depth: 0.002, bevelEnabled: false, curveSegments: 30}),
    new THREE.MeshStandardMaterial({color: 0x8a8172, roughness: 0.7}));
  pgMesh.position.z = TOP; guitar.add(pgMesh);

  const chrome = new THREE.MeshStandardMaterial({color: 0xdfe3e8, metalness: 0.95, roughness: 0.18});
  const cream = new THREE.MeshStandardMaterial({color: 0xd8cfba, roughness: 0.6});
  // Manyetikler (tek bobin); köprüdekinin ince tel ucu köprüye daha yakın
  [[0.488, 0], [0.548, 0], [0.606, 0.12]].forEach(([x, rot]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.07, 0.008), cream);
    p.position.set(x, 0, TOP + 0.006); p.rotation.z = rot; guitar.add(p);
    for (let s = 0; s < 6; s++){
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.003, 12), chrome);
      pole.rotation.x = Math.PI / 2;
      const yy = stringY(s, x);
      pole.position.set(x - Math.sin(rot) * yy, Math.cos(rot) * yy, TOP + 0.0105);
      guitar.add(pole);
    }
  });
  // Köprü ve eyerler
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.072, 0.004), chrome);
  bridge.position.set(0.66, 0, TOP + 0.004); guitar.add(bridge);
  for (let s = 0; s < 6; s++){
    const sad = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.009, 0.01), chrome);
    sad.position.set(L + 0.002 + s * 0.0006, stringY(s, L), TOP + 0.009); guitar.add(sad);
  }
  // Düğmeler ve seçici
  [[0.665, -0.072], [0.70, -0.088], [0.735, -0.098]].forEach(([x, y]) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.016, 24), cream);
    k.rotation.x = Math.PI / 2; k.position.set(x, y, TOP + 0.01); guitar.add(k);
  });
  const sw = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.01, 0.012), cream); sw.position.set(0.63, -0.075, TOP + 0.008); sw.rotation.z = 0.5; guitar.add(sw);

  // Sap ve klavye
  const neckGeo = new THREE.BoxGeometry(1, 1, 1);
  const maple = new THREE.MeshStandardMaterial({color: 0xb47a3c, roughness: 0.55});
  const rosewood = new THREE.MeshStandardMaterial({color: 0x3b2116, roughness: 0.75});
  const neck = new THREE.Mesh(neckGeo, maple);
  neck.scale.set(0.44, 0.05, 0.022); neck.position.set(0.215, 0, 0.042); guitar.add(neck);
  const fbShape = new THREE.Shape();
  fbShape.moveTo(-0.004, 0.0215); fbShape.lineTo(0.47, 0.0285); fbShape.lineTo(0.47, -0.0285); fbShape.lineTo(-0.004, -0.0215); fbShape.lineTo(-0.004, 0.0215);
  const fb = new THREE.Mesh(new THREE.ExtrudeGeometry(fbShape, {depth: 0.006, bevelEnabled: false}), rosewood);
  fb.position.z = 0.0505; guitar.add(fb);
  const FB_TOP = 0.0565;
  const fretMat = new THREE.MeshStandardMaterial({color: 0xc9ccd2, metalness: 0.9, roughness: 0.25});
  for (let n = 1; n <= FRETS; n++){
    const x = fretX(n);
    const w = 2 * (0.0215 + (0.0285 - 0.0215) * (x / 0.47));
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, w, 8), fretMat);
    f.position.set(x, 0, FB_TOP); guitar.add(f);
  }
  const dotMat = new THREE.MeshStandardMaterial({color: 0xece4d0, roughness: 0.4});
  [3,5,7,9,12,15,17,19,21].forEach(n => {
    const x = (fretX(n - 1) + fretX(n)) / 2;
    (n === 12 ? [0.011, -0.011] : [0]).forEach(y => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.001, 16), dotMat);
      d.rotation.x = Math.PI / 2; d.position.set(x, y, FB_TOP + 0.0004); guitar.add(d);
    });
  });
  const nut = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.044, 0.006), cream);
  nut.position.set(-0.002, 0, FB_TOP + 0.002); guitar.add(nut);

  // Sap kafası
  const hs = new THREE.Shape();
  hs.moveTo(-0.004, -0.0215);
  hs.lineTo(-0.15, -0.026);
  hs.bezierCurveTo(-0.185, -0.028, -0.2, -0.005, -0.19, 0.02);
  hs.bezierCurveTo(-0.18, 0.045, -0.15, 0.05, -0.13, 0.045);
  hs.bezierCurveTo(-0.10, 0.04, -0.06, 0.048, -0.04, 0.042);
  hs.bezierCurveTo(-0.02, 0.036, -0.01, 0.022, -0.004, 0.0215);
  hs.lineTo(-0.004, -0.0215);
  const head = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, {depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 24}), maple);
  head.position.z = 0.034; guitar.add(head);
  const HS_TOP = 0.05;
  const posts = [];
  for (let s = 0; s < 6; s++){
    const px = -0.032 - s * 0.0255, py = 0.03 - (s < 3 ? 0 : 0.002);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.014, 12), chrome);
    post.rotation.x = Math.PI / 2; post.position.set(px, py, HS_TOP + 0.007); guitar.add(post);
    const keyB = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.004), chrome);
    keyB.position.set(px, py + 0.028, 0.036); guitar.add(keyB);
    posts.push(new THREE.Vector3(px, py, HS_TOP + 0.011));
  }

  /* ---------- Sap kafasındaki kamera ---------- */
  const camRig = new THREE.Group();
  camRig.position.set(-0.168, 0.004, HS_TOP);
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
  // İnce tel ekranda 0.75 pikselden ince çizilmez; o zaman parlaklığı √(gerçek/çizilen) kadar kısılır (uzak çekimde kaybolmaz, kalından ayrılır).
  const GAUGE = [0.00117, 0.00091, 0.00066, 0.00043, 0.00033, 0.000254];
  const AMP = [0.0012, 0.0011, 0.001, 0.0009, 0.0008, 0.0007];   // vuruşta konuşan boyun ortasındaki titreşim yarı genliği (m), v = 1
  // Nokta düzeni: burgu, eşik, eşikten basma noktasına NB parça, perde teli, perdeden köprüye NS parça (boş telde eşikten köprüye eşit aralık)
  const NB = 6, NS = 36, NP = NB + NS + 3, CROWN = FB_TOP + 0.0011, DIP = 0.0005;   // perde telinin tepesi; parmak altında tel DIP kadar iner
  const sm = u => u * u * (3 - 2 * u);
  const SU = {uH: {value: 720}, uMinPx: {value: 0.75}};   // çizilen tamponun yüksekliği (px, her çizimde), en ince çizim (px)
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
float gAs(float u){ float a = min(abs(u), 1e4); return a < 1.0 ? a * asin(a) + sqrt(1.0 - a * a) - 1.0 : PI_HALF * a - 1.0; }
float strCov(float x, float r, float A, float p){ A = max(A, 1e-6); float h = 0.5 * p;
  return A / (PI * p) * (gAs((x + h + r) / A) - gAs((x - h + r) / A) - gAs((x + h - r) / A) + gAs((x - h - r) / A)); }`;
  const FRAG_COV = `diffuseColor.a *= clamp(strCov(vX, vR, vA, max(vPx, 1e-7)), 0.0, 1.0) * sqrt(vRt / vR);
if (diffuseColor.a < 0.002) discard;
float wk = uWind * clamp(1.0 - 2.0 * fwidth(vU) / uPitch, 0.0, 1.0) * vR / (vR + vA);   // sarım deseni yalnız çözülebildiği yakınlıkta
diffuseColor.rgb *= 1.0 - 0.3 * wk * (0.5 + 0.5 * cos(6.2832 * vU / uPitch));`;
  const FRAG_NORMAL = `float faceDirection = gl_FrontFacing ? 1.0 : -1.0;
float sAc = clamp(vX / (vR + vA), -1.0, 1.0) * (vR + 0.5 * vA) / (vR + vA);   // titreşen tel iğde bakışa yakın gölgelenir (silindirin ortalaması)
vec3 normal = normalize(vSV * sAc + normalize(vViewPosition) * sqrt(1.0 - sAc * sAc));
vec3 geometryNormal = normal;`;
  // Ortam haritası yok: metal tel yalnız ışık parlamasıyla görünürdü; yansıyan yönde yarıküre ışığının gök/yer rengi ortam yansıması sayılır
  const FRAG_ENV = `#if NUM_HEMI_LIGHTS > 0
{ vec3 rv = reflect(-geometry.viewDir, geometry.normal);
  for (int i = 0; i < NUM_HEMI_LIGHTS; i++) radiance += uEnv * mix(hemisphereLights[i].groundColor, hemisphereLights[i].skyColor, 0.5 * dot(rv, hemisphereLights[i].direction) + 0.5); }
#endif`;
  function strMat(color, roughness, wind){
    const U = {uWind: {value: wind}, uPitch: {value: 0.0003}, uEnv: {value: 2}};
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

  rig.updateMatrixWorld(true);   // gitar sabit: ilk karede de localToWorld doğru dünya konumunu versin
  // solids: el/kol çarpışma ölçümünün katıları (tools/sync-check.mjs): gitarın doğrudan çocukları, döndürülmemiş; BoxGeometry kutu,
  // ExtrudeGeometry şeklinin xy dış hattı ve z kalınlığıyla prizma sayılır. Teller: stringAt(s, x) çizilen eksen; strings[s].pos aynı eksen (x artan).
  return { rig, guitar, strings, updateStrings, stringAt, GAUGE, pick, recLed, camRig, HS_TOP, TOP, FB_TOP, solids: {body: bodyMesh, neck, fretboard: fb} };
}
