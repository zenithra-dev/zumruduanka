// Zümrüdüanka simülasyonu: grup, sahne, ses ve kamera tek bir API arkasında.
//
//   const sim = createSim({canvas, audioContext?, seed?, manual?});
//   sim.load(sim.songs[0]);          // şarkıyı ses motoruna programlar, yönetmen çekim listesini çıkarır
//   sim.frame(now, wall);            // o ana göre sahneyi günceller ve çizer
//   sim.composite(ctx2d, 1280, 720); // kareyi grup adı, şarkı, söz ve HUD ile 2B tuvale basar
//
// Tarayıcıda now = audio.ctx.currentTime, wall = performance.now()/1000; render aracında ikisi de kare zamanı.
// manual: true → şarkı sonunda kendiliğinden durmaz, grup kamerası kendi kendine salınmaz (araç yönetir).
import * as THREE from "three";
import { seed as seedRng } from "./rng.js";
import { STR_Z, fingerX, stringY } from "./music/theory.js";
import { SONGS, findSong } from "./band/songs/index.js";
import { MEMBER, BIO, BAND_NAME } from "./band/members.js";
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
import { schedule, release } from "./audio/playback.js";

export { SONGS, findSong, MEMBER, BIO, BAND_NAME, ENVS, AMPS };

const CAM_LABEL = {head: "SAP KAMERASI", stage: "SAHNE", group: "GRUP", director: "YÖNETMEN"};

