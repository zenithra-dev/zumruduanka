// Oda yerleşimi: yalnız sayılar (three'siz; tools/oda-yerlesim.mjs bundan out/oda/yerlesim.md yazar, room.js bundan kurar).
// Dünya: metre, y yukarı. Karakter +z'ye bakar, kameralar önden (+z) bakar: ekranın sağı +x. Gitarın sapı oyuncunun solunda = +x.
// Görünen iki duvar arka (z0) ve sol (x0), köşe ikisinin birleştiği yer; ön (z1) ve sağ (x1) duvar çoğu çekimde kadraj dışında.
// FLOOR figures.js'teki ile aynı olmalı (room.js denetler).
export const FLOOR = -0.95, HEIGHT = 2.5, CEIL = FLOOR + HEIGHT;
// Karakterin kökü (claude.js build): ayakta, yatağın kenarının önünde
export const CHAR = {x: 0.2, z: -0.19};
// Odanın iç yüzleri
export const SHELL = {x0: -1.35, x1: 2.9, z0: -1.45, z1: 2.45, y0: FLOOR, y1: CEIL};

// Yatak: köşede, başı sol duvarda, uzun kenarı arka duvara yaslı; ön uzun kenarı karakterin arkasında
export const BED = {
  frame: {x0: -1.33, x1: 0.72, z0: -1.43, z1: -0.42},                      // beyaz metal karyolanın dış kutusu (direkler dahil)
  mattress: {x0: -1.29, x1: 0.68, z0: -1.40, z1: -0.45, y0: FLOOR + 0.30, y1: FLOOR + 0.50},
  duvetTop: FLOOR + 0.55,                                                   // gri nevresimin üstü; önde yan raya (FLOOR + 0.30) kadar sarkar
  throw: {x0: -0.55, x1: 0.70, top: FLOOR + 0.60},                          // kabarık gri örtü (ayak tarafı)
  blanket: {x0: -0.80, x1: 0.40, z0: -1.40, z1: -0.50, top: FLOOR + 0.615}, // üstte ince desenli beyaz battaniye
  head: {x: -1.31, top: FLOOR + 1.05, bars: [FLOOR + 0.52, FLOOR + 1.02]},  // başlık direkleri ve parmaklık
  foot: {x: 0.70, top: FLOOR + 0.80, bars: [FLOOR + 0.52, FLOOR + 0.77]},   // ayak tarafı
  postZ: [-1.42, -0.44], railY: FLOOR + 0.30, postR: 0.019, knobR: 0.03, barR: 0.008,
  pillows: [{x: -1.13, y: FLOOR + 0.70, z: -1.15, r: [0.13, 0.17, 0.26], tilt: -0.35}, {x: -1.11, y: FLOOR + 0.69, z: -0.72, r: [0.13, 0.16, 0.25], tilt: -0.3}]
};
// Oturma (VRM anime kızı yatağın kenarına oturup bacak bacak üstüne atarak çalacak): kalça noktası pelvisin (VRM hips) hedefi,
// cushionY bastırılmış minder yüzeyi, footY ayakların bastığı zemin, thigh uyluk ve bacaklar için boş tutulan kutu (kenardan öne).
// Ayaktaki kökle aynı x; z kenarın 13 cm gerisi (kenar karakterin arkasında: oturunca dizler ve ayaklar bugünkü duruş yerine gelir).
export const SEAT = {x: CHAR.x, edgeZ: BED.frame.z1, hipZ: -0.55, cushionY: FLOOR + 0.50, hipUp: 0.10, footY: FLOOR, facing: [0, 0, 1],
  thigh: {x0: -0.18, x1: 0.58, y0: FLOOR, y1: FLOOR + 0.92, z0: -0.42, z1: 0.32}};

