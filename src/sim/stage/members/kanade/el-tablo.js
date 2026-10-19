// Kanade'nin el duruşu tabloları (EL; claude.js pozu bu alanları okur). YER TUTUCU: mankenin sayıları (claude.js EL_MANKEN ile aynı); el-gitar kolu
// Kanade'nin kolu, eli ve gitar yerleşimi için tarayıcısız aramayla doldurur. Alanların anlamı claude.js'teki yorumlarda:
//   KNUCKLE, SY, MID: perde eli kök hedefi (el çerçevesi), tiz telde iniş, avuç ortası; FRET_LO / FRET_HI: alçak ve yüksek duruşun denetim noktaları
//   FIST / FIST_M: pena yumruğu (vuruş, palm mute); ZETA, YAW_0, ROLL_0, ZETA_M, YAW_M, ROLL_M: pena tutuşu; GRIP_AT; THUMB: pena başparmağı
//   PM_K, MU_H: palm mute dönüşü ve payı; HS_MAX: parmak uzanmasında el kayması; POLE_P: palm mute pena dirseğinin kutbu
//   BX, BZ, RQ: duruş geçişinde sapa kayma, gitardan uzaklaşma, dönüşün başladığı pay; LO_C / HI_C: duruş planının (plan.js regimePlan) perde
//   başına bedeli (işlev; plan el tablosu başına önbellekte)
//   TWIST: el bükümünün ön kola verilen payı (aktarım, yen ve bilek derisi); SWIVEL: dirsek dönme açısı seçimi (kol-ik.js okur; v0 null)
// Ölçüm ucu: parmak ucu = userData.tip (yastık noktası; sync-check ve claude.js hedefi); VRM <F>3_end ondan ≈ yastık yarıçapı (re) kadar içeride
// (aktarım err ölçüsü _end'i boğumun (0, l[2], 0) ucuyla karşılaştırır; ikisi arası en çok 5.8 mm).
import * as THREE from "three";

const FIST = [[0, [1.0, 1.35, 0.5]], [0, [1.25, 1.5, 0.75]], [0.05, [1.35, 1.55, 0.75]], [0.1, [1.45, 1.5, 0.7]]];
export const EL = {
  KNUCKLE: new THREE.Vector3(0, 0.079, 0), SY: 0.0065, MID: 0.034,
  FRET_LO: {x: [0.076, 0.243, 0.327, 0.362, 0.378, 0.393, 0.407], p: [[0.4375, 0.03, -0.0067, 0.08, -0.3, 0.021, 0.08], [0.365, 0.0255, -0.0064, 0.17, -0.26, 0.022, 0],
    [0.2995, 0.0283, -0.0045, 0.188, -0.413, 0.0095, -0.08], [0.1262, 0.0209, -0.0115, 0.2663, -0.1813, -0.0002, -0.1362], [0.2456, 0.0189, -0.0105, -0.3162, 0.0487, -0.0113, 0.24],
    [0.3031, 0.0193, -0.0056, -0.2862, 0.2737, -0.0193, 0.115], [0.5356, 0.0209, -0.0066, -0.2112, 0.2687, -0.0333, -0.17]]},
  FRET_HI: {x: [0.393, 0.446], p: [[1.7969, 0.0092, 0.0391, 0.35, 0, 0.0031, -0.5], [1.8063, 0.0087, 0.0387, 0.05, 0.3, 0.0063, -0.4375]]},
  FIST, FIST_M: [[0, [1.7594, 1.2978, 0.5796]], ...FIST.slice(1).map(([ph, t]) => [ph, t.map(a => a + 0.3016)])],
  ZETA: 1.1, YAW_0: 0.6, ROLL_0: -0.6, ZETA_M: 2.1094, YAW_M: 0.4469, ROLL_M: 0.4874, GRIP_AT: 0.8,
  THUMB: [{v: [0.3801, 0.7174, 0.5839], ph: -0.0715, t: [1.2, 0.35, 1.3109]}, {v: [-0.2549, 0.6832, 0.6843], ph: -0.0496, t: [0.0002, 1.1699, 1.3279]},
    {v: [0.2759, 0.3797, 0.883], ph: 0.2158, t: [-0.0063, 1.5791, 1.5092]}],
  PM_K: [0.0625, 0.1329, 0.0719], MU_H: 0.75, HS_MAX: 0.02, POLE_P: new THREE.Vector3(-0.2, -1, 1.2),
  BX: 0.05, BZ: 0.02, RQ: 0.2,
  LO_C: p => p <= 14 ? 0 : p === 15 ? 3 : p === 16 ? 10 : 30, HI_C: p => p >= 15 ? 0.1 : p >= 13 ? 0.5 : p >= 11 ? 1.5 : p >= 9 ? 3 : 6,
  TWIST: 0.5, SWIVEL: null
};
