const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=swiftshader']});
 const p = await b.newPage({viewport:{width:1280,height:1000}}); p.on('pageerror',e=>console.log('ERR',e.message));
 const html=fs.readFileSync('claude-gitar.html','utf8').split('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>').join('<script>'+fs.readFileSync('vendor/three.min.js','utf8')+'</script>').replace(/<script src="https:\/\/cdn.jsdelivr.net\/npm\/three@0.128.0\/examples\/js\/([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync('package/examples/js/'+f,'utf8')+'</script>').replace('setEnv("club");','setEnv("club"); window.__T={FIG,groupCam,renderer};');
 await p.setContent('<!doctype html><html><head><meta charset=utf-8></head><body>'+html+'</body></html>'); await p.waitForTimeout(1000);
 await p.click('#cam-group'); await p.waitForTimeout(800);
 await (await p.$('#stage')).screenshot({path:'ch-group.png'});
 const shots = (process.env.SHOTS||'claude,umay,erlik,sahmeran,ulgen').split(',');
 for (const k of shots){
   await p.evaluate((k)=>{ window.__FOCUS = k; const {FIG,groupCam}=window.__T; const f = FIG[k]; const v = new THREE.Vector3(); f.head.getWorldPosition(v);
     const fw = new THREE.Vector3(0,0,1).applyQuaternion(f.g.quaternion);
     const _u = groupCam.position.set; window.__lock = () => { groupCam.position.copy(v).addScaledVector(fw, 1.5).add(new THREE.Vector3(0.35,-0.2,0)); groupCam.lookAt(v.x, v.y-0.35, v.z); };
   }, k);
   await p.evaluate(()=>{ if(!window.__hooked){ window.__hooked=1; const renderer=window.__T.renderer; const groupCam=window.__T.groupCam; const r=renderer.render.bind(renderer); renderer.render=(s,c)=>{ if(window.__lock && c===groupCam) window.__lock(); r(s,c); }; } });
   await p.waitForTimeout(700); await (await p.$('#stage')).screenshot({path:'ch-'+k+'.png'});
 }
 await b.close(); })();
