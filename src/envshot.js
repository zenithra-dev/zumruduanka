const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=swiftshader']});
 const p = await b.newPage({viewport:{width:1280,height:1000}}); p.on('pageerror',e=>console.log('ERR',e.message));
 const fs=require('fs'); const html=fs.readFileSync('claude-gitar.html','utf8').split('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>').join('<script>'+fs.readFileSync('vendor/three.min.js','utf8')+'</script>').replace(/<script src="https:\/\/cdn.jsdelivr.net\/npm\/three@0.128.0\/examples\/js\/([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync('package/examples/js/'+f,'utf8')+'</script>');
 await p.setContent('<!doctype html><html><head><meta charset=utf-8></head><body>'+html+'</body></html>'); await p.waitForTimeout(1000);
 await p.click('#cam-group'); 
 for (const e of ['theater','summit']){ await p.click('#env-'+e); await p.waitForTimeout(1500); await (await p.$('#stage')).screenshot({path:'env-'+e+'.png'}); }
 await p.click('#cam-stage'); await p.waitForTimeout(800); await (await p.$('#stage')).screenshot({path:'env-summit-stage.png'});
 await b.close(); })();
