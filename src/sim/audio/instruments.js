// Bir motora bağlı tüm enstrümanlar tek pakette.
import { createGuitar } from "./guitar.js";
import { createDrums } from "./drums.js";
import { createBass } from "./bass.js";
import { createKeys } from "./keys.js";
import { createVoice } from "./voice.js";

export function createInstruments(engine){
  const guitar = createGuitar(engine);
  return { ...guitar, ...createDrums(engine), ...createBass(engine, guitar.ksBuffer), ...createKeys(engine), ...createVoice(engine) };
}
