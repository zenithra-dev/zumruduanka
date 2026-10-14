// Zümrüdüanka simülasyonu: Claude, elektro gitarı, sahne, ses ve kamera tek bir API arkasında.
//
//   const sim = createSim({canvas, audioContext?, seed?, manual?});
//   sim.load("kaf");                 // şarkıyı ses motoruna programlar, yönetmen çekim listesini çıkarır
//   sim.frame(now, wall);            // o ana göre sahneyi günceller ve çizer
//   sim.composite(ctx2d, 1280, 720); // kareyi grup adı, şarkı ve HUD ile 2B tuvale basar (önizleme/kayıt)
//   sim.composite(ctx2d, 1280, 720, {broadcast: true, t}); // yayın karesi: HUD yok, alt bant yalnız ilk çekimde, açılış/kapanış kararması
//
// Tarayıcıda now = audio.ctx.currentTime, wall = performance.now()/1000; render aracında ikisi de kare zamanı.
// manual: true → şarkı sonunda kendiliğinden durmaz (araç yönetir).
import * as THREE from "three";
import { seed as seedRng } from "./rng.js";
import { STR_Z, fingerX, stringY } from "./music/theory.js";
import { SONGS, findSong } from "./band/songs/index.js";
import { MEMBER, BAND_NAME } from "./band/members.js";
import { createScene } from "./stage/scene.js";
import { createGuitarModel } from "./stage/guitar-model.js";
import { createBanner } from "./stage/banner.js";
import { createRigs } from "./stage/rigs.js";
import { createFx } from "./stage/fx.js";
import { createVenues, ENVS } from "./stage/venues.js";
import { createCrowd } from "./stage/crowd.js";
import { createDirector } from "./camera/director.js";
import { createEngine, AMPS } from "./audio/engine.js";
import { createInstruments } from "./audio/instruments.js";
import { schedule, release, songLength } from "./audio/playback.js";

export { SONGS, findSong, MEMBER, BAND_NAME, ENVS, AMPS, songLength };

