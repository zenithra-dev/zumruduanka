// Görüntü zinciri: sRGB hex renkleri lineere çevirme ve son işlem (HDR tampon, MSAA, bloom, ACES, derecelendirme, vinyet, gren, dither, sRGB çıkış).
import * as THREE from "three";
import { EffectComposer } from "../../vendor/three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../../vendor/three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "../../vendor/three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "../../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js";

/* ---------- Renk uzayı ---------- */
// Kodda renkler sRGB hex yazılır, ışık hesabı lineerde yapılır. linColor bir rengi bir kez çevirir ve setHex'ini sRGB okur hale getirir;
// böylece çalışırken setHex/set ile atanan renkler de (hüzme, tel, kayıt ışığı, mekan ışıkları) lineer kalır. setRGB/setHSL/copy ham (lineer) yazar.
const done = new WeakSet(), _setHex = THREE.Color.prototype.setHex;
function setHexSRGB(h){ return _setHex.call(this, h).convertSRGBToLinear(); }
export function linColor(c){ if (c && c.isColor && !done.has(c)){ done.add(c); c.convertSRGBToLinear(); c.setHex = setHexSRGB; } return c; }
// Sahne kurulduktan sonra tek geçiş: ışık ve malzeme renkleri. Rengini kendisi lineer kuran malzeme userData.linear = true ile dışarıda kalır.
// Arka plan ve sis setEnv'de backdrop() ile, seyircinin örnek renkleri crowd.js'te çevrilir.
export function linearize(root, extra = []){
  root.traverse(o => {
    if (o.isLight){ linColor(o.color); linColor(o.groundColor); }
    for (const m of [].concat(o.material || [])) if (!m.isShaderMaterial && !m.userData.linear) ["color", "emissive", "specular", "sheen"].forEach(k => linColor(m[k]));
  });
  extra.forEach(linColor);
}

