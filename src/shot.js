const { chromium } = require('playwright');
(async()=>{
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=swiftshader','--autoplay-policy=no-user-gesture-required']}).catch(async()=>chromium.launch());
 const p = await b.newPage({viewport:{width:1280,height:1000}});
 p.on('console',m=>console.log('console',m.type(),m.text())); p.on('pageerror',e=>console.log('ERR',e.message));
 const fs=require('fs'); const html = fs.readFileSync('claude-gitar.html','utf8').split('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>').join('<script>'+fs.readFileSync('vendor/three.min.js','utf8')+'</script>');
 await p.setContent('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+html+'</body></html>',{waitUntil:'networkidle'});
 await p.waitForTimeout(1000);
 await p.screenshot({path:'a.png', fullPage:true});
 await p.click('#play'); await p.waitForTimeout(1500); await p.screenshot({path:'b.png'});
 await p.click('#cam-stage'); await p.waitForTimeout(500); await p.screenshot({path:'c.png'}); await p.click('#cam-group'); await p.waitForTimeout(2500); await p.screenshot({path:'d.png'});
 await b.close();
})();
