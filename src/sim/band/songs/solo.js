// Küllerinden: modern blues-rock solosu, C# minör, 80 BPM, üçlemeli shuffle (12/8 hissi), lead ton. Tek motif (C#'yi D#'ye büküp bırakan çağrı)
// küllerden doğar: alçak riff, motif ve çift notalı cevabı, tırmanış, oktav yukarıda doruk ve şelale, alçak registerda kısık dönüş, korda sönen son.
import { chord } from "../../music/theory.js";

export default {id: "solo", name: "Küllerinden", desc: "Modern blues-rock solosu · C# minör, shuffle · bükmeler, çift notalar, şelale · 80 BPM", amp: "lead",
  build(){
    const ev = [], T = 1 / 3;
    // Akorlar lead tonda çamurlaşmasın diye kalın tellerde beşli+oktav (C#5, A5, B5, F#5; üçlüyü ezgi söyler), B cevaplardan sonra
    // ince tellerde üçlü (Bh, dönüşte Bl), G#7 tritonsuz (G# D# B#), son akor beşli+oktav (C#5)
    const Cs = [null, 4, 6, 6], Csh = [9, 11, 11], A5 = [5, 7, 7], B5 = [7, 9, 9], Bh = [null, null, null, 11, 12, 11], Bl = [null, null, null, 4, 4, 2],
          Fm = [null, 9, 11, 11], Fm2 = [null, 9, 11], G7 = [null, 11, 13, null, 13], C5 = [null, 4, 6, 6, null, 4];
    let b = 0;
    // lay: her vuruşun üçüncü üçlemesi 0.02 vuruş geride (shuffle'ın gevşek oturuşu, sabit); altılık koşular düz kalır
    const lay = x => { const q = Math.round(x * 3); return Math.abs(x * 3 - q) < 1e-6 && q % 3 === 2 ? x + 0.02 : x; };
    // at: ölçü ve üçleme konumu; n: tek nota (süre üçleme sayısı); ds: iki telde çift nota (g: tel aralığı, 2 = G-e altılısı); pc: akor; r: es
    const at = (bar, k = 0) => { b = bar * 4 + k * T; };
    const n = (s, f, k, o) => { ev.push({b: k < 1 ? b : lay(b), s, f, d: k * T * 0.96, ...o}); b += k * T; };
    const ds = (s, f1, f2, k, o, g = 1) => { const t = lay(b); ev.push({b: t, s, f: f1, d: k * T * 0.96, ...o}, {b: t + 0.02, s: s + g, f: f2, d: k * T * 0.96 - 0.02, ...o}); b += k * T; };
    const pc = (frets, k, v, st) => { const i = ev.length; chord(ev, lay(b), frets, k * T * 0.97, st || 0.03); ev.slice(i).forEach(e => { e.v = v; }); b += k * T; };
    const r = k => { b += k * T; };
    // run: altılık koşu, [tel, perde, legato]
    const run = (P, v) => P.forEach(([s, f, h]) => n(s, f, 0.5, h ? {h: true} : {v}));
    // Riff: G# F# E C# F# G G#, kalın tellerde (giriş 4. perdede, dönüşü 9. perdede); vibrato yalnız 2 üçlemelik E'de
    const riff = (P, v) => P.forEach(([s, f, k, h]) => n(s, f, k, h ? {h: true} : k > 1 ? {v, vib: 1.5} : {v}));
    const LOW1 = [[2, 6, 1], [2, 4, 1, 1], [1, 7, 2], [1, 4, 1], [2, 4, 1], [2, 5, 1, 1], [2, 6, 1, 1]];
    const LOW2 = [[1, 11, 1], [1, 9, 1, 1], [0, 12, 2], [0, 9, 1], [1, 9, 1], [1, 10, 1, 1], [1, 11, 1, 1]];
    const pick = v => { n(4, 9, 1, {v}); n(4, 12, 1, {h: true}); };
    const motif = v => { n(4, 14, 5, {bend: 2, back: true, vib: 2.5, v}); n(4, 12, 1, {h: true}); n(4, 9, 4, {vib: 2, v: v - 0.05}); n(3, 11, 1, {v: v - 0.12}); n(3, 9, 1, {h: true}); };
    // Motif bir oktav aşağıda, G ve D tellerinde; G#'den sonra bir üçlemelik nefes
    const motifLow = v => { n(3, 6, 5, {bend: 2, back: true, vib: 2.5, v}); n(3, 4, 1, {h: true, v: v - 0.04}); n(2, 6, 3, {vib: 2, v}); r(1); n(2, 4, 1, {v: v - 0.08}); n(2, 2, 1, {h: true, v: v - 0.1}); };
    const answer = v => { ds(3, 11, 10, 1, {v}); ds(3, 9, 9, 1, {h: true}); ds(3, 11, 10, 1, {v: v - 0.05}); ds(3, 9, 9, 3, {v: v + 0.05}); };
    // Kayan hücre: bükme, B, G#, B (beş üçleme, vuruşa göre her seferinde kayar); tepesi her seferinde bir basamak yükselir
    const cell = (f, v) => { n(4, f, 2, {bend: 2, v}); n(4, 12, 1, {v: v - 0.1}); n(4, 9, 1, {h: true}); n(4, 12, 1, {h: true}); };
    // Unison bükme: G telinde B, B telindeki C#'ye çıkar
    const uni = (k, o) => { const t = lay(b); ev.push({b: t, s: 3, f: 16, d: k * T * 0.96, bend: 2, ...o}, {b: t + 0.02, s: 4, f: 14, d: k * T * 0.96 - 0.02, v: o.v}); b += k * T; };

    // Giriş: C#5 ve alçak riff (minörü riffin E'si söyler); A5, B5, motifin çekişi
    at(0); pc(Cs, 4, 0.8); riff(LOW1, 0.78);
    at(1); pc(A5, 5, 0.8); r(1); pc(B5, 3, 0.8); r(1); pick(0.75);
    // Tema: motif, çift notalı cevap, ince tellerde B ve nefes; ikinci çağrı iç çekişle (D#'den C#'ye) başlar, kökte biter; F#m ve G#7 ile soru
    at(2); motif(0.9);
    at(3); answer(0.8); pc(Bh, 2, 0.75); pc(Bh, 1, 0.55); r(3);
    at(4); n(4, 14, 4, {pre: 2, vib: 2.5, v: 0.9}); n(5, 12, 1, {v: 0.85}); n(5, 14, 1, {h: true}); n(5, 12, 1, {h: true}); n(4, 14, 1, {v: 0.8}); n(4, 12, 1, {h: true}); n(4, 14, 3, {vib: 2, v: 0.85});
    at(5); pc(Fm, 2, 0.75); pc(Fm, 1, 0.55); n(4, 10, 1, {v: 0.7}); n(4, 9, 1, {h: true}); n(3, 11, 1, {v: 0.7}); pc(G7, 4, 0.8); n(4, 12, 1, {v: 0.75}); n(4, 14, 1, {h: true});
    // Gelişme: motif bir basamak yukarı (E'yi F#'ye büker), cevap B-e tellerinde dörtlülerle;
    // kayan hücrenin tepesi merdiven gibi çıkar (C#, D#, E); cevabı girişin riffinin kromatik kuyruğu (F# G) G#7'nin köküne bağlanır
    at(6); n(5, 12, 4, {bend: 2, back: true, vib: 2.5, v: 0.92}); n(5, 12, 1, {v: 0.8}); n(4, 14, 1, {v: 0.8}); n(4, 12, 4, {vib: 2, v: 0.85}); n(4, 9, 1, {h: true}); n(3, 11, 1, {v: 0.72});
    at(7); ds(4, 12, 12, 1, {v: 0.85}); ds(4, 10, 9, 1, {h: true}); ds(4, 12, 12, 1, {v: 0.8}); ds(4, 10, 9, 3, {v: 0.9}); pc(Bh, 2, 0.8); pc(Bh, 1, 0.6); n(3, 9, 1, {v: 0.75}); n(3, 11, 1, {h: true}); n(4, 9, 1, {v: 0.8});
    at(8); cell(12, 0.85); cell(14, 0.9); n(4, 14, 5, {bend: 3, back: true, vib: 2.5, v: 0.95});
    at(9, 3); r(1); n(1, 9, 1, {v: 0.85}); n(1, 10, 1, {h: true}); pc(G7, 2, 0.85); pc(G7, 1, 0.6); r(1); n(4, 14, 1, {v: 0.8}); n(5, 12, 1, {v: 0.85});
    // Yükseliş: motif başları sıkışır ve tırmanır (F#'den G#'ye, G#'den A'ya); B üzerinde çığlıklar E→F#, E→F#, F#→G# basamaklanır
    at(10); n(5, 14, 3, {bend: 2, back: true, vib: 2, v: 0.9}); n(5, 12, 1, {h: true}); n(4, 14, 1, {v: 0.8}); n(5, 12, 1, {v: 0.85}); n(5, 14, 1, {h: true});
    n(5, 16, 3, {bend: 1, back: true, vib: 2, v: 0.92}); n(5, 14, 1, {h: true}); n(5, 12, 1, {h: true});
    at(11); n(4, 17, 2, {bend: 2, v: 0.88}); n(5, 14, 1, {v: 0.8}); n(4, 17, 2, {bend: 2, v: 0.92}); n(5, 14, 1, {v: 0.82}); n(4, 19, 3, {bend: 2, back: true, vib: 2.5, v: 0.95}); n(5, 16, 3, {vib: 2.5, v: 0.9});
    // Nefes: sert C#5 vuruşu, girişin riffi kalın tellerde; G#7 arpeji ve koşu vuruşta B5'e çarpar, doruktan önce durak
    at(12); pc(Csh, 2, 0.95); r(1); pc(Csh, 1, 0.75); riff(LOW2, 0.85);
    at(13); pc(G7, 3, 0.9); n(3, 13, 1, {v: 0.85}); n(4, 13, 1, {v: 0.85}); n(4, 16, 1, {h: true});
    run([[5, 12], [5, 14, 1], [5, 16, 1], [5, 14], [5, 16, 1], [5, 17, 1]], 0.9); n(5, 19, 1, {v: 0.95}); r(2);
    // Doruk: motif bir oktav yukarıda; C#6'yı büker, bükülü vurup bırakır, yeniden büküp bırakır (tizde tel çabuk söner, yeniden vurulur).
    // Cevabı tiz çift notalarla, A'yı B'ye büken çığlık
    at(14); n(5, 21, 2, {bend: 2, v: 1}); n(5, 21, 1, {pre: 2, v: 0.95}); n(5, 21, 2, {bend: 2, back: true, vib: 3, v: 1}); n(5, 19, 1, {h: true});
    n(5, 16, 3, {vib: 3, v: 0.95}); n(5, 19, 1, {v: 0.9}); n(4, 19, 1, {v: 0.9}); n(4, 17, 1, {h: true});
    at(15); ds(4, 19, 17, 1, {v: 0.9}); ds(4, 17, 16, 1, {h: true}); ds(4, 19, 17, 1, {v: 0.85}); ds(4, 17, 16, 3, {v: 0.95});
    n(5, 17, 3, {bend: 2, back: true, vib: 3, v: 1}); n(5, 19, 1, {v: 0.92}); n(5, 16, 1, {h: true}); n(5, 14, 1, {h: true});
    // Şelale: dörtlü gruplar altılıklara karşı, G#5'ten C#4'e; unison bükmeler, G#7 ve sessizlik
    at(16); run([[5, 16], [5, 14, 1], [5, 12, 1], [4, 14], [5, 14], [5, 12, 1], [4, 14], [4, 12, 1],
                 [5, 12], [4, 14], [4, 12, 1], [3, 13], [4, 14], [4, 12, 1], [3, 13], [3, 11, 1]], 0.92);
    n(3, 9, 1, {h: true}); n(2, 11, 3, {vib: 2.5, v: 0.95});
    at(17); uni(2, {v: 0.9}); uni(1, {v: 0.8}); uni(3, {back: true, v: 0.95}); pc(G7, 3, 0.85); r(3);
    // Dönüş: motif sessizlikten, bir oktav aşağıda ve hafif vuruşla gelir. Cevap G-e altılılarıyla (aynı F#/A → E/G#), B ince tellerde;
    // ikinci çağrı özgün registerda, bükmeden sonra es, iç çekişle biter; F#5 ve G#7 kısa, ardından gerçek nefes
    at(18); motifLow(0.72);
    at(19); ds(3, 2, 2, 1, {v: 0.72}, 2); ds(3, 1, 0, 5, {h: true, v: 0.7}, 2); pc(Bl, 3, 0.6); r(1); pick(0.72);
    at(20); n(4, 14, 4, {bend: 2, back: true, vib: 2.5, v: 0.85}); r(3); n(4, 14, 1, {v: 0.75}); n(4, 12, 1, {h: true}); n(4, 14, 3, {pre: 2, vib: 2.5, v: 0.8});
    at(21); pc(Fm2, 3, 0.6); n(4, 10, 2, {v: 0.68}); n(4, 9, 1, {h: true}); pc(G7, 3, 0.65); r(3);
    // Son: motif başı genişletilmiş (G#, B, C#'den D#'ye); C#5 akoru çalar, minör üçlü E boşta kalan B telinden kor gibi sonradan yanar
    at(22); n(4, 9, 3, {vib: 2, v: 0.72}); n(4, 12, 3, {vib: 2, v: 0.75}); n(4, 14, 4, {bend: 2, back: true, vib: 2.5, v: 0.82}); r(2);
    at(23); pc(C5, 7, 0.6, 0.05); at(23, 3); n(4, 5, 9, {vib: 2, v: 0.55});
    return {bpm: 80, ev};
  }};