const CAM_LABEL = {head: "SAP KAMERASI", stage: "SAHNE", group: "GRUP", director: "YÖNETMEN"};
// Yayın çıktısı (sn): siyahtan açılış, şarkı bitişinden (playing.end) sonra video kuyruğu, sona doğru kararma ve en sonda tam siyah
export const VIDEO = {fadeIn: 0.5, tail: 1.0, fadeOut: 1.5, hold: 0.1};
const ease = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export function createSim(opts = {}){
  const { canvas, audioContext = null, seed = 1, manual = false } = opts;
  if (!canvas) throw new Error("createSim: canvas gerekli");
  seedRng(seed);

  const S = createScene(canvas);
  const model = createGuitarModel(S.scene);
  const bannerKit = createBanner(S.scene);
  const rigs = createRigs({scene: S.scene, model, hemi: S.hemi, drawBanner: bannerKit.drawBanner});
  const fx = createFx(S.scene);
  const prefs = {amp: "crunch", room: 1.4, volume: 0.75};
  let engine = null, inst = null;
  const venues = createVenues({scene: S.scene, hemi: S.hemi, key: S.key, floor: S.floor, banner: bannerKit.banner, clubItems: [S.back, S.ampG, S.truss],
    onRoom(sec){ prefs.room = sec; if (engine) engine.setRoom(sec); }});
  const crowd = createCrowd(S.scene);
  const director = createDirector({FIG: rigs.FIG, groupCam: S.groupCam, orbit: S.orbit, placeCams: () => S.placeCams(model)});
  const reduceMotion = !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  let camMode = "director", current = SONGS[0], playing = null, lastNow = 0;

  function roster(){ return ["claude"]; }
  function ensureAudio(){
    if (engine){
      if (engine.ctx.state === "suspended"){ const p = engine.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      return engine;
    }
    const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    engine = createEngine(ctx, prefs); inst = createInstruments(engine);
    return engine;
  }
  function stop(){ if (!playing) return; const p = playing; playing = null; if (engine) release(p, engine.ctx); }
  function load(song){
    if (typeof song !== "object") song = findSong(song);
    if (!song) throw new Error("Şarkı bulunamadı");
    ensureAudio(); stop(); current = song;
    if (song.amp) sim.setAmp(song.amp);
    playing = schedule(song, {engine, inst});
    playing.shots = director.planShots(playing, 60 / playing.bpm, playing.t0);
    return playing;
  }
  function headCamOn(){ return camMode === "head" || (camMode === "director" && director.cam === "head"); }

  function update(now, wall){
    if (wall === undefined) wall = now;
    lastNow = now;
    const act = [null,null,null,null,null,null];
    if (playing){
      for (const e of playing.events) if (now >= e.t && now < e.end) act[e.s] = e;
      if (!manual && now > playing.end){ stop(); if (sim.onEnd) sim.onEnd(); }
    }
    const { strings, layoutString, fingers, pick, recLed } = model;
    for (let s = 0; s < 6; s++){
      const e = act[s], st = strings[s];
      if (e){
        const age = now - e.t, amp = reduceMotion ? 0.0006 : 0.0022 * Math.exp(-age * 2.5) + 0.0004;
        layoutString(s, e.f, amp, wall * 70 + s);
        st.mat.color.setHex(0xffc27a);
        if (e.f > 0){ fingers[s].visible = true; fingers[s].position.set(fingerX(e.f), stringY(s, fingerX(e.f)), STR_Z + 0.004); }
        else fingers[s].visible = false;
      } else {
        if (st.wasActive) layoutString(s, 0, 0, 0);
        st.mat.color.copy(st.base); fingers[s].visible = false;
      }
      st.wasActive = !!e;
    }
    // Pena: son vurulan tele, bir önceki telden zamanla kayarak gider (kare sırasından bağımsız; olaylar zamana göre sıralı)
    let lastPick = null, prevPick = null;
    if (playing) for (const e of playing.events){ if (e.t > now) break; prevPick = lastPick; lastPick = e; }
    if (lastPick){
      const ty = stringY(lastPick.s, 0.575) - 0.004, age = now - lastPick.t;
      const y0 = prevPick ? stringY(prevPick.s, 0.575) - 0.004 : ty;
      pick.position.y = y0 + (ty - y0) * (1 - Math.pow(2, -age * 30));
      pick.position.z = STR_Z + 0.004 + Math.min(age * 0.03, 0.006);
    }
    if (sim.recording) recLed.material.color.setHex(Math.floor(wall * 2) % 2 ? 0xff2a2a : 0x661111);
    rigs.updateBand(now, wall, playing, venues.current.hemi[2]);
    fx.update(now, wall, playing);
    venues.updateEnv(wall);
    crowd.update(now, wall, playing, venues.envName);
    if (camMode === "director") director.direct(now, wall, playing, roster());
    else if (camMode === "group"){
      S.groupCam.position.set(0.15 + 0.45 * Math.sin(wall * 0.12), 0.8, 4.4 + 0.25 * Math.sin(wall * 0.09));
      S.groupCam.lookAt(0, -0.05, -0.8);
    }
    rigs.applyRoster(roster(), headCamOn());
  }
  function activeCam(){
    const m = camMode === "director" ? director.cam : camMode;
    return m === "head" ? S.headCam : m === "stage" ? S.stageCam : S.groupCam;
  }
  function render(){
    const cam = activeCam();
    if (S.composer){ S.renderPass.camera = cam; S.bloomPass.strength = 0.42 + (playing ? 0.2 * rigs.flash : 0); S.composer.render(); }
    else S.renderer.render(S.scene, cam);
  }
  function hudLabel(){
    const cam = CAM_LABEL[camMode] || "SAHNE";
    return `${sim.recording ? "REC · " : ""}${cam} · ${playing ? BAND_NAME + " çalıyor: " + playing.song.name : "hazır"}`;
  }
  function subtitle(){ return (playing ? playing.song.name : current.name) + "  ·  " + roster().map(k => MEMBER[k].label).join(" · "); }
  function videoEnd(){ return playing ? playing.end + VIDEO.tail : 0; }
  // Yayın örtüleri, t'nin saf fonksiyonu: alt bant ilk çekimin içinde girip çıkar (band 0..1), dark siyaha kararma oranı
  function overlayAt(t){
    if (!playing) return {band: 0, dark: 0};
    const sh = playing.shots && playing.shots[0], a = sh ? sh.t : playing.t0, b = sh ? Math.min(sh.end, playing.end) : a + 6;
    const band = ease((t - a - 0.5) / 0.6) * ease((b - 0.3 - t) / 0.5);
    return {band, dark: 1 - ease(t / VIDEO.fadeIn) * ease((videoEnd() - VIDEO.hold - t) / VIDEO.fadeOut)};
  }
  function drawBroadcast(g, t){
    const {band, dark} = overlayAt(t);
    if (band > 0.002){
      g.globalAlpha = band;
      const grd = g.createLinearGradient(0, 580, 0, 720); grd.addColorStop(0, "rgba(10,7,5,0)"); grd.addColorStop(1, "rgba(10,7,5,.72)");
      g.fillStyle = grd; g.fillRect(0, 580, 1280, 140);
      const x = 64 - 28 * (1 - band);   // başlık güvenli alanı (64 px); soldan kayarak gelir, aynı yoldan gider
      g.fillStyle = "#ffc27a"; g.fillRect(x, 606, 4, 72);
      g.textAlign = "left"; g.textBaseline = "alphabetic";
      g.font = "800 44px 'Big Shoulders Display', Impact, sans-serif"; g.fillText(BAND_NAME, x + 18, 646);
      g.fillStyle = "#f4ece2"; g.font = "500 19px 'JetBrains Mono', monospace"; g.fillText(subtitle(), x + 18, 674);
      g.globalAlpha = 1;
    }
    if (dark > 0.002){ g.fillStyle = `rgba(0,0,0,${Math.min(1, dark).toFixed(4)})`; g.fillRect(0, 0, 1280, 720); }
  }
  // Kayıt/video karesi: 3B görüntü + alt bant (sahne adı, şarkı, çalan). 1280×720 için tasarlandı, başka boyuta ölçeklenir.
  // Varsayılan önizleme görünümü (sabit alt bant + geliştirme HUD'u); {broadcast: true, t} yayın görünümü (render aracı).
  function composite(g, W = 1280, H = 720, o = {}){
    g.save(); g.scale(W / 1280, H / 720);
    g.drawImage(canvas, 0, 0, 1280, 720);
    if (o.broadcast){ drawBroadcast(g, o.t === undefined ? lastNow : o.t); g.restore(); return; }
    const grd = g.createLinearGradient(0, 600, 0, 720); grd.addColorStop(0, "rgba(10,7,5,0)"); grd.addColorStop(1, "rgba(10,7,5,.7)");
    g.fillStyle = grd; g.fillRect(0, 600, 1280, 120);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "#ffc27a"; g.font = "800 46px 'Big Shoulders Display', Impact, sans-serif"; g.fillText(BAND_NAME, 40, 672);
    g.fillStyle = "#f4ece2"; g.font = "500 20px 'JetBrains Mono', monospace"; g.fillText(subtitle(), 40, 702);
    g.fillStyle = "#f05a5a"; g.beginPath(); g.arc(34, 34, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f4ece2"; g.font = "500 20px JetBrains Mono, monospace"; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(hudLabel(), 52, 35);
    g.restore();
  }
  function resize(w, h){
    if (w === undefined){ const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; }
    S.setSize(Math.max(1, w), Math.max(1, h));
  }

  const sim = {
    THREE, canvas, scene: S.scene, renderer: S.renderer,
    cams: {head: S.headCam, stage: S.stageCam, group: S.groupCam}, orbit: S.orbit,
    songs: SONGS, findSong, members: MEMBER, bandName: BAND_NAME, envs: ENVS, amps: AMPS,
    model, rigs, fx, venues, crowd, director, FIG: rigs.FIG,
    manual, seed, recording: false, onEnd: null,
    get playing(){ return playing; },
    get current(){ return current; }, set current(s){ current = s; },
    get camMode(){ return camMode; }, setCamera(m){ camMode = m; },
    get envName(){ return venues.envName; }, setEnv(n){ venues.setEnv(n); },
    get ampName(){ return prefs.amp; }, setAmp(n){ prefs.amp = n; if (engine) engine.setAmp(n); },
    get volume(){ return prefs.volume; }, setVolume(v){ prefs.volume = v; if (engine) engine.setVolume(v); },
    get audio(){ return engine; },
    songLength(song){ if (typeof song !== "object") song = findSong(song); return songLength(song); },
    ensureAudio, load, stop, roster, update, render, frame(now, wall){ update(now, wall); render(); },
    resize, hudLabel, composite, overlayAt, videoEnd, placeCams(){ S.placeCams(model); }
  };
  venues.setEnv("club");
  S.placeCams(model);
  resize();
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) document.fonts.ready.then(() => rigs.invalidateBanner());
  return sim;
}
