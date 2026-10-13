// Repertuar. Sıra önemli: araçlar şarkıya indeksle de erişebilir.
import kaf from "./kaf.js";
import ninni from "./ninni.js";
import tepegoz from "./tepegoz.js";
import riff from "./riff.js";
import blues from "./blues.js";
import elise from "./elise.js";
import improv from "./improv.js";
export const SONGS = [kaf, ninni, tepegoz, riff, blues, elise, improv];
export function findSong(key){ return SONGS[+key] || SONGS.find(s => s.id === key) || null; }
