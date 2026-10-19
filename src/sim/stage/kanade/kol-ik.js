// Kanade'nin kol IK kancası (v0; el-gitar kolu dirsek dönme açısı seçimini — softmin, figür çerçevesinde, durumsuz — buraya koyar). figures.js poseArm
// eşit olmayan parçalarla (fig.l1 üst kol, fig.l2 ön kol) çözer ve fig.armState[i] = {S, E, T, n} yazar (aktarım okur: omuz, dirsek, bilek, bükülme
// düzleminin normali, dünya). pole(i, S, T, pole): dirseğin yönü dünyada. Çağıranın kutbu (claude.js handPole) dünya vektörüdür, olduğu gibi alınır;
// verilmezse mankenin varsayılan kutbu figür çerçevesinde kurulup dünyaya çevrilir (mankendeki dünya/figür karışıklığı burada yok). EL.SWIVEL
// (el-tablo.js; v0 null) verilirse kutbu o seçer: SWIVEL(fig, i, S, T, kutup) → kutup; gitar fig.model'den (model.guitar, strap.js guitarSd),
// beden fig.bodySdFn'den.
import * as THREE from "three";
import { EL } from "../members/kanade/el-tablo.js";

const DEF = [new THREE.Vector3(0.8, -1, -0.35), new THREE.Vector3(-0.8, -1, -0.35)];
export function kolPole(fig, i, S, T, pole){
  const p = pole ? pole.clone() : DEF[i].clone().applyQuaternion(fig.g.quaternion);
  return EL.SWIVEL ? EL.SWIVEL(fig, i, S, T, p) : p;
}
