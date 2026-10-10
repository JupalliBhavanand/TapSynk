export const SPEECH_SAMPLE_RATE = 24000;
export class PcmDecoder {
  private carry: number | undefined;
  decode(bytes: Uint8Array) {
    let data = bytes;
    if (this.carry !== undefined) { data = new Uint8Array(bytes.length + 1); data[0] = this.carry; data.set(bytes, 1); }
    this.carry = data.length % 2 ? data[data.length - 1] : undefined;
    const samples = new Float32Array(Math.floor(data.length / 2));
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    return samples;
  }
  finish() { if (this.carry !== undefined) throw new Error("Audio stream ended mid-sample."); }
}
export function pcmWav(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (length % 2) throw new Error("Invalid PCM audio length.");
  const wav = new Uint8Array(44 + length);
  const view = new DataView(wav.buffer);
  const label = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) wav[offset + i] = text.charCodeAt(i); };
  label(0, "RIFF"); view.setUint32(4, 36 + length, true); label(8, "WAVE"); label(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, SPEECH_SAMPLE_RATE, true); view.setUint32(28, SPEECH_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, "data"); view.setUint32(40, length, true);
  let offset = 44;
  for (const chunk of chunks) { wav.set(chunk, offset); offset += chunk.length; }
  return wav;
}
