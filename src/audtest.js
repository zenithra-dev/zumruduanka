const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{ const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=swiftshader']});
 const p = await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('CERR',m.text())});
 await p.goto('file://'+process.cwd()+'/render.html'); await p.waitForTimeout(1000);
 const SONGI=+(process.env.SONG||0), DUR=+(process.env.DUR||30);
 const r = await p.evaluate(async([SONGI,DUR])=>{
   const SR=44100; window.__R.resetAudio(); window.__OFF=new OfflineAudioContext(2,SR*DUR,SR);
   window.__R.startPlay(window.__R.SONGS[SONGI]);
   const buf=await window.__OFF.startRendering(); const L=buf.getChannelData(0), R=buf.getChannelData(1), n=buf.length;
   let pk=0,nan=0,sl=0,sr=0,ss=0; for(let i=0;i<n;i++){ if(!isFinite(L[i]))nan++; pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i])); sl+=L[i]*L[i]; sr+=R[i]*R[i]; ss+=(L[i]-R[i])**2; }
   const dv=new DataView(new ArrayBuffer(44+n*4)); const ws=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};
   ws(0,'RIFF');dv.setUint32(4,36+n*4,true);ws(8,'WAVE');ws(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,2,true);dv.setUint32(24,SR,true);dv.setUint32(28,SR*4,true);dv.setUint16(32,4,true);dv.setUint16(34,16,true);ws(36,'data');dv.setUint32(40,n*4,true);
   for(let i=0;i<n;i++){dv.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]))*32767,true);dv.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]))*32767,true);}
   const bytes=new Uint8Array(dv.buffer); let bin=''; for(let i=0;i<bytes.length;i+=32768) bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768));
   return {pk, nan, rmsL:Math.sqrt(sl/n), rmsR:Math.sqrt(sr/n), side:Math.sqrt(ss/n), wav:btoa(bin)};
 },[SONGI,DUR]);
 fs.writeFileSync(process.env.OUT||'test.wav', Buffer.from(r.wav,'base64')); delete r.wav; console.log(JSON.stringify(r)); await b.close(); })();
