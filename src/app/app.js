// Önizleme sayfası: simülasyonu tarayıcıda sürer, kontrolleri bağlar, tab şeridini ve kaydı yönetir.
import { createSim } from "../sim/sim.js";
import { NAMES } from "../sim/music/theory.js";

const $ = id => document.getElementById(id);
const gl = $("gl");
// Tohum: ?seed=5 ile sabitlenebilir; verilmezse her açılışta farklı (doğaçlama her seferinde yeni).
const seed = +(new URLSearchParams(location.search).get("seed") || (Date.now() >>> 0));
const sim = createSim({canvas: gl, seed});
window.sim = sim;
const { songs: SONGS, members: MEMBER, bios: BIO } = sim;

/* ---------- HUD ---------- */
const hudText = $("hudText"), hudDot = $("hudDot");
let hudCache = null, recording = false;
function refreshHud(){ const t = sim.hudLabel(); if (t !== hudCache){ hudCache = t; hudText.textContent = t; } hudDot.hidden = !recording; }

/* ---------- Tab şeridi ---------- */
const tabCv = $("tab"), tg = tabCv.getContext("2d");
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function drawTab(g, W, H, now, colors){
  g.clearRect(0, 0, W, H);
  const padL = 34 * (W / 1000 > 1 ? W / 1000 : 1), top = H * 0.16, gap = (H * 0.72) / 5;
  const px = W * 0.2, span = 5, pxPerSec = (W - padL) / span;
  g.font = `500 ${Math.round(gap * 0.62)}px ${cssVar("--f-mono") || "monospace"}`;
  g.textAlign = "center"; g.textBaseline = "middle";
  for (let i = 0; i < 6; i++){
    const y = top + i * gap;
    g.fillStyle = colors.muted; g.fillText(NAMES[5 - i], padL * 0.45, y);
    g.strokeStyle = colors.line; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, y); g.lineTo(W, y); g.stroke();
  }
  g.strokeStyle = colors.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(px, top - gap * 0.6); g.lineTo(px, top + gap * 5.6); g.stroke();
  const p = sim.playing;
  if (!p){ g.fillStyle = colors.muted; g.textAlign = "left"; g.fillText("Bir şarkı seç ve Çal'a bas", px + 14, top + gap * 2.5); return; }
  for (const e of p.events){
    const x = px + (e.t - now) * pxPerSec;
    if (x < padL - 20 || x > W + 20) continue;
    const y = top + (5 - e.s) * gap, active = now >= e.t && now < e.end;
    const label = String(e.f), w = gap * (label.length > 1 ? 1.15 : 0.8);
    g.fillStyle = active ? colors.accent : colors.surface; g.fillRect(x - w/2, y - gap * 0.42, w, gap * 0.84);
    g.fillStyle = active ? colors.accentFg : colors.fg; g.fillText(label, x, y + 1);
  }
}

/* ---------- Sözler ---------- */
const lyricEl = $("lyric"); let lyricKey = "";
function drawLyricDom(){
  const toks = sim.lyric, key = toks ? toks.map(x => (x.on ? "1" : "0") + x.t).join("") : "";
  if (key === lyricKey) return;
  lyricKey = key; lyricEl.textContent = "";
  (toks || []).forEach(x => { const sp = document.createElement("span"); sp.textContent = x.t; if (x.on) sp.className = "on"; lyricEl.appendChild(sp); });
}