export function createSim(opts = {}){
  const { canvas, audioContext = null, seed = 1, manual = false } = opts;
  if (!canvas) throw new Error("createSim: canvas gerekli");
  seedRng(seed);

  const S = createScene(canvas);
  const model = createGuitarModel(S.scene);
  const bannerKit = createBanner(S.scene);
  const rigs = createRigs({scene: S.scene, model, riser: S.riser, hemi: S.hemi, drawBanner: bannerKit.drawBanner});
  const fx = createFx(S.scene);
  const prefs = {amp: "crunch", room: 1.4, volume: 0.75};
  let engine = null, inst = null;
  const venues = createVenues({scene: S.scene, hemi: S.hemi, key: S.key, floor: S.floor, banner: bannerKit.banner, clubItems: [S.back, S.ampG, S.truss],
    onRoom(sec){ prefs.room = sec; if (engine) engine.setRoom(sec); }});
  const crowd = createCrowd(S.scene);
  const director = createDirector({FIG: rigs.FIG, groupCam: S.groupCam});
  const reduceMotion = !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  let camMode = "head", bandOn = true, current = SONGS[0], playing = null, lyric = null;

  function roster(){ const sg = playing ? playing.song : current; return bandOn ? (sg.members || ["claude"]) : ["claude"]; }
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
    playing = schedule(song, {engine, inst, bandOn});
    playing.shots = director.planShots(playing, 60 / playing.bpm, playing.t0, roster());
    return playing;
  }
  // O anki söz satırı: hece hece, söylenmiş olanlar işaretli
  function lyricAt(now){
    const ph = playing && playing.band && playing.phr ? playing.phr.find(q => now >= q.t && now < q.end) : null;
    if (!ph) return null;
    const toks = ph.line.split(/([ -])/); let si = 0; const out = [];
    toks.forEach(tk => { if (tk === "-") return; if (tk === " "){ out.push({t: " ", on: false}); return; } out.push({t: tk, on: now >= ph.starts[si]}); si++; });
    return out;
  }

  function update(now, wall){
    if (wall === undefined) wall = now;
    const act = [null,null,null,null,null,null];
    if (playing){
      while (playing.di < playing.drumEv.length && playing.drumEv[playing.di].t <= now){ const d = playing.drumEv[playing.di++]; playing.lastHit[d.k] = d.t; }
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
    if (camMode === "director") director.direct(now, wall, playing);
    else if (camMode === "group" && !manual){
      S.groupCam.position.set(0.15 + 0.45 * Math.sin(wall * 0.12), 0.8, 4.4 + 0.25 * Math.sin(wall * 0.09));
      S.groupCam.lookAt(0, -0.05, -0.8);
    }
    rigs.applyRoster(roster(), camMode === "head");
    lyric = lyricAt(now);
  }
  function activeCam(){ return camMode === "head" ? S.headCam : (camMode === "group" || camMode === "director") ? S.groupCam : S.stageCam; }
  function render(){
    const cam = activeCam();
    if (S.composer){ S.renderPass.camera = cam; S.bloomPass.strength = 0.42 + (playing && playing.band ? 0.2 * rigs.flash : 0); S.composer.render(); }
    else S.renderer.render(S.scene, cam);
  }
  function hudLabel(){
    const cam = CAM_LABEL[camMode] || "SAHNE";
    return `${sim.recording ? "REC · " : ""}${cam} · ${playing ? BAND_NAME + " çalıyor: " + playing.song.name + (playing.band ? "" : " · sadece gitar") : "hazır"}`;
  }
  // Kayıt/video karesi: 3B görüntü + alt bant (grup, şarkı, kadro), söz satırı ve HUD. Yerleşim 1280×720 için ayarlı.
  function composite(g, W = 1280, H = 720){
    g.drawImage(canvas, 0, 0, W, H);
    const grd = g.createLinearGradient(0, 600, 0, 720); grd.addColorStop(0, "rgba(10,7,5,0)"); grd.addColorStop(1, "rgba(10,7,5,.7)");
    g.fillStyle = grd; g.fillRect(0, 600, 1280, 120);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillStyle = "#ffc27a"; g.font = "800 46px 'Big Shoulders Display', Impact, sans-serif"; g.fillText(BAND_NAME, 40, 672);
    g.fillStyle = "#f4ece2"; g.font = "500 20px 'JetBrains Mono', monospace"; g.fillText((playing ? playing.song.name : current.name) + "  ·  " + roster().map(k => MEMBER[k].label).join(" · "), 40, 702);
    if (lyric){ g.font = "600 34px Figtree, system-ui, sans-serif"; g.textBaseline = "middle"; g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 8;
      const Wt = lyric.reduce((w, x) => w + g.measureText(x.t).width, 0); let x = 640 - Wt / 2;
      lyric.forEach(pc => { g.fillStyle = pc.on ? "#7cf0b8" : "#f4ece2"; g.fillText(pc.t, x, 590); x += g.measureText(pc.t).width; }); g.shadowBlur = 0; }
    g.fillStyle = "#f05a5a"; g.beginPath(); g.arc(34, 34, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f4ece2"; g.font = "500 20px JetBrains Mono, monospace"; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(hudLabel(), 52, 35);
  }
  function resize(w, h){
    if (w === undefined){ const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; }
    S.setSize(Math.max(1, w), Math.max(1, h));
  }

  const sim = {
    THREE, canvas, scene: S.scene, renderer: S.renderer,
    cams: {head: S.headCam, stage: S.stageCam, group: S.groupCam}, orbit: S.orbit,
    songs: SONGS, findSong, members: MEMBER, bios: BIO, bandName: BAND_NAME, envs: ENVS, amps: AMPS,
    model, rigs, fx, venues, crowd, director, FIG: rigs.FIG,
    manual, seed, recording: false, onEnd: null,
    get playing(){ return playing; },
    get current(){ return current; }, set current(s){ current = s; },
    get camMode(){ return camMode; }, setCamera(m){ camMode = m; },
    get envName(){ return venues.envName; }, setEnv(n){ venues.setEnv(n); },
    get ampName(){ return prefs.amp; }, setAmp(n){ prefs.amp = n; if (engine) engine.setAmp(n); },
    get volume(){ return prefs.volume; }, setVolume(v){ prefs.volume = v; if (engine) engine.setVolume(v); },
    get bandOn(){ return bandOn; }, set bandOn(v){ bandOn = !!v; },
    get audio(){ return engine; },
    get lyric(){ return lyric; },
    ensureAudio, load, stop, roster, lyricAt, update, render, frame(now, wall){ update(now, wall); render(); },
    resize, hudLabel, composite, placeCams(){ S.placeCams(model); }
  };
  venues.setEnv("club");
  S.placeCams(model);
  resize();
  if (typeof document !== "undefined" && document.fonts && document.fonts.ready) document.fonts.ready.then(() => rigs.invalidateBanner());
  return sim;
}
