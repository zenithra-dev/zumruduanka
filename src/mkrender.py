s=open('claude-gitar.html').read()
rep=[
("ctx = new (window.AudioContext || window.webkitAudioContext)();","ctx = window.__OFF || new (window.AudioContext || window.webkitAudioContext)();"),
("const now = ctx ? ctx.currentTime : 0;\n  const wall = performance.now() / 1000;","const now = window.__NOW !== undefined ? window.__NOW : (ctx ? ctx.currentTime : 0);\n  const wall = window.__NOW !== undefined ? window.__NOW : performance.now() / 1000;"),
("  if (recording){\n    rg.drawImage","  if (recording || window.__MANUAL){\n    rg.drawImage"),
("  requestAnimationFrame(frame);\n}","  if (!window.__MANUAL) requestAnimationFrame(frame);\n}"),
("requestAnimationFrame(frame);\n})();","if (!window.__MANUAL) requestAnimationFrame(frame);\nwindow.__R = {resetAudio(){ ctx = null;  }, get playing(){ return playing; }, groupCam, DRUM, bassNote, get ctx(){return ctx}, frame, startPlay, SONGS, recCv, setCam(m){camMode=m; setHud();}, orbit, placeCams, get end(){return playing && playing.end}};\n})();"),
("if (now > playing.end){","if (!window.__MANUAL && now > playing.end){"),
]
for a,b in rep:
  assert a in s, a; s=s.replace(a,b)
s=s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>','<script>window.__MANUAL=true;</script><script>'+open('vendor/three.min.js').read()+'</script>')
open('render.html','w').write('<!doctype html><html><head><meta charset=utf-8></head><body>'+s+'</body></html>')
