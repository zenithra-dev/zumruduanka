// Bir motora bağlı enstrümanlar. Tek enstrüman: elektro gitar.
import { createGuitar } from "./guitar.js";
export function createInstruments(engine){ return { ...createGuitar(engine) }; }
