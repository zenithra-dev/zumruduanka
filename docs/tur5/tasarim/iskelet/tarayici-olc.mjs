// Salt okur, tek ve kısa tarayıcı ölçümü (swiftshader, headless): VRM'in GLTFLoader r128 ile ayrıştırma + doku çözme süresi, ilk kare (doku yükleme),
// sürekli kare süresi: A = bugünkü manken, B = Kanade T-pozunda (GLTFLoader'ın kendi MeshBasic malzemeleri, deri; manken gizli). A,B,A,B dönüşümlü,
// readPixels ile senkron. Repo dosyasına yazmaz; C:/work kökünden servis eder.
//   bash C:/work/karakter/betik/dusuk.sh node out/tur5/tasarim/iskelet/tarayici-olc.mjs
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const { startServer } = await import(pathToFileURL("C:/work/zumruduanka/tools/serve.js").href);
const server = await startServer("C:/work");
const browser = await chromium.launch({args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"]});
const page = await browser.newPage({viewport: {width: 1280, height: 720}});
page.on("pageerror", e => console.error("SAYFA HATASI", e.message)); page.on("console", m => { if (m.type() === "error") console.error("KONSOL", m.text()); });
await page.goto(server.url + "/zumruduanka/out/tur5/tasarim/iskelet/olc.html", {waitUntil: "domcontentloaded"});
await page.waitForFunction(() => window.ok === true, null, {timeout: 30000});
const r = await page.evaluate(async () => {
  await window.loadFonts(15000);
  const THREE = window.THREE, out = {};
  let t = performance.now(); const ab = await (await fetch("/karakter/cikti/karakter.vrm")).arrayBuffer(); out.fetch_ms = +(performance.now() - t).toFixed(0);
  t = performance.now(); const gltf = await new Promise((res, rej) => new window.GLTFLoader().parse(ab, "", res, rej)); out.parse_ms = +(performance.now() - t).toFixed(0);
  const root = gltf.scene, meshes = []; root.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
  // tek iskelet: hepsi aynı kemik listesi; ilk ağın iskeletine bağla
  const sk = meshes[0].skeleton; meshes.forEach(m => { m.bind(sk, m.bindMatrix); m.frustumCulled = false; });
  out.mesh = meshes.length; out.tex = gltf.parser.json.textures.length;
  const sim = window.sim = window.createSim({canvas: document.getElementById("gl"), audioContext: new OfflineAudioContext(2, 44100 * 2, 44100), manual: true, seed: 1});
  sim.setCamera("director"); const p = sim.load(window.findSong("dagkrali")); await sim.whenReady();
  const holder = new THREE.Group(); holder.position.set(0.2, -0.95, -0.19); holder.rotation.y = Math.PI; holder.add(root); sim.scene.add(holder);
  const f = sim.FIG.claude, hideMan = () => { f.g.visible = false; f.arms.forEach(a => { a.up.visible = a.fo.visible = a.el.visible = false; }); f.hands.forEach(h => { h.visible = false; }); };
  const gl = sim.renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  // çekimler: bir yakın (yüz) ve bir geniş
  const close = p.shots.find(s => s.kind === "close" && s.end - s.t > 1), wide = p.shots.find(s => s.cam === "wide" || s.cam === "dolly") || p.shots[0];
  out.close = close && [close.t, close.end]; out.wide = wide && [wide.t, wide.end];
  const frame = (tt, B) => { holder.visible = B; sim.update(tt, tt); if (B) hideMan(); sim.render(); sync(); };
  sync(); t = performance.now(); frame(close.t + 0.2, true); out.ilkKare_ms = +(performance.now() - t).toFixed(0);
  t = performance.now(); frame(close.t + 0.2, true); out.ikinciKare_ms = +(performance.now() - t).toFixed(0);
  const R = {}; for (const [ad, sh] of [["yakin", close], ["genis", wide]]) for (const blk of ["A", "B", "A", "B"]){
    const ms = []; for (let k = 0; k < 12; k++){ const tt = sh.t + 0.1 + k / 30, a = performance.now(); frame(tt, blk === "B"); ms.push(performance.now() - a); }
    ms.sort((x, y) => x - y); (R[ad + blk] = R[ad + blk] || []).push(+ms[ms.length >> 1].toFixed(1)); }
  out.kare = R;
  // B karesinin ekran görüntüsü (yakın) — göz kontrolü için
  frame(close.t + 0.5, true); out.png = sim.canvas.toDataURL("image/png");
  const pm = performance.memory; out.heapMB = pm ? +(pm.usedJSHeapSize / 1048576).toFixed(0) : null;
  return out;
});
const fs = await import("node:fs");
fs.writeFileSync("C:/work/zumruduanka/out/tur5/tasarim/iskelet/tarayici-yakin.png", Buffer.from(r.png.split(",")[1], "base64")); delete r.png;
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
for (const ad of ["yakin", "genis"]) r[ad + "_fark_yuzde"] = +(100 * (avg(r.kare[ad + "B"]) / avg(r.kare[ad + "A"]) - 1)).toFixed(1);
console.log(JSON.stringify(r, null, 1));
await browser.close(); server.close();