// Eşya yuvaları (yer, yön, boy); geometri kollarda
export const SLOTS = {
  kedi: {x: -0.42, y: BED.blanket.top, z: -0.95, yaw: 0.6, r: 0.2},          // battaniyenin üstünde kıvrılmış kara kedi
  pelus: [
    {ad: "tavsan", x: -0.78, y: BED.duvetTop, z: -1.18, yaw: 0.5, boy: 0.30},
    {ad: "ayicik", x: -0.80, y: BED.duvetTop, z: -0.80, yaw: 0.25, boy: 0.28},
    {ad: "kediYastik", x: -0.35, y: BED.duvetTop, z: -1.30, yaw: Math.PI / 2, boy: 0.85, cap: 0.17}   // uzun beyaz kedi yastığı, arka duvar boyunca
  ],
  amfi: {x: 1.21, y: FLOOR, z: -1.31, yaw: -0.15, w: 0.40, h: 0.36, d: 0.22},  // yatağın ayak ucunda, arka duvar dibinde pratik amfisi
  tabela: {x: 1.45, y: FLOOR + 1.85, z: SHELL.z0 + 0.02, w: 1.0, h: 0.25}     // sahne pankartının yerine küçük neon tabela
};

// Peri ışıkları: tavan kenarında iki duvar boyunca askı noktaları, aralarda sarkma (zincir eğrisi), önerilen ampul aralığı
const hooks = (a, b, n) => Array.from({length: n + 1}, (_, i) => +(a + (b - a) * i / n).toFixed(4));
export const LIGHTS = {
  arka: {y: CEIL - 0.04, z: SHELL.z0 + 0.03, x: hooks(SHELL.x0 + 0.04, SHELL.x1 - 0.04, 7), sag: 0.14},
  sol: {y: CEIL - 0.04, x: SHELL.x0 + 0.03, z: hooks(SHELL.z0 + 0.04, SHELL.z1 - 0.04, 6), sag: 0.13},
  ampulAraligi: 0.025, renk: 0xffd9a0,
  // Köşeden aşağı sarkan uç: arka koşunun başından, başlığın topuzlarının üstünde biter
  kose: [[SHELL.x0 + 0.035, CEIL - 0.04, SHELL.z0 + 0.035], [SHELL.x0 + 0.055, CEIL - 0.55, SHELL.z0 + 0.06], [SHELL.x0 + 0.045, FLOOR + 1.24, SHELL.z0 + 0.05]],
  // Işık saçan dolgu (ampullerin toplamı, 2700 K): iki duvarın tavan hizasında (tavana sıyırır: tavanda sıcak leke yapmaz) ve yüz ile gitar için
  // önden sıcak dolgu: karaktere yakın, kısa menzilli; ön ve sağ duvara erişmez (eskisi 0.95, 0.55, 0.95; 2.3 m kaynaksız sıcak leke bırakıyordu),
  // yüzde ve gitar gövdesinde ışınım ve geliş yönü aynı (fark ≤ %6, ≤ 8°). Ampullerin duvara ve tavana düşen yakın ışığı ışık haritasında (room/lights.js irr, room/shell.js).
  dolgu: [{x: 0.45, y: CEIL - 0.03, z: SHELL.z0 + 0.8, renk: 0xffcc9a, i: 0.32, r: 4.6}, {x: SHELL.x0 + 0.8, y: CEIL - 0.03, z: 0.3, renk: 0xffcc9a, i: 0.26, r: 4.4},
    {x: 0.65, y: 0.5, z: 0.65, renk: 0xffd2a6, i: 0.775, r: 1.85}]
};

