// Salt okur deneme: vekil → VRM dönüş aktarımının matematiği (node, dokusuz VRM). Üç sınama:
//  1) omurga zinciri: figür çerçevesindeki vekil zincirinin yerel dörtlükleri (x,y,z,w) → VRM'e (-x, y, -z, w) (180° Y eşleniği) kopyalanır
//  2) sol kol: eşit olmayan iki kemikli IK (S, E, T, düzlem normali n) → üst/ön kol "iki vektör tabanı" ile; ön kol burulması α payı
//  3) aynalı vekil el (scale.x = -1, mankenin sol eli gibi) ve işaret parmağı zinciri → det düzeltmeli çerçeve farkı P_now·P_rest⁻¹
// Her sınamada VRM eklem dünya konumu ↔ vekil eklem dünya konumu farkı (mm) ve CPU deri (boneTransform) ile bilek çevresi köşelerinin
// vekil el çerçevesine göre kayması basılır. Rastgele pozlar hash ile (Math.random yok).
//   node --import ./three-hook.mjs aktarim-deneme.mjs
import fs from "node:fs";
import * as THREE from "three";
const { GLTFLoader } = await import("file:///C:/work/zumruduanka/src/vendor/three/examples/jsm/loaders/GLTFLoader.js");
const buf = fs.readFileSync("C:/work/karakter/cikti/karakter.vrm"), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
const LD = new GLTFLoader(); LD.register(() => ({name: "yt", loadTexture: () => Promise.resolve(new THREE.Texture()), loadMaterial: () => Promise.resolve(new THREE.MeshBasicMaterial())}));
const gltf = await new Promise((res, rej) => LD.parse(ab, "", res, rej));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), Q = () => new THREE.Quaternion();
const h = (i, s) => { let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(s + 7, 0x85ebca6b); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return ((x >>> 0) / 4294967296); };
const scene = new THREE.Scene();
const fig = new THREE.Group(); fig.position.set(0.2, -0.95, -0.19); fig.rotation.y = 0.3; scene.add(fig);            // figür kökü (yaw'lı: genel durum)
const holder = new THREE.Group(); holder.rotation.y = Math.PI; fig.add(holder); holder.add(gltf.scene);           // VRM: figür çerçevesinde 180° Y
const B = n => gltf.scene.getObjectByName(n);
scene.updateMatrixWorld(true);
const restW = {}; gltf.scene.traverse(o => { if (o.isBone) restW[o.name] = o.getWorldPosition(V3()); });
const restF = n => fig.worldToLocal(restW[n].clone());                                                       // figür çerçevesinde dinlenme
const conj = q => new THREE.Quaternion(-q.x, q.y, -q.z, q.w);
const mm = (a, b) => (a.distanceTo(b) * 1000).toFixed(3);
const body = []; gltf.scene.traverse(o => { if (o.isSkinnedMesh && o.parent && o.parent.name === "Body") body.push(o); });
const skel = body[0].skeleton; body.concat([]).forEach(m => m.bind(skel, m.bindMatrix));

// ---------- 1) omurga zinciri vekili (figür çerçevesinde, kimlik dinlenme) ----------
const CH = ["J_Bip_C_Hips", "J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest", "J_Bip_C_Neck", "J_Bip_C_Head"], PX = {};
let par = fig; CH.forEach((n, i) => { const g = new THREE.Group(); g.position.copy(restF(n)).sub(i ? restF(CH[i - 1]) : V3()); par.add(g); PX[n] = g; par = g; });
for (const s of ["L", "R"]){ const sh = new THREE.Group(); sh.position.copy(restF(`J_Bip_${s}_Shoulder`)).sub(restF("J_Bip_C_UpperChest")); PX.J_Bip_C_UpperChest.add(sh); PX[`J_Bip_${s}_Shoulder`] = sh;
  const ua = new THREE.Group(); ua.position.copy(restF(`J_Bip_${s}_UpperArm`)).sub(restF(`J_Bip_${s}_Shoulder`)); sh.add(ua); PX[`J_Bip_${s}_UpperArm`] = ua; }
