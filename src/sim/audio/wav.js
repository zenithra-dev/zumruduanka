// AudioBuffer → 16 bit stereo WAV (base64). Araçlar offline render çıktısını diske yazmak için kullanır.
export function peakOf(buf){
  let pk = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++){ const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); }
  return pk;
}
export function encodeWav(buf, gain = 1){
  const n = buf.length, SR = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const dv = new DataView(new ArrayBuffer(44 + n * 4));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, 36 + n * 4, true); ws(8, "WAVE"); ws(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, "data"); dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++){ dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * gain)) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * gain)) * 32767, true); }
  const bytes = new Uint8Array(dv.buffer); let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return btoa(bin);
}
