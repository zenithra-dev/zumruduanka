const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{
 const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 const p = await b.newPage({viewport:{width:1280,height:1000}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+process.cwd()+'/render.html'); await p.waitForTimeout(1500);
 const SR=44100;
 const SONGI=+(process.env.SONG||0);
 const info = await p.evaluate(async ([SR,SONGI])=>{
   window.__OFF = new OfflineAudioContext(2, SR*95, SR);
   window.__R.startPlay(window.__R.SONGS[SONGI]);
   const end = window.__R.end;
   const buf = await window.__OFF.startRendering();
   const n = buf.length, L=buf.getChannelData(0), R=buf.getChannelData(1);
   let peak=0; for(let i=0;i<n;i++){peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}
   const g = peak>0? 0.89/peak:1;
   const dv = new DataView(new ArrayBuffer(44+n*4));
   const ws=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i));};
   ws(0,'RIFF');dv.setUint32(4,36+n*4,true);ws(8,'WAVE');ws(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,2,true);dv.setUint32(24,SR,true);dv.setUint32(28,SR*4,true);dv.setUint16(32,4,true);dv.setUint16(34,16,true);ws(36,'data');dv.setUint32(40,n*4,true);
   for(let i=0;i<n;i++){dv.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]*g))*32767,true);dv.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]*g))*32767,true);}
   const bytes=new Uint8Array(dv.buffer); let bin=''; for(let i=0;i<bytes.length;i+=32768) bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768));
   return {end, peak, wav: btoa(bin)};
 }, [SR,SONGI]);
 const W=+(process.env.W||0), N=+(process.env.N||1); if(W===0) fs.writeFileSync('audio.wav', Buffer.from(info.wav,'base64'));
 console.log('end',info.end,'peak',info.peak);
 if(process.env.AUDIO_ONLY){await b.close();return;}
 const FPS=30, total=Math.ceil((info.end+1.0)*FPS);
 for(let i=0;i<total;i++){ if(i%N!==W) continue;
   const t=i/FPS;
   const url = await p.evaluate(([t,SONGI_F])=>{
     const R=window.__R;
     const G=R.groupCam, sm=x=>x*x*(3-2*x);
     const shot=(pos,look)=>{R.setCam('group'); G.position.set(...pos); G.lookAt(...look);};
     const wide=(u)=>shot([0.1-0.4*u,0.55,5.0-0.6*u],[0,0.1,-0.8]);
     const orbitW=(u,a0,a1)=>{const a=a0+(a1-a0)*u; shot([Math.sin(a)*3.8,0.65,-0.6+Math.cos(a)*3.8],[0,0.05,-0.8]);};
     const SH=(u)=>shot([-0.2+0.1*u,0.75,2.0-0.15*u],[-0.7,0.6,0.45]);
     const ER=(u)=>shot([-0.95-0.15*u,0.35,-0.35],[-1.75,0.0,-1.45]);
     const UM=(u)=>shot([0.5+0.2*u,0.5,1.5-0.2*u],[1.5,0.25,-0.75]);
     const UL=(u)=>shot([0.4+0.1*u,0.8,-0.3],[0.95,0.55,-2.0]);
     const ST=(u)=>{R.setCam('stage'); R.orbit.theta=-0.5+u*0.6; R.orbit.r=1.3; R.orbit.phi=1.3; R.placeCams();};
     const PLANS={0:[[0,5,'head'],[5,10,wide],[10,15,SH],[15,20,u=>orbitW(u,-0.3,0.1)],[20,25,UL],[25,30,UM],
                 [30,35,u=>orbitW(u,0.35,-0.35)],[35,40,ER],[40,45,SH],[45,50,u=>wide(1-u)],
                 [50,55,ST],[55,60,'head'],[60,66,u=>orbitW(u,-0.4,0.4)],[66,71,SH],[71,76,ER],[76,80,UM],[80,99,u=>{const k=sm(Math.min(1,u*3)); shot([0,0.5+0.5*k,4.0+2.0*k],[0,0.15,-0.9]);}]],
       2:[[0,6.4,u=>wide(u)],[6.4,12,'head'],[12,17,ER],[17,19.2,u=>orbitW(u,-0.3,0.2)],[19.2,25.6,u=>orbitW(u,0.4,-0.4)],[25.6,32,ST],[32,38.4,'head'],[38.4,42.6,UM],[42.6,46.8,UL],[46.8,51.2,ER],[51.2,99,u=>{const k=sm(Math.min(1,u*2.5)); shot([0,0.5+0.5*k,4.0+2.0*k],[0,0.15,-0.9]);}]],
       1:[[0,10,'head'],[10,18,wide],[18,26,SH],[26,34,UL],[34,42,UM],[42,50,u=>orbitW(u,-0.4,0.4)],[50,58,SH],[58,66,ST],[66,74,'head'],[74,99,u=>{const k=sm(Math.min(1,u*2)); shot([0,0.5+0.5*k,4.0+2.0*k],[0,0.15,-0.9]);}]]};
     const plan=PLANS[SONGI_F];
     const seg=plan.find(x=>t>=x[0]&&t<x[1]);
     if (seg[2]==='head') R.setCam('head'); else seg[2]((t-seg[0])/(seg[1]-seg[0]));
     window.__NOW=t; R.frame();
     return R.recCv.toDataURL('image/jpeg',0.92);
   }, [t,SONGI]);
   fs.writeFileSync(`frames/f${String(i).padStart(4,'0')}.jpg`, Buffer.from(url.split(',')[1],'base64'));
   if(i%60==0) console.log('frame',i,'/',total);
 }
 await b.close();
})();
