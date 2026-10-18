// node --import ./three-hook.mjs: "three" → bu reponun vendor/three'si (salt okur ölçüm)
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`export async function resolve(s, c, n){ if (s === "three") return {url: "file:///C:/work/zumruduanka/src/vendor/three/build/three.module.js", shortCircuit: true}; return n(s, c); }`));
