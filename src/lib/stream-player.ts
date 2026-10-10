import { PcmDecoder, SPEECH_SAMPLE_RATE } from "@/lib/pcm";

/** Schedule one continuous provider stream on the audio clock, without packet gaps. */
export class StreamPlayer {
  private decoder = new PcmDecoder();
  private sources = new Set<AudioBufferSourceNode>();
  private nextTime = 0;
  private ended = false;
  private stopped = false;
  private played = false;
  constructor(private context: AudioContext, private onDone: () => void, private onProgress: () => void) {}
  push(bytes: Uint8Array) {
    if (this.stopped) return;
    const samples = this.decoder.decode(bytes);
    if (!samples.length) return;
    const buffer = this.context.createBuffer(1, samples.length, SPEECH_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const start = Math.max(this.context.currentTime + 0.04, this.nextTime);
    this.nextTime = start + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
      if (!this.stopped) { this.onProgress(); this.complete(); }
    };
    source.start(start);
    this.played = true;
    this.onProgress();
  }
  end() {
    this.decoder.finish();
    if (!this.played) throw new Error("No audio returned.");
    this.ended = true;
    this.complete();
  }
  private complete() {
    if (this.ended && !this.sources.size && !this.stopped) { this.stopped = true; this.onDone(); }
  }
  stop() {
    this.stopped = true;
    for (const source of this.sources) { source.onended = null; try { source.stop(); source.disconnect(); } catch {} }
    this.sources.clear();
  }
}