/* ---------- Son işlem ---------- */
// ACES (Narkowicz) → doygunluk ve gölge/ışık tonu → vinyet → sRGB → S eğrisi → kareye bağlı gren + dither.
// exposure mekanın pozlaması, ev ek diyafram (flaş için; 0 = yok).
const FinishShader = {
  uniforms: {tDiffuse: {value: null}, exposure: {value: 1}, ev: {value: 0}, sat: {value: 1}, contrast: {value: 0}, vig: {value: 0}, grain: {value: 0},
    aspect: {value: 16 / 9}, seed: {value: new THREE.Vector2()}, shTint: {value: new THREE.Vector3(1, 1, 1)}, hiTint: {value: new THREE.Vector3(1, 1, 1)}},
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float exposure, ev, sat, contrast, vig, grain, aspect; uniform vec2 seed; uniform vec3 shTint, hiTint; varying vec2 vUv;
vec3 aces(vec3 x){ return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){
  vec3 c = aces(texture2D(tDiffuse, vUv).rgb * exposure * exp2(ev));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, sat), 0.0) * mix(shTint, hiTint, smoothstep(0.02, 0.5, l));
  c *= 1.0 - vig * smoothstep(0.35, 1.05, length((vUv - 0.5) * vec2(aspect, 1.0)));
  vec3 s = toSRGB(clamp(c, 0.0, 1.0));
  s = mix(s, s * s * (3.0 - 2.0 * s), contrast);
  vec2 p = gl_FragCoord.xy + seed;
  s += (hash(p) - 0.5) * grain * (1.0 - 0.7 * s) + (hash(p.yx + 17.0) - 0.5) / 255.0;
  gl_FragColor = vec4(s, 1.0);
}`
};
const GRADE = {exposure: 1, sat: 1, contrast: 0, vig: 0, grain: 0, sh: [1, 1, 1], hi: [1, 1, 1]};
const acesInv = y => { y = Math.min(y, 0.999); const A = 2.43 * y - 2.51, B = 0.59 * y - 0.03, C = 0.14 * y; return (-B - Math.sqrt(B * B - 4 * A * C)) / (2 * A); };
const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const frac = x => x - Math.floor(x);

// Composer: HDR (HalfFloat) ara tampon, MSAA 4, HDR bloom (eşik 1.0), Finish. Float tampon yoksa (WebGL1) 8 bit ve MSAA'sız.
// Yazılım çiziminde (SwiftShader: CI, GPU'suz render) float MSAA kareyi ~3 kat yavaşlatıyor; orada MSAA kapalı. Kurulamazsa composer null.
function softwareGL(gl){ const d = gl.getExtension("WEBGL_debug_renderer_info"); return !!d && /swiftshader|llvmpipe|software/i.test(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)); }
export function createFinish(renderer, scene, camera){
  let composer = null, renderPass = null, bloomPass = null, U = null, hdr = false, samples = 0;
  try {
    const gl2 = renderer.capabilities.isWebGL2;
    hdr = gl2 && renderer.extensions.has("EXT_color_buffer_float");
    samples = gl2 && !softwareGL(renderer.getContext()) ? Math.min(4, renderer.capabilities.maxSamples) : 0;
    const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, sz = renderer.getSize(new THREE.Vector2());
    const rt = new (samples ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget)(sz.x, sz.y, {type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter});
    if (samples) rt.samples = samples;
    composer = new EffectComposer(renderer, rt); composer.setPixelRatio(renderer.getPixelRatio());
    renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.45, 0.5, hdr ? 1.0 : 0.9);
    [bloomPass.renderTargetBright, ...bloomPass.renderTargetsHorizontal, ...bloomPass.renderTargetsVertical].forEach(t => { t.texture.type = type; });
    composer.addPass(bloomPass);
    const fin = new ShaderPass(FinishShader); composer.addPass(fin); U = fin.uniforms;
  } catch (err){ composer = renderPass = bloomPass = U = null; }
  const g = Object.assign({}, GRADE);
  // Mekanın derecelendirmesi (venues.js ENVS[].grade); eksik alanlar varsayılanda kalır
  function grade(o){
    Object.assign(g, GRADE, o);
    if (!U) return;
    ["exposure", "sat", "contrast", "vig", "grain"].forEach(k => { U[k].value = g[k]; });
    U.shTint.value.fromArray(g.sh); U.hiTint.value.fromArray(g.hi);
  }
  // Gren tohumu karenin zamanından (durumsuz): aynı t her zaman aynı deseni verir
  function frame(t){ if (!U) return; const k = Math.round(t * 60); U.seed.value.set(frac(Math.sin(k * 12.9898) * 43758.5453) * 997, frac(Math.sin(k * 78.233) * 43758.5453) * 991); }
  // Gök ve sis rengi: son işlemden geçince yazılan hex'e denk gelen HDR lineer değer (vinyet ve gren hariç)
  function backdrop(hex, out = new THREE.Color()){
    const t = new THREE.Color(hex);
    if (!U) return out.copy(t).convertSRGBToLinear();
    const k = g.contrast, e = g.exposure * Math.pow(2, U.ev.value);
    const s = [t.r, t.g, t.b].map(y => { let x = y; for (let i = 0; i < 5; i++) x -= (x + k * (x * x * (3 - 2 * x) - x) - y) / (1 + k * (6 * x - 6 * x * x - 1)); return x; });
    let c = s.map(x => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    const w = Math.min(1, Math.max(0, (luma(c) - 0.02) / 0.48)), sm = w * w * (3 - 2 * w);
    c = c.map((x, i) => x / (g.sh[i] + (g.hi[i] - g.sh[i]) * sm));
    const l = luma(c);
    c = c.map(x => Math.max(0, l + (x - l) / g.sat));
    return out.setRGB(...c.map(y => acesInv(y) / e));
  }
  function setSize(w, h){ if (composer) composer.setSize(w, h); if (U) U.aspect.value = w / h; }
  return { composer, renderPass, bloomPass, hdr, samples, grade, frame, backdrop, setSize, get uniforms(){ return U; } };
}