/* ---------- Kayıt ---------- */
const recCv = document.createElement("canvas"); recCv.width = 1280; recCv.height = 720;
const rg = recCv.getContext("2d");
let recorder = null, recChunks = [], recBlob = null, recExt = "webm";
const recBtn = $("recBtn"), recNote = $("recNote");
const clip = $("clip"), clipVideo = $("clipVideo"), saveBtn = $("saveBtn");
function pickMime(){
  const opts = [["video/webm;codecs=vp9,opus","webm"],["video/webm;codecs=vp8,opus","webm"],["video/webm","webm"],["video/mp4","mp4"]];
  if (!window.MediaRecorder) return null;
  for (const [m, ext] of opts) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return {m, ext};
  return {m: "", ext: "webm"};
}
function startRecording(){
  const mime = pickMime();
  if (!mime || !recCv.captureStream){ recNote.textContent = "Bu tarayıcı video kaydını desteklemiyor. Chrome, Edge veya Firefox ile dene."; return; }
  startPlay(sim.current);
  const audioTracks = sim.audio.recDest ? sim.audio.recDest.stream.getAudioTracks() : [];
  const stream = new MediaStream([...recCv.captureStream(30).getVideoTracks(), ...audioTracks]);
  try { recorder = new MediaRecorder(stream, mime.m ? {mimeType: mime.m, videoBitsPerSecond: 6e6} : undefined); }
  catch(e){ recNote.textContent = "Kayıt başlatılamadı: " + e.message; return; }
  recExt = mime.ext; recChunks = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => {
    recording = false; sim.recording = false; sim.model.recLed.material.color.setHex(0x441111);
    recBlob = new Blob(recChunks, {type: recorder.mimeType || "video/webm"});
    try { clipVideo.src = URL.createObjectURL(recBlob); } catch(e){}
    clip.hidden = false;
    recBtn.textContent = "● Çal ve kaydet"; recBtn.disabled = false;
    recNote.textContent = `Kayıt hazır: ${(recBlob.size / 1048576).toFixed(1)} MB ${recExt.toUpperCase()}.`;
    refreshHud();
  };
  recorder.start(250); recording = true; sim.recording = true;
  sim.model.recLed.material.color.setHex(0xff2a2a);
  recBtn.textContent = "■ Kaydı bitir"; recNote.textContent = "Kaydediliyor… Şarkı bitince kayıt kendiliğinden durur.";
  refreshHud();
}
function stopRecording(){ if (recorder && recorder.state !== "inactive") recorder.stop(); }
recBtn.addEventListener("click", () => recording ? (sim.stop(), stopRecording()) : startRecording());
sim.onEnd = () => { if (recording) setTimeout(stopRecording, 900); };

let downloads = null;
if (window.claude && typeof window.claude.use === "function"){
  window.claude.use("downloads").then(d => { downloads = d; }).catch(() => {});
}
saveBtn.addEventListener("click", async () => {
  if (!recBlob) return;
  const name = `claude-gitar-${sim.current.id}.${recExt}`;
  if (downloads){
    try { await downloads.save({filename: name, data: recBlob}); recNote.textContent = "Video indirildi."; }
    catch(e){ recNote.textContent = e && e.code === "declined" ? "İndirme iptal edildi." : "Video bu görünümde indirilemiyor. Önizlemedeki oynatıcıdan izleyebilirsin."; }
  } else {
    recNote.textContent = "İndirme bu görünümde kullanılamıyor. Önizlemedeki oynatıcıdan izleyebilirsin.";
  }
});