const e = new THREE.Euler();
let err1 = 0;
for (let k = 0; k < 20; k++){
  CH.concat(["J_Bip_L_Shoulder", "J_Bip_R_Shoulder"]).forEach((n, i) => PX[n].quaternion.setFromEuler(e.set((h(k, i) - 0.5) * 0.6, (h(k, i + 20) - 0.5) * 0.6, (h(k, i + 40) - 0.5) * 0.4)));
  PX.J_Bip_C_Hips.position.copy(restF("J_Bip_C_Hips")).add(V3((h(k, 90) - 0.5) * 0.1, -h(k, 91) * 0.08, (h(k, 92) - 0.5) * 0.1));
  // aktarım: yerel dörtlük eşleniği; kalça konumu VRM Root çerçevesinde (holder 180° Y) = (-x, y, -z)
  CH.concat(["J_Bip_L_Shoulder", "J_Bip_R_Shoulder"]).forEach(n => B(n).quaternion.copy(conj(PX[n].quaternion)));
  const hp = PX.J_Bip_C_Hips.position; B("J_Bip_C_Hips").position.set(-hp.x, hp.y, -hp.z);
  scene.updateMatrixWorld(true);
  for (const n of CH.concat(["J_Bip_L_UpperArm", "J_Bip_R_UpperArm"])) err1 = Math.max(err1, B(n).getWorldPosition(V3()).distanceTo(PX[n].getWorldPosition(V3())));
}
console.log("1) omurga zinciri: 20 rastgele pozda VRM ↔ vekil eklem farkı en çok", (err1 * 1000).toFixed(4), "mm");