// Duvarlar: içeriden bakınca u soldan sağa, v zeminden yukarı (m). Dekor bölgeleri u0-u1, v0-v1; yogunluk kaplanacak alan payı.
// u dünya koordinatından: arka duvarda ux(x0, x1), sol duvarda uL(z0, z1), sağ duvarda uR(z0, z1)
const r3 = x => +x.toFixed(3), ux = (a, b) => [r3(a - SHELL.x0), r3(b - SHELL.x0)], uL = (a, b) => [r3(SHELL.z1 - b), r3(SHELL.z1 - a)], uR = (a, b) => [r3(a - SHELL.z0), r3(b - SHELL.z0)];
// Karakterin kafası v = 1.67'de (arka duvarda x = 0.28 hizası); yönetmenin yüz, bel ve kahraman planları arka duvarın ortasına ve köşeye bakar.
export const WALLS = [
  {ad: "arka", o: [SHELL.x0, SHELL.z0], u: [1, 0], n: [0, 0, 1], w: SHELL.x1 - SHELL.x0, decor: [
    {ad: "yatakUstu", u: ux(-1.30, -0.20), v: [0.95, 2.15], yogunluk: 0.6},     // yastıkların ve başlığın üstü
    {ad: "basArkasi", u: ux(-0.20, 0.85), v: [0.75, 2.20], yogunluk: 0.7},     // kafanın arkası: en çok görünen yer
    {ad: "sapArkasi", u: ux(0.85, 2.85), v: [0.55, 2.20], yogunluk: 0.45}     // sap ve amfinin üstü (neon tabela burada)
  ]},
  {ad: "sol", o: [SHELL.x0, SHELL.z1], u: [0, -1], n: [1, 0, 0], w: SHELL.z1 - SHELL.z0, decor: [
    {ad: "yatakBasi", u: uL(-1.42, -0.42), v: [1.12, 2.15], yogunluk: 0.55},    // köşe, başlığın üstü
    {ad: "koseOnu", u: uL(-0.42, 1.30), v: [0.30, 2.15], yogunluk: 0.4},       // yatağın önü
    {ad: "solUzak", u: uL(1.30, SHELL.z1 - 0.05), v: [0.50, 2.10], yogunluk: 0.15}
  ]},
  {ad: "sag", o: [SHELL.x1, SHELL.z0], u: [0, 1], n: [-1, 0, 0], w: SHELL.z1 - SHELL.z0, decor: [
    {ad: "sagArka", u: uR(-1.40, 1.0), v: [0.40, 2.20], yogunluk: 0.2},
    {ad: "sagOn", u: uR(1.0, SHELL.z1 - 0.05), v: [0.40, 2.20], yogunluk: 0.1}
  ]},
  {ad: "on", o: [SHELL.x1, SHELL.z1], u: [-1, 0], n: [0, 0, -1], w: SHELL.x1 - SHELL.x0, decor: []}   // kameranın arkası
];

// Kamera: duvar, tavan ve zeminden pay bırakılmış kutu; mobilyadan kaçınma kutuları (eşya + 8 cm pay)
export const CAMERA = {
  bounds: {x: [SHELL.x0 + 0.15, SHELL.x1 - 0.15], y: [FLOOR + 0.10, CEIL - 0.12], z: [SHELL.z0 + 0.15, SHELL.z1 - 0.15]},
  avoid: [
    {ad: "yatak", x: [-1.35, 0.80], y: [FLOOR, FLOOR + 0.72], z: [-1.45, -0.34]},
    {ad: "yatakBasi", x: [-1.35, -0.60], y: [FLOOR, FLOOR + 1.16], z: [-1.45, -0.34]},
    {ad: "yatakAyak", x: [0.60, 0.80], y: [FLOOR, FLOOR + 0.91], z: [-1.45, -0.34]},
    {ad: "amfi", x: [0.93, 1.49], y: [FLOOR, FLOOR + 0.44], z: [-1.45, -1.12]},
    {ad: "kedi", x: [-1.02, -0.22], y: [FLOOR, FLOOR + 0.89], z: [-1.22, -0.55]},          // battaniyedeki kara kedi (kulak ve bıyık dahil)
    {ad: "kediYastik", x: [-0.71, 0.42], y: [FLOOR, FLOOR + 0.80], z: [-1.45, -1.08]}      // uzun kedi yastığının üstü
  ],
  subject: [CHAR.x, FLOOR + 1.37, CHAR.z],   // kadrajın konusu (göğüs): dışarıda kalan kamera bu noktaya doğru içeri çekilir
  fovMax: 60, near: 0.35                     // içeri çekilince objektif açılır (en çok fovMax), konuya en az near kalır
};
