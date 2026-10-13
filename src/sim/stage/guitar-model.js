// Claude'un gitarı: Stratocaster tipi gövde, sap, teller, parmaklar, pena ve sap kafasındaki kamera.
import * as THREE from "three";
import { L, FRETS, fretX, STR_Z, stringY, fingerX } from "../music/theory.js";

export function createGuitarModel(scene){
  const guitar = new THREE.Group();
  guitar.rotation.z = 0.32;
  guitar.position.set(-0.33, -0.27, 0.02);
  scene.add(guitar);

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
  const pgMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(pg, {depth: 0.002, bevelEnabled: false, curveSegments: 30}),
    new THREE.MeshStandardMaterial({color: 0xf1ece0, roughness: 0.45}));
  pgMesh.position.z = TOP; guitar.add(pgMesh);

  const chrome = new THREE.MeshStandardMaterial({color: 0xdfe3e8, metalness: 0.95, roughness: 0.18});
  const cream = new THREE.MeshStandardMaterial({color: 0xf3eedf, roughness: 0.5});
  // Manyetikler (tek bobin)
  [[0.488, 0], [0.548, 0], [0.606, -0.12]].forEach(([x, rot]) => {
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

  /* ---------- Teller, parmaklar, pena ---------- */
  const SEG = 60;
  const strings = [];
  for (let s = 0; s < 6; s++){
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((SEG + 1) * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({color: s < 3 ? 0xc8b48a : 0xe8ecf0});
    const line = new THREE.Line(geo, mat); line.frustumCulled = false;
    guitar.add(line);
    // Eşikten burguya giden kısa parça
    const tail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, stringY(s, 0), STR_Z), posts[s]]), mat);
    guitar.add(tail);
    strings.push({line, pos, mat, base: mat.color.clone(), wasActive: false});
  }
  // Teli yerleştirir: perdeye basılıysa parmağın orada çukur, çalınıyorsa titreşim
  function layoutString(s, fret, amp, phase){
    const st = strings[s], p = st.pos;
    const xf = fret > 0 ? fretX(fret) : 0;
    for (let i = 0; i <= SEG; i++){
      const x = (i / SEG) * L;
      let z = STR_Z, y = stringY(s, x);
      if (fret > 0 && x < xf) z = STR_Z - 0.0025 * Math.max(0, 1 - Math.abs(x - fingerX(fret)) / 0.05);
      if (amp > 0 && x >= xf){
        const u = (x - xf) / (L - xf);
        const w = Math.sin(Math.PI * u) * amp * Math.cos(phase);
        y += w; z += w * 0.5;
      }
      p[i*3] = x; p[i*3+1] = y; p[i*3+2] = z;
    }
    st.line.geometry.attributes.position.needsUpdate = true;
  }
  for (let s = 0; s < 6; s++) layoutString(s, 0, 0, 0);

  const fingerMat = new THREE.MeshStandardMaterial({color: 0xffb35c, emissive: 0xff7a1a, emissiveIntensity: 0.9, roughness: 0.4});
  const fingers = [];
  for (let s = 0; s < 6; s++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 18, 14), fingerMat);
    m.visible = false; guitar.add(m); fingers.push(m);
  }
  const pickShape = new THREE.Shape();
  pickShape.moveTo(0, -0.012); pickShape.quadraticCurveTo(0.012, -0.004, 0.01, 0.008); pickShape.quadraticCurveTo(0, 0.014, -0.01, 0.008); pickShape.quadraticCurveTo(-0.012, -0.004, 0, -0.012);
  const pick = new THREE.Mesh(new THREE.ExtrudeGeometry(pickShape, {depth: 0.0012, bevelEnabled: false}), new THREE.MeshStandardMaterial({color: 0xe25b2a, roughness: 0.4}));
  pick.rotation.z = Math.PI / 2; pick.position.set(0.575, 0, STR_Z + 0.004); guitar.add(pick);

  return { guitar, strings, layoutString, fingers, pick, recLed, camRig, HS_TOP, TOP, FB_TOP };
}
