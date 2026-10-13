const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=swiftshader','--autoplay-policy=no-user-gesture-required']});
 const p = await b.newPage({viewport:{width:1280,height:1000}}); p.on('pageerror',e=>console.log('ERR',e.message));
 const html=fs.readFileSync('claude-gitar.html','utf8').split('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>').join('<script>'+fs.readFileSync('vendor/three.min.js','utf8')+'</script>').replace(/<script src="https:\/\/cdn.jsdelivr.net\/npm\/three@0.128.0\/examples\/js\/([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync('package/examples/js/'+f,'utf8')+'</script>').replace('setEnv("club");','setEnv("club"); window.__T={get playing(){return playing}, startPlay, SONGS, get now(){return ctx?ctx.currentTime:0}};');
 await p.setContent('<!doctype html><html><head><meta charset=utf-8></head><body>'+html+'</body></html>'); await p.waitForTimeout(1000);
 await p.click(process.env.CAM||'#cam-director'); await p.click('#env-'+(process.env.ENV||'theater'));
 await p.evaluate((i)=>window.__T.startPlay(window.__T.SONGS[i]), +(process.env.SONG||0));
 console.log(await p.evaluate(()=>JSON.stringify(window.__T.playing.shots.map(s=>[ (s.t-window.__T.playing.t0).toFixed(1), s.who, s.kind, s.glide?"G":"", s.crane?"C":""]))));
 const N=+(process.env.N||8), DT=+(process.env.DT||3500);
 for (let i=0;i<N;i++){ await p.waitForTimeout(DT); const info=await p.evaluate(()=>{const T=window.__T,n=T.now,s=T.playing&&T.playing.shots.find(x=>n>=x.t&&n<x.end);return (n-(T.playing?T.playing.t0:0)).toFixed(1)+' '+(s?s.who+'/'+s.kind:'-')}); console.log(i,info); await (await p.$('#stage')).screenshot({path:'dir'+i+'.png'}); }
 await b.close(); })();
