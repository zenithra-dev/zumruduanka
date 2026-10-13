// Danny Boy (Londonderry Air): İrlanda halk ezgisi, ilk yayını Petrie 1855; ağlayan gitarla, G majör, 63 BPM.
// Ezgi kaynakla aynı: abcnotation.com'daki iki bağımsız kayıt (John Chambers ve Paul Hardy koleksiyonları, C ve F majör) nota nota tutuyor.
// Aşağıda C majörde ABC (L:1/8, nefes yerlerindeki "2 z" tutulan "3" olarak), çalarken G'ye aktarılır. Düzenleme: önce ezginin tamamı,
// sonra ikinci yarısı daha güçlü; girişte ve sonda güç akoru.
// Çalış işaretleri notadan önce: /n alttan n yarım ses bükerek gelir, !n bükerek gelir ve geri bırakır, >n n yarım ses bükülü vurulup bırakılır
// (n yoksa 2); notadan sonra ~ geniş vibrato.
import { OPEN, chord } from "../../music/theory.js";

const TUNE = "B,CD|/E3~ D EAGE|DC A,3~ CEF|/G3~ A GECE|D4~ z B,CD|E3~ D EAGE|DC A,3~ B,CD|E3 F >1E D C D|C4~ z GAB|" +
             "/1c3~ B BAGA|GE C3~ GAB|c3~ B BAGE|D4~ z GGG|!e3~ d dcAc|GE C3~ B,CD|EAGE DCA,B,|C5~ GAB";
const AGAIN = "/1c3~ B BAGA|GE C3~ GAB|/1c3~ B >1B A G E|D4~ z GGG|!e3~ d d c >2A c|GE C3~ B,CD|EAGE DCA,B,|C8~";
const KEY = 7, STEP = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
// 12. perde konumu: notayı 11-19. perdelere düşen en ince tele koy
const pos = m => { for (const s of [5, 4, 3, 2]){ const f = m - OPEN[s]; if (f >= 11 && f <= 19) return {s, f}; } throw new Error("konum yok: " + m); };

export default {id: "danny", name: "Danny Boy", desc: "İrlanda halk ezgisi (Londonderry Air) · ağlayan gitar · G majör · 63 BPM", amp: "lead",
  build(){
    const ev = [];
    let b = 0;
    chord(ev, b, [3, 5, 5], 3.8, 0.05); chord(ev, 4, [null, 5, 7, 7], 2.3, 0.05); ev.forEach(e => { e.v = 0.7; });
    b = 6.5;
    const play = (abc, v) => {
      for (const [, mark, amt, note, oct, len, vib] of abc.matchAll(/([\/!>]?)(\d?)([A-Ga-gz])([,']*)(\d*)(~?)/g)){
        const d = (+len || 1) * 0.5;
        if (note !== "z"){
          const m = 60 + KEY + STEP[note.toUpperCase()] + (note === note.toLowerCase() ? 12 : 0) - 12 * (oct.match(/,/g) || []).length;
          const k = mark ? +amt || 2 : 0, o = {v};
          if (mark === "/" || mark === "!"){ o.bend = k; if (mark === "!") o.back = true; }
          if (mark === ">") o.pre = k;
          if (vib) o.vib = v > 0.9 ? 3 : 2.5;
          ev.push({b, ...pos(m - (o.bend || 0)), d: d * 0.98, ...o});
        }
        b += d;
      }
    };
    play(TUNE, 0.82);
    play(AGAIN, 0.95);
    chord(ev, b - 4, [3, 5, 5], 4, 0.06); ev.slice(-3).forEach(e => { e.v = 0.6; });
    return {bpm: 63, ev};
  }};
