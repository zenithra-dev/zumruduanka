// Kanade'nin ikincil hareket kayıt defteri (v0 boş; ikincil kolu saç, etek ve yen salınımını ekler). Her kayıt zamanın saf işlevidir ve her karede
// kemiklere dinlenmeden yazar (durum yok); sırayla çalışır: fig.late(ctx) içinde, askı ve kamera son yerindeyken (odada confine'dan sonra).
//   const R = createIkincil(); R.add("sac", ctx => ...); R.run(ctx)   // ctx = {now, wall, p, model, strap, cam, headCam, fig, asset}
// Kayıt bir şey yazdıysa vekil.js tutucunun matrislerini günceller. İkiz kuralı (sac.json): J_Sec_Hair_<ad>_Govde_<k> ile _<k> aynı yerel dönüşü alır.
export function createIkincil(){
  const L = [];
  return {add(ad, fn){ L.push({ad, fn}); }, run(ctx){ for (const x of L) x.fn(ctx); return L.length; }, get adlar(){ return L.map(x => x.ad); }};
}
