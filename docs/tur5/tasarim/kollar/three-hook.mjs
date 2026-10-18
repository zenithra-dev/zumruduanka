// node --import ./three-hook.mjs: "three" → zumruduanka vendor/three (r128)
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n){ if (s === "three") return {url: "file:///C:/work/zumruduanka/src/vendor/three/build/three.module.js", shortCircuit: true}; return n(s, c); }`));