/* ---------- Arayüz ---------- */
function refreshAmp(){ document.querySelectorAll("#ampSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === sim.ampName ? "true" : "false")); }
function selectAmp(n){ sim.setAmp(n); refreshAmp(); }
function startPlay(song){ sim.load(song); refreshAmp(); refreshHud(); }
const songsEl = $("songs");
SONGS.forEach(s => {
  const b = document.createElement("button");
  b.className = "song"; b.id = "song-" + s.id; b.setAttribute("aria-pressed", s === sim.current ? "true" : "false");
  b.innerHTML = `<b></b><span></span>`; b.querySelector("b").textContent = s.name; b.querySelector("span").textContent = s.desc;
  b.addEventListener("click", () => {
    sim.current = s;
    songsEl.querySelectorAll(".song").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    if (s.amp) selectAmp(s.amp);
    if (sim.playing && !recording) startPlay(s);
    refreshHud();
  });
  songsEl.appendChild(b);
});
$("play").addEventListener("click", () => startPlay(sim.current));
$("stop").addEventListener("click", () => { sim.stop(); if (recording) stopRecording(); refreshHud(); });
document.querySelectorAll("#ampSeg button").forEach(b => b.addEventListener("click", () => selectAmp(b.dataset.v)));
document.querySelectorAll("#bandSeg button").forEach(b => b.addEventListener("click", () => {
  sim.bandOn = b.dataset.v === "on";
  document.querySelectorAll("#bandSeg button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
}));
document.querySelectorAll("#envSeg button").forEach(b => b.addEventListener("click", () => {
  sim.setEnv(b.dataset.v);
  document.querySelectorAll("#envSeg button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
}));
const camNote = $("camNote");
const CAM_NOTE = {head: "Kamera gitarın sap kafasına kıskaçla takılı, perdelere bakıyor.", stage: "Gitara yakın çekim: sürükleyerek etrafında dön, tekerlekle yakınlaş.", group: "Geniş açı: Zümrüdüanka sahnede. Kadro şarkıya göre değişir.", director: "Otomatik yönetmen: vokalde Şahmeran'a, gitar anında Claude'a, davul geçişinde Erlik'e keser."};
document.querySelectorAll("#camSeg button").forEach(b => b.addEventListener("click", () => {
  sim.setCamera(b.dataset.v);
  document.querySelectorAll("#camSeg button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  camNote.textContent = CAM_NOTE[sim.camMode];
  gl.style.cursor = sim.camMode === "stage" ? "grab" : "default";
  refreshHud();
}));
const vol = $("vol");
const setVol = () => sim.setVolume(vol.value / 100);
vol.addEventListener("input", setVol); setVol();

// Sahne kamerası: sürükle-döndür, tekerlek-yaklaş
let drag = null;
gl.addEventListener("pointerdown", e => { if (sim.camMode !== "stage") return; drag = {x: e.clientX, y: e.clientY}; gl.setPointerCapture(e.pointerId); gl.style.cursor = "grabbing"; });
gl.addEventListener("pointermove", e => {
  if (!drag) return;
  const o = sim.orbit;
  o.theta -= (e.clientX - drag.x) * 0.006;
  o.phi = Math.min(Math.max(o.phi + (e.clientY - drag.y) * 0.006, 0.45), 1.75);
  drag = {x: e.clientX, y: e.clientY}; sim.placeCams();
});
const endDrag = () => { drag = null; gl.style.cursor = sim.camMode === "stage" ? "grab" : "default"; };
gl.addEventListener("pointerup", endDrag); gl.addEventListener("pointercancel", endDrag);
gl.addEventListener("wheel", e => { if (sim.camMode !== "stage") return; e.preventDefault(); const o = sim.orbit; o.r = Math.min(Math.max(o.r * (1 + e.deltaY * 0.001), 0.45), 2.2); sim.placeCams(); }, {passive: false});

/* ---------- Grup kartları ve şarkı listesi ---------- */
(function(){
  const cards = $("cards"), disco = $("disco");
  Object.keys(MEMBER).forEach(k => {
    const c = document.createElement("div"); c.className = "card";
    const who = document.createElement("div"); who.className = "who";
    const sw = document.createElement("span"); sw.className = "sw"; sw.style.background = BIO[k][0];
    const nm = document.createElement("b"); nm.textContent = MEMBER[k].name;
    who.append(sw, nm);
    const role = document.createElement("div"); role.className = "role"; role.textContent = MEMBER[k].role;
    const bio = document.createElement("p"); bio.textContent = BIO[k][1];
    const inn = document.createElement("div"); inn.className = "in";
    inn.textContent = "Çaldığı şarkılar: " + SONGS.filter(sg => (sg.members || []).includes(k)).map(sg => sg.name).join(", ");
    c.append(who, role, bio, inn); cards.appendChild(c);
  });
  SONGS.forEach(sg => {
    const r = document.createElement("div"), a = document.createElement("b"), b = document.createElement("span");
    a.textContent = sg.name; b.textContent = (sg.members || ["claude"]).map(k => MEMBER[k].label).join(" · ");
    r.append(a, b); disco.appendChild(r);
  });
})();

/* ---------- Döngü ---------- */
let colors = null;
function readColors(){ colors = {fg: cssVar("--fg"), muted: cssVar("--muted"), line: cssVar("--line"), accent: cssVar("--accent"), accentFg: cssVar("--accent-fg"), surface: cssVar("--surface")}; }
readColors();
if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);
new MutationObserver(readColors).observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
function resize(){
  sim.resize();
  const t = tabCv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  tabCv.width = Math.round(t.width * dpr); tabCv.height = Math.round(t.height * dpr);
}
window.addEventListener("resize", resize);
resize();
function loop(){
  const a = sim.audio, now = a ? a.ctx.currentTime : 0, wall = performance.now() / 1000;
  sim.frame(now, wall);
  drawTab(tg, tabCv.width, tabCv.height, now, colors);
  drawLyricDom();
  if (recording) sim.composite(rg, 1280, 720);
  refreshHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
