/** A tiny animated accent, encoded as GIF so it also works in email clients. */
export function signatureMotionGif(hex: string, loop: boolean) {
  const width = 36, height = 6, frames = 12;
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const chunks: Buffer[] = [];
  const bytes = (...values: number[]) => Buffer.from(values);
  chunks.push(Buffer.from("GIF89a"), bytes(width, 0, height, 0, 0x81, 0, 0), bytes(0, 0, 0, ...rgb, ...rgb.map(c => Math.round(c * .35 + 255 * .65)), 255, 255, 255));
  chunks.push(bytes(0x21, 0xff, 11), Buffer.from("NETSCAPE2.0"), bytes(3, 1, loop ? 0 : 1, 0, 0));
  for (let frame = 0; frame < frames; frame++) {
    chunks.push(bytes(0x21, 0xf9, 4, 9, 9, 0, 0, 0), bytes(0x2c, 0, 0, 0, 0, width, 0, height, 0, 0, 2));
    // Frequent clear codes keep the LZW dictionary at three bits; tiny images
    // stay small without a heavyweight image dependency or external service.
    const codes: number[] = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const dot = Math.floor(x / 12);
      const center = 2.5 + Math.sin(frame * Math.PI / 6 - dot * 1.1) * 1.1;
      const pixel = Math.hypot(x % 12 - 5.5, y - center) < 2 ? (dot === Math.floor(frame / 4) ? 1 : 2) : 0;
      codes.push(4, pixel);
    }
    codes.push(5);
    const packed: number[] = [];
    let value = 0, bits = 0;
    for (const code of codes) { value |= code << bits; bits += 3; while (bits >= 8) { packed.push(value & 255); value >>= 8; bits -= 8; } }
    if (bits) packed.push(value & 255);
    for (let i = 0; i < packed.length; i += 255) { const block = packed.slice(i, i + 255); chunks.push(bytes(block.length, ...block)); }
    chunks.push(bytes(0));
  }
  chunks.push(bytes(0x3b));
  return Buffer.concat(chunks);
}
