import fs from "node:fs";
const P = process.argv[2] || "C:/work/karakter/cikti/karakter.vrm";
const buf = fs.readFileSync(P);
const jsonLen = buf.readUInt32LE(12);
const J = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
const binOff = 20 + jsonLen + 8;
export function load(){ return {J, buf, binOff}; }
const what = process.argv[3] || "all";
const V = J.extensions && J.extensions.VRM;
const out = [];
const log = (...a) => out.push(a.join(" "));
if (what === "all" || what === "ozet"){
  log("asset", JSON.stringify(J.asset), "extensionsUsed", JSON.stringify(J.extensionsUsed));
  log("counts nodes", J.nodes.length, "meshes", J.meshes.length, "materials", J.materials.length, "textures", (J.textures||[]).length, "images", (J.images||[]).length, "skins", (J.skins||[]).length, "accessors", J.accessors.length);
  log("VRM keys", Object.keys(V));
  log("meta", JSON.stringify(V.meta).slice(0, 600));
}
if (what === "all" || what === "mesh"){
  J.meshes.forEach((m, mi) => {
    const nodes = J.nodes.map((n, i) => [n, i]).filter(([n]) => n.mesh === mi).map(([n, i]) => `${n.name}#${i} skin=${n.skin}`);
    log(`MESH ${mi} ${m.name} nodes=[${nodes}] targetNames=${m.extras && m.extras.targetNames ? m.extras.targetNames.length : "-"}`);
    m.primitives.forEach((p, pi) => {
      const pos = J.accessors[p.attributes.POSITION], idx = p.indices !== undefined ? J.accessors[p.indices] : null;
      const tk = p.targets ? [...new Set(p.targets.flatMap(t => Object.keys(t)))].join(",") : "";
      log(`  prim ${pi} mat=${p.material}(${J.materials[p.material].name}) v=${pos.count} tri=${idx ? idx.count / 3 : "-"} attrs=${Object.keys(p.attributes).join(",")} targets=${p.targets ? p.targets.length : 0}[${tk}] mode=${p.mode ?? 4}`);
    });
  });
  (J.skins || []).forEach((s, i) => log(`SKIN ${i} joints=${s.joints.length} skeleton=${s.skeleton}`));
}
if (what === "all" || what === "mat"){
  J.materials.forEach((m, i) => {
    const mp = V.materialProperties[i];
    log(`MAT ${i} ${m.name} alphaMode=${m.alphaMode || "OPAQUE"} cutoff=${m.alphaCutoff ?? "-"} double=${!!m.doubleSided} pbrTex=${m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture ? m.pbrMetallicRoughness.baseColorTexture.index : "-"}`);
    if (mp){
      log(`   shader=${mp.shader} rq=${mp.renderQueue} kw=${JSON.stringify(mp.keywordMap)} tag=${JSON.stringify(mp.tagMap)}`);
      const f = mp.floatProperties, v = mp.vectorProperties, t = mp.textureProperties;
      const pick = ["_Cutoff","_BlendMode","_CullMode","_OutlineCullMode","_SrcBlend","_DstBlend","_ZWrite","_ShadeToony","_ShadeShift","_LightColorAttenuation","_IndirectLightIntensity","_ReceiveShadowRate","_ShadingGradeRate","_RimFresnelPower","_RimLift","_RimLightingMix","_OutlineWidth","_OutlineWidthMode","_OutlineColorMode","_OutlineLightingMix","_OutlineScaledMaxDistance","_BumpScale","_UvAnimScrollX","_UvAnimScrollY","_UvAnimRotation","_DebugMode","_MToonVersion","_AlphaToMask"];
      log("   f " + pick.filter(k => f[k] !== undefined).map(k => `${k.slice(1)}=${+f[k].toFixed(4)}`).join(" "));
      log("   v " + Object.entries(v).filter(([k]) => !/_ST$/.test(k) || v[k].some((x, j) => x !== [1,1,0,0][j])).map(([k, a]) => `${k.slice(1)}=[${a.map(x => +x.toFixed(4))}]`).join(" "));
      log("   t " + Object.entries(t).map(([k, x]) => `${k.slice(1)}=${x}`).join(" "));
    }
  });
}
if (what === "all" || what === "tex"){
  (J.textures || []).forEach((t, i) => { const im = J.images[t.source], bv = J.bufferViews[im.bufferView];
    let wh = "";
    const b = buf.slice(binOff + (bv.byteOffset || 0), binOff + (bv.byteOffset || 0) + bv.byteLength);
    if (im.mimeType === "image/png") wh = `${b.readUInt32BE(16)}x${b.readUInt32BE(20)} ct=${b[25]}`;
    log(`TEX ${i} img=${t.source} ${im.name} ${im.mimeType} ${(bv.byteLength / 1024).toFixed(0)}KB ${wh} sampler=${t.sampler}`); });
  (J.samplers || []).forEach((s, i) => log(`SAMPLER ${i} ${JSON.stringify(s)}`));
}
if (what === "all" || what === "bs"){
  const BS = V.blendShapeMaster.blendShapeGroups;
  BS.forEach(g => log(`BS ${g.presetName}/${g.name} binary=${g.isBinary} binds=${JSON.stringify(g.binds.map(b => [b.mesh, b.index, b.weight]))} mat=${(g.materialValues || []).length}`));
}
if (what === "all" || what === "hum"){
  V.humanoid.humanBones.forEach(h => log(`HB ${h.bone} -> ${J.nodes[h.node].name}#${h.node}`));
}
if (what === "all" || what === "sec"){
  const S = V.secondaryAnimation;
  log("springs", S.boneGroups.length, "colliderGroups", S.colliderGroups.length);
  S.boneGroups.forEach((g, i) => log(`SG ${i} ${g.comment} stiff=${g.stiffiness} grav=${g.gravityPower} drag=${g.dragForce} r=${g.hitRadius} bones=${g.bones.map(b => J.nodes[b].name).join(",")}`));
}
console.log(out.join("\n"));