// ---------- 2) sol kol: IK + iki vektör tabanı ----------
const l1 = restF("J_Bip_L_UpperArm").distanceTo(restF("J_Bip_L_LowerArm")), l2 = restF("J_Bip_L_LowerArm").distanceTo(restF("J_Bip_L_Hand"));
const FWD = V3(0, 0, 1);   // figür önü
const basis = (u, w) => { const x = u.clone().normalize(), z = w.clone().addScaledVector(x, -w.dot(x)).normalize(), y = V3().crossVectors(z, x); return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
const u0 = restF("J_Bip_L_LowerArm").sub(restF("J_Bip_L_UpperArm")).normalize(), w0 = V3().crossVectors(u0, FWD).normalize();
const u0f = restF("J_Bip_L_Hand").sub(restF("J_Bip_L_LowerArm")).normalize();
const toWorldQ = q => fig.getWorldQuaternion(Q()).multiply(q);                // figür çerçevesi → dünya
const Qh = holder.getWorldQuaternion(Q());                                     // VRM dinlenme dünya dönüşü (bütün kemikler)
// dünya dönüşü W'yi VRM kemiğine yerel olarak yaz (ebeveynin güncel dünya dönüşüyle)
const setWorld = (bone, W) => { bone.parent.updateWorldMatrix(true, false); bone.quaternion.copy(bone.parent.getWorldQuaternion(Q()).invert().multiply(W)); bone.updateMatrixWorld(true); };
let err2 = 0, n2 = 0;
for (let k = 0; k < 40; k++){
  scene.updateMatrixWorld(true);
  const S = fig.worldToLocal(B("J_Bip_L_UpperArm").getWorldPosition(V3()));   // omuz (figür çerçevesi, omurga pozundan)
  const T = S.clone().add(V3(0.05 + h(k, 1) * 0.25, -0.15 - h(k, 2) * 0.25, 0.05 + h(k, 3) * 0.3));
  const d = T.clone().sub(S), len = Math.min(Math.max(d.length(), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.002), dir = d.normalize(), Tc = S.clone().addScaledVector(dir, len);
  const pole = V3(0.8, -1, -0.35); const perp = pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  const x = (l1 * l1 - l2 * l2 + len * len) / (2 * len), hh = Math.sqrt(Math.max(0, l1 * l1 - x * x)), E = S.clone().addScaledVector(dir, x).addScaledVector(perp, hh);
  const n = V3().subVectors(E, S).cross(V3().subVectors(Tc, E)).normalize();
  // üst kol: R·u0 = E−S, R·w0 = n  → dünya W = fig · R · (VRM dinlenme = Qh)
  const R1 = basis(V3().subVectors(E, S), n).multiply(basis(u0, w0).invert());
  setWorld(B("J_Bip_L_UpperArm"), toWorldQ(R1).multiply(fig.getWorldQuaternion(Q()).invert()).multiply(Qh));
  // ön kol: burulma α·γ (γ: elin dönüşü; burada rastgele) ön kol ekseni çevresinde
  const u = V3().subVectors(Tc, E).normalize(), g = (h(k, 4) - 0.5) * 1.6, nf = n.clone().applyAxisAngle(u, 0.5 * g);
  const R2 = basis(u, nf).multiply(basis(u0f, w0).invert());
  setWorld(B("J_Bip_L_LowerArm"), toWorldQ(R2).multiply(fig.getWorldQuaternion(Q()).invert()).multiply(Qh));
  const Ew = fig.localToWorld(E.clone()), Tw = fig.localToWorld(Tc.clone());
  err2 = Math.max(err2, B("J_Bip_L_LowerArm").getWorldPosition(V3()).distanceTo(Ew), B("J_Bip_L_Hand").getWorldPosition(V3()).distanceTo(Tw)); n2++;
}
console.log("2) sol kol (l1", l1.toFixed(4), "l2", l2.toFixed(4) + "):", n2, "pozda dirsek/bilek farkı en çok", (err2 * 1000).toFixed(4), "mm");

// ---------- 3) aynalı vekil el + işaret parmağı ----------
// Kanade sağ el ölçüsünden (olcu.json): işaret kökü el çerçevesinde b, boğumlar l, dinlenme yönü d. Sol el = sağ elin x aynası (scale.x = -1).
const O = JSON.parse(fs.readFileSync(new URL("./olcu.json", import.meta.url)));
const IX = O.el.HAND.find(f => f.f === "Index");
const H = new THREE.Group(); H.scale.x = -1; scene.add(H);
const bones = []; let p = H; IX.l.forEach((l, j) => { const m = new THREE.Object3D(); if (j) m.position.y = IX.l[j - 1]; else m.position.fromArray(IX.b); p.add(m); bones.push(m); p = m; });
const tip = new THREE.Object3D(); tip.position.y = IX.l[2]; bones[2].add(tip);
const XA = V3(1, 0, 0), ZA = V3(0, 0, 1);
const setChain = (u, v, t) => { const m = new THREE.Matrix4().makeBasis(V3().crossVectors(u, v), u, v); bones[0].quaternion.setFromRotationMatrix(m).multiply(Q().setFromAxisAngle(XA, t[0]));
  bones[1].quaternion.setFromAxisAngle(XA, t[1]); bones[2].quaternion.setFromAxisAngle(XA, t[2]); };
const restDir = () => { const r = V3().fromArray(IX.d); r.addScaledVector(ZA, -r.dot(ZA)).normalize(); return r; };
// det düzeltmeli çerçeve: dünya matrisinin tabanı; determinant < 0 ise x sütunu ters çevrilir (aynalı vekil → gerçek sol el)
const proper = o => { o.updateWorldMatrix(true, false); const x = V3(), y = V3(), z = V3(); o.matrixWorld.extractBasis(x, y, z); x.normalize(); y.normalize(); z.normalize();
  if (V3().crossVectors(x, y).dot(z) < 0) x.negate(); return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
// kalibrasyon: VRM dinlenme pozu (aktarımdan önce; kemikleri dinlenmeye döndür)
gltf.scene.traverse(o => { if (o.isBone && o.name !== "Root") o.quaternion.identity(); }); B("J_Bip_C_Hips").position.copy(gltf.parser.json.nodes.find(n => n.name === "J_Bip_C_Hips").translation ? V3().fromArray(gltf.parser.json.nodes.find(n => n.name === "J_Bip_C_Hips").translation) : B("J_Bip_C_Hips").position);
scene.updateMatrixWorld(true);
// dinlenmede sol el: parmaklar figürün +x'i, avuç aşağı, başparmak öne (figür çerçevesi) → dünya
const fq = fig.getWorldQuaternion(Q()), Fx = V3(1, 0, 0).applyQuaternion(fq), Fy = V3(0, 1, 0).applyQuaternion(fq), Fz = V3(0, 0, 1).applyQuaternion(fq);
// el çerçevesi olcu.mjs ile AYNI tanım: y = orta parmak kökünün yataya izdüşümü, z = aşağı (avuç), x = y × z (aynada başparmak öne düşer)
const eyL = B("J_Bip_L_Middle1").getWorldPosition(V3()).sub(B("J_Bip_L_Hand").getWorldPosition(V3())); eyL.addScaledVector(Fy, -eyL.dot(Fy)).normalize();
const ezL = Fy.clone().negate(); H.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3().crossVectors(eyL, ezL), eyL, ezL));
H.position.copy(B("J_Bip_L_Hand").getWorldPosition(V3()));
setChain(restDir(), ZA, [0, 0, 0]); scene.updateMatrixWorld(true);
// kalibrasyon pozu: her boğumun +y'si VRM'in dinlenmedeki bir sonraki eklemine (vekil dinlenmesi VRM dinlenmesine oturur; düz parmak varsayımı yok)
if (process.env.OTUR !== "0"){ const tgt = ["J_Bip_L_Index2", "J_Bip_L_Index3", "J_Bip_L_Index3_end"];
  bones.forEach((b, j) => { b.parent.updateWorldMatrix(true, false); const a = b.getWorldPosition(V3()), w = B(tgt[j]).getWorldPosition(V3()).sub(a).normalize();
    const pq = b.parent.getWorldQuaternion(Q()), loc = w.applyQuaternion(pq.clone().invert()); if (b.parent.matrixWorld.determinant() < 0) loc.x = -loc.x;   // aynalı ebeveynde yön
    b.quaternion.setFromUnitVectors(V3(0, 1, 0), loc.normalize()); b.updateMatrixWorld(true); }); scene.updateMatrixWorld(true); }
const calib = [B("J_Bip_L_Index1"), B("J_Bip_L_Index2"), B("J_Bip_L_Index3")].map((b, j) => [b.getWorldPosition(V3()).distanceTo(bones[j].getWorldPosition(V3()))]);
const tipRest = B("J_Bip_L_Index3_end").getWorldPosition(V3()).distanceTo(tip.getWorldPosition(V3()));
console.log("3) kalibrasyon: vekil işaret eklemleri ↔ VRM dinlenme (mm):", calib.map(c => (c[0] * 1000).toFixed(2)).join(" / "), "uç", (tipRest * 1000).toFixed(2));
const Prest = [proper(H), ...bones.map(proper)], Hrest = Qh.clone();
// CPU deri: işaret uç boğumuna bağlı köşeler (Body) dinlenmede vekil uç çerçevesinde nerede
const g0 = body[0].geometry, si = g0.attributes.skinIndex, sw = g0.attributes.skinWeight, idx3 = skel.bones.indexOf(B("J_Bip_L_Index3")), idxH = skel.bones.indexOf(B("J_Bip_L_Hand"));
const pick = j => { const a = []; for (let v = 0; v < si.count && a.length < 30; v++){ const J = [si.getX(v), si.getY(v), si.getZ(v), si.getW(v)], W = [sw.getX(v), sw.getY(v), sw.getZ(v), sw.getW(v)]; const k = J.indexOf(j); if (k >= 0 && W[k] > 0.99) a.push(v); } return a; };
const VT = pick(idx3), VH = pick(idxH);
const skinW = v => { const out = V3(); body[0].boneTransform(v, out); return out.applyMatrix4(body[0].matrixWorld); };
const local = (o, w) => { o.updateWorldMatrix(true, false); return w.clone().applyMatrix4(o.matrixWorld.clone().invert()); };
const restT = VT.map(v => local(bones[2], skinW(v))), restHd = VH.map(v => local(H, skinW(v)));
let err3 = 0, sk3 = 0;
for (let k = 0; k < 30; k++){
  H.quaternion.setFromEuler(e.set(h(k, 11) * 6.28, h(k, 12) * 6.28, h(k, 13) * 6.28)); H.position.copy(B("J_Bip_L_Hand").getWorldPosition(V3()));
  setChain(restDir().applyAxisAngle(ZA, (h(k, 14) - 0.5) * 0.6), ZA, [h(k, 15) * 1.4, h(k, 16) * 1.6, h(k, 17) * 1.2]);
  scene.updateMatrixWorld(true);
  const P = [proper(H), ...bones.map(proper)], vb = [B("J_Bip_L_Hand"), B("J_Bip_L_Index1"), B("J_Bip_L_Index2"), B("J_Bip_L_Index3")];
  vb.forEach((b, j) => setWorld(b, P[j].clone().multiply(Prest[j].clone().invert()).multiply(Hrest)));
  const pv = [B("J_Bip_L_Index1"), B("J_Bip_L_Index2"), B("J_Bip_L_Index3"), B("J_Bip_L_Index3_end")], px = [bones[0], bones[1], bones[2], tip];
  pv.forEach((b, j) => { err3 = Math.max(err3, b.getWorldPosition(V3()).distanceTo(px[j].getWorldPosition(V3()))); });
  // deri: uç boğum köşeleri vekil uç çerçevesinde dinlenmedekiyle aynı yerde mi (aynalı çerçeve x'i ters: karşılaştırmayı x aynasıyla yap)
  VT.forEach((v, i) => { const q = local(bones[2], skinW(v)); sk3 = Math.max(sk3, q.distanceTo(restT[i])); });
  VH.forEach((v, i) => { const q = local(H, skinW(v)); sk3 = Math.max(sk3, q.distanceTo(restHd[i])); });
}
console.log("3) aynalı el + işaret: 30 rastgele pozda VRM ↔ vekil eklem/uç farkı en çok", (err3 * 1000).toFixed(4), "mm; deri köşelerinin vekil çerçevesine göre kayması en çok", (sk3 * 1000).toFixed(4), "mm");
// det düzeltmesiz: getWorldQuaternion (decompose) ile aynı mı
const naive = o => { o.updateWorldMatrix(true, false); return o.getWorldQuaternion(Q()); };
let errN = 0; {
  H.quaternion.setFromEuler(e.set(0.4, 1.1, -0.3)); setChain(restDir(), ZA, [0.9, 1.0, 0.6]); scene.updateMatrixWorld(true);
  const P = [naive(H), ...bones.map(naive)], vb = [B("J_Bip_L_Hand"), B("J_Bip_L_Index1"), B("J_Bip_L_Index2"), B("J_Bip_L_Index3")];
  vb.forEach((b, j) => setWorld(b, P[j].clone().multiply(Prest[j].clone().invert()).multiply(Hrest)));
  errN = B("J_Bip_L_Index3_end").getWorldPosition(V3()).distanceTo(tip.getWorldPosition(V3()));
}
console.log("   karşılaştırma: det düzeltmesiz getWorldQuaternion ile uç farkı", (errN * 1000).toFixed(1), "mm (r128 Matrix4.decompose det<0 iken sx'i çevirir: getWorldQuaternion zaten x sütunu çevrilmiş dönüşü verir)");
// süre: 60 kemiklik aktarımın kabaca bedeli
const t0 = performance.now(); for (let k = 0; k < 2000; k++){ const P = [proper(H), ...bones.map(proper)]; } const per = (performance.now() - t0) / 2000 / 4;
console.log("süre: det düzeltmeli çerçeve (matrixWorld güncellemesiyle) kemik başına", (per * 1000).toFixed(2), "µs → 60 kemik ≈", (per * 60).toFixed(3), "ms/kare");
