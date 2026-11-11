/* Minimal ZIP reader: central directory + DecompressionStream, JSON entries only. */
async function unzipJson(buf, onProgress) {
  const dv = new DataView(buf), n8 = new Uint8Array(buf), dec = new TextDecoder();
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
    const nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = dec.decode(n8.subarray(off + 46, off + 46 + nl));
    off += 46 + nl + el + cl;
    if (!/\.json$/i.test(name) || /__MACOSX/.test(name)) continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const raw = n8.subarray(start, start + csize);
    let bytes;
    if (method === 0) bytes = raw;
    else if (method === 8) {
      if (typeof DecompressionStream === "undefined") throw new Error("nostream");
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else continue;
    out.push({ name, text: dec.decode(bytes) });
    if (onProgress) await onProgress(k + 1, count, name);
  }
  return out;
}
