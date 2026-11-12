"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Square, ArrowRight } from "lucide-react";
import { productTourChapters as chapters, productTourVersion } from "@/lib/product-tour";

export function ProductVoiceTour() {
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState("");
  const stopped = useRef(true);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const media = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const [loading, setLoading] = useState(false);
  function clearAudio() {
    if (media.current) { media.current.onended = null; media.current.onerror = null; media.current.onplaying = null; media.current.pause(); media.current.removeAttribute("src"); media.current.load(); }
    if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; }
    window.speechSynthesis?.cancel();
  }
  function stop() {
    stopped.current = true;
    generation.current++;
    clearAudio();
    setLoading(false);
    setActive(null);
  }
  useEffect(() => () => {
    stopped.current = true;
    generation.current++;
    if (media.current) { media.current.onended = null; media.current.onerror = null; media.current.onplaying = null; media.current.pause(); media.current.removeAttribute("src"); media.current.load(); }
    if (utterance.current) { utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis?.cancel(); }
  }, []);
  function play(index = 0) {
    clearAudio();
    const ticket = ++generation.current;
    stopped.current = false;
    setError("");
    setLoading(true);
    const chapter = chapters[index];
    document.getElementById(chapter.id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    setActive(index);
    const current = () => !stopped.current && ticket === generation.current;
    const next = () => { if (current()) { if (index < chapters.length - 1) play(index + 1); else stop(); } };
    let fallbackStarted = false;
    function deviceVoice() {
      if (!current() || fallbackStarted) return;
      fallbackStarted = true;
      if (media.current) { media.current.onended = null; media.current.onerror = null; media.current.onplaying = null; media.current.pause(); }
      setLoading(false);
      if (!("speechSynthesis" in window)) { stop(); setError("Voice playback is unavailable. The product story is available in the transcript."); return; }
      setError("Studio audio is unavailable. Playing an energetic device voice.");
      const speech = new SpeechSynthesisUtterance(chapter.text);
      speech.lang = "en-US";
      speech.rate = 1.1;
      speech.pitch = 1.08;
      const voices = window.speechSynthesis.getVoices();
      speech.voice = voices.find(v => /^en/.test(v.lang) && /guy|ryan|daniel|jenny|google us english/i.test(v.name)) || voices.find(v => v.lang === "en-US") || null;
      speech.onend = next;
      speech.onerror = () => { if (current()) { stop(); setError("Playback stopped. You can replay the tour or read the transcript."); } };
      utterance.current = speech;
      window.speechSynthesis.speak(speech);
    }
    const audio = new Audio();
    media.current = audio;
    audio.preload = "auto";
    audio.onplaying = () => { if (current()) setLoading(false); };
    audio.onended = next;
    audio.onerror = deviceVoice;
    audio.src = `/api/product-tour?chapter=${index}&v=${productTourVersion}`;
    void audio.play().catch(deviceVoice);
  }
  return <div className="mt-5">
    <button type="button" onClick={() => active === null ? play() : stop()} className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white px-4 py-2 text-xs font-semibold text-brand shadow-sm transition hover:shadow-md">{active === null ? <Volume2 size={14} /> : <Square size={12} />}{active === null ? "Hear the TapSynk story" : (loading ? "Preparing your voice tour…" : "Stop voice tour")}<span className="text-[10px] font-normal text-muted">~90 sec</span></button>
    {error && <p role="status" className="mt-2 text-xs text-muted">{error}</p>}
    {active !== null && <aside aria-label="Product voice tour" className="fixed bottom-5 right-5 z-50 w-[calc(100%-40px)] max-w-sm rounded-2xl border border-brand/20 bg-white p-5 text-ink shadow-2xl">
      <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold text-brand"><Volume2 size={14} />TapSynk · Energetic voice tour · {active + 1}/{chapters.length}</span><button type="button" onClick={stop} aria-label="Stop voice tour" className="rounded-lg border border-line p-2"><Square size={12} /></button></div>
      <p className="mt-3 text-sm font-bold" aria-live="polite">{chapters[active].label}</p><p className="mt-2 text-xs leading-relaxed text-muted">{chapters[active].text}</p>
      <div className="mt-4 flex items-center gap-2">{chapters.map((chapter, index) => <span key={chapter.id} className={`h-1 flex-1 rounded-full ${index <= active ? "bg-brand" : "bg-line"}`} />)}{active < chapters.length - 1 && <button type="button" aria-label="Next tour highlight" onClick={() => { stop(); play(active + 1); }} className="ml-2 text-brand"><ArrowRight size={14} /></button>}</div>
    </aside>}
  </div>;
}
