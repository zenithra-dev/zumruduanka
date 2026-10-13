// Ağıt: ağlayan gitar, E minör, 66 BPM. Tek gitar: uzun tutulan, bükülüp geri bırakılan notalar, iç çekiş gibi bırakılan
// ön bükmeler, geniş vibrato; ara cümlelerde güç akorları (Em, C, D ve dominant B, harmonik minörün D#'i B üzerinde hicaz rengi verir).
import { chord } from "../../music/theory.js";

export default {id: "agit", name: "Ağıt", desc: "Ağlayan gitar · E minör, hicaz renkli · bükmeler ve geniş vibrato · 66 BPM", amp: "lead",
  build(){
    const ev = [], E5 = [0, 2, 2], C5 = [null, 3, 5, 5], D5 = [null, 5, 7, 7], B5 = [null, 2, 4, 4];
    let b = 0;
    // n: tek nota (tel, perde, vuruş, çalış: bend/back/pre/vib/h/v); pc: güç akoru; r: es
    const n = (s, f, d, o) => { ev.push({b, s, f, d: d * 0.98, ...o}); b += d; };
    const pc = (frets, d, v) => { const i = ev.length; chord(ev, b, frets, d * 0.98, 0.05); ev.slice(i).forEach(e => { e.v = v; }); b += d; };
    const r = d => { b += d; };
    const run = (notes, v) => notes.forEach(([s, f], i) => n(s, f, 0.25, i ? {h: true, v} : {v}));
    // Giriş: Em yere çöker, C ve D ile soru
    pc(E5, 4, 0.8); pc(C5, 2, 0.7); pc(D5, 2, 0.75);
    // Birinci cümle: D'den E'ye bükülen ağlama, G'de dinlenir; cevap: B'den A'ya iç çekiş, E'ye iniş
    n(4, 12, 0.5, {v: 0.75}); n(4, 15, 2.5, {bend: 2, back: true, vib: 2.2, v: 0.85}); n(4, 12, 0.5, {h: true}); n(3, 14, 0.5, {v: 0.8}); n(3, 12, 2, {vib: 2, v: 0.8});
    r(0.5);
    n(2, 14, 0.5, {v: 0.75}); n(3, 12, 0.5, {v: 0.8}); n(3, 14, 2, {pre: 2, vib: 2, v: 0.85}); n(3, 12, 0.5, {h: true}); n(3, 11, 0.5, {h: true}); n(2, 14, 3.5, {vib: 2.5, v: 0.8});
    pc(C5, 1, 0.7); pc(D5, 1, 0.75);
    // İkinci cümle: ince telde A'dan B'ye büyük bükme; D# ile hicaz rengi, B'den C'ye yarım ses hıçkırık
    n(5, 12, 0.5, {v: 0.85}); n(5, 15, 0.5, {v: 0.85}); n(5, 17, 2.5, {bend: 2, back: true, vib: 2.5, v: 0.95}); n(5, 15, 0.5, {h: true}); n(5, 14, 0.5, {h: true}); n(5, 12, 1.5, {vib: 2, v: 0.85});
    n(4, 16, 0.5, {v: 0.85}); n(4, 17, 0.5, {h: true}); n(4, 16, 0.5, {h: true}); n(4, 13, 0.5, {v: 0.85}); n(4, 12, 2, {bend: 1, back: true, vib: 1.8, v: 0.9});
    n(3, 14, 0.5, {v: 0.8}); n(3, 12, 0.5, {v: 0.8}); n(3, 11, 0.5, {h: true}); n(2, 13, 0.5, {v: 0.8}); n(2, 14, 2, {vib: 2.5, v: 0.85});
    pc(C5, 1, 0.75); pc(B5, 1, 0.8);
    // Doruk: yukarı koşu, B telinde tutulan bükme, ince telde çığlık; aşağı koşu ve iç çekişle E'ye dönüş
    run([[2, 14], [3, 11], [3, 12], [3, 14], [3, 16], [4, 13], [4, 15], [4, 17]], 0.95);
    n(4, 17, 3, {bend: 2, back: true, vib: 3, v: 1});
    n(5, 15, 0.5, {v: 1}); n(5, 17, 3, {bend: 2, vib: 3, v: 1});
    run([[5, 15], [5, 14], [5, 12], [4, 15], [4, 12], [3, 14], [3, 12], [3, 11]], 0.9);
    n(3, 14, 2, {pre: 2, vib: 2.5, v: 0.9}); n(3, 12, 0.5, {h: true}); n(2, 14, 3, {vib: 3, v: 0.85});
    // Dönüş: ilk cümle kısık sesle
    pc(E5, 2, 0.6);
    n(4, 12, 0.5, {v: 0.65}); n(4, 15, 2.5, {bend: 2, back: true, vib: 2.2, v: 0.7}); n(4, 12, 0.5, {h: true}); n(3, 14, 0.5, {v: 0.65}); n(3, 12, 2, {vib: 2, v: 0.65});
    n(3, 14, 1.5, {pre: 2, vib: 2, v: 0.7}); n(3, 11, 0.5, {h: true}); n(2, 13, 0.5, {v: 0.65}); n(2, 14, 1.5, {vib: 2, v: 0.7});
    pc(C5, 2, 0.6); pc(B5, 2, 0.65);
    // Son: uzun ağlayan bükme, E'ye iniş, Em'de sessizlik
    n(4, 17, 4, {bend: 2, back: true, vib: 2.5, v: 0.85}); n(4, 15, 0.5, {h: true}); n(4, 12, 0.5, {h: true}); n(2, 14, 3, {vib: 2.5, v: 0.75});
    pc([0, 2, 2, null, null, 0], 5, 0.7);
    return {bpm: 66, ev};
  }};
