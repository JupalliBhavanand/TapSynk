"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Check, Copy, Download, Mail, RotateCcw, Sparkles } from "lucide-react";
import { buildEmailSignature, signaturePreviewHtml, defaultSignatureSettings, SIGNATURE_WIDTH, photoDesigns, signatureTemplates, type SignatureCard, type SignatureSettings } from "@/lib/email-signature";
import { hostedSignatureImage, linkedEmailSignature, signaturePng } from "@/lib/signature-image";
import styles from "./EmailSignature.module.css";

export function SignaturePreview({ html, className = "", label }: { html: string; className?: string; label?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const width = Number(html.match(/data-signature-width="(\d+)"/)?.[1]) || SIGNATURE_WIDTH;
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.max(0.1, entry.contentRect.width / width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [width]);
  return <div ref={container} className={`${styles.previewContainer} ${className}`} aria-label={label}><div className={styles.markup} style={{ zoom: scale, width }} dangerouslySetInnerHTML={{ __html: signaturePreviewHtml(html) }} /></div>;
}

export function EmailSignature({ card, link }: { card: SignatureCard; link: string }) {
  const [copied, setCopied] = useState<"rich" | "html" | "exact" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<SignatureSettings>(defaultSignatureSettings);
  const [ready, setReady] = useState(false);
  const storageKey = `tapsync:signature:${link}`;
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved: Partial<SignatureSettings> = {};
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (parsed && typeof parsed === "object") {
          if (signatureTemplates.some(t => t.id === parsed.template)) saved.template = parsed.template;
          if (/^#[0-9a-f]{6}$/i.test(parsed.color)) saved.color = parsed.color;
          if (photoDesigns.some(d => d.id === parsed.photoDesign)) saved.photoDesign = parsed.photoDesign;
          if (["sans", "serif"].includes(parsed.font)) saved.font = parsed.font;
          if (["none", "reveal", "float"].includes(parsed.motion)) saved.motion = parsed.motion;
          for (const key of ["compact", "portrait", "socials"] as const) if (typeof parsed[key] === "boolean") saved[key] = parsed[key];
          if (typeof parsed.cta === "string") saved.cta = parsed.cta.slice(0, 36);
        }
      } catch { /* Browser storage is optional. */ }
      setSettings({ ...defaultSignatureSettings, ...saved });
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);
  function customize(update: Partial<SignatureSettings>) {
    const next = { ...settings, ...update };
    setSettings(next);
    setCopied(null);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep session customization available. */ }
  }
  const { html, plain, accent } = buildEmailSignature(card, link, settings);
  const activeTemplate = signatureTemplates.find(t => t.id === settings.template)!;
  const [replay, setReplay] = useState(0);

  async function copy(kind: "rich" | "html") {
    setError(""); setCopied(null); setExporting(true);
    try {
      if (kind === "rich") {
        if (!("ClipboardItem" in window)) throw new Error("Rich copy is unavailable. Use HTML to copy the linked signature markup.");
        const content = linkedEmailSignature(html);
        await navigator.clipboard.write([new ClipboardItem({ "text/html": content, "text/plain": new Blob([plain], { type: "text/plain" }) })]);
      } else {
        const content = await linkedEmailSignature(html);
        await navigator.clipboard.writeText(await content.text());
      }
      setCopied(kind);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not prepare the signature. Please try again."); }
    finally { setExporting(false); }
  }

  async function copyExact() {
    setError(""); setCopied(null); setExporting(true);
    try {
      if (!("ClipboardItem" in window)) throw new Error("Use Download PNG, then insert the image in your email signature settings.");
      const content = hostedSignatureImage(html, link, plain);
      // Start the clipboard write in the click event; rendering resolves through the promise.
      await navigator.clipboard.write([new ClipboardItem({ "text/html": content, "text/plain": new Blob([plain], { type: "text/plain" }) })]);
      setCopied("exact");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not copy. Download the PNG and insert it in your email settings."); }
    finally { setExporting(false); }
  }
  async function download() {
    setError(""); setExporting(true);
    try {
      const png = await signaturePng(html);
      const url = URL.createObjectURL(png);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "tapsynk-email-signature.png"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not download signature. Please try again."); }
    finally { setExporting(false); }
  }

  return (
    <div className={styles.editor} style={{ "--signature-accent": accent } as CSSProperties}>
      <section className={styles.gallery} aria-labelledby="template-heading">
        <div className={styles.sectionHeading}><div><span className={styles.step}>01</span><h2 id="template-heading">Find your signature style</h2></div><span>One signature. Four tonal palettes.</span></div>
        <div className={styles.templateGrid}>
          {signatureTemplates.map(t => <button type="button" key={t.id} aria-pressed={settings.template === t.id} disabled={!ready} onClick={() => customize({ template: t.id, color: t.color, font: t.id === "editorial" ? "serif" : "sans" })} className={`${styles.templateOption} ${settings.template === t.id ? styles.selected : ""}`}>
            <div className={styles.thumbnail} aria-hidden="true" inert><SignaturePreview html={buildEmailSignature(card, link, { ...settings, template: t.id, color: t.color, font: t.id === "editorial" ? "serif" : "sans", compact: false, portrait: true }).html} /></div>
            <div className={styles.templateInfo}><div><small>{t.category}</small><strong>{t.name}</strong></div><span className={styles.selectionDot}>{settings.template === t.id && <Check size={12} />}</span></div>
            <p>{t.description}</p>
          </button>)}
        </div>
      </section>
      <div className={styles.workspace}>
        <section className={styles.designPanel} aria-labelledby="design-heading">
          <div className={styles.sectionHeading}><div><span className={styles.step}>02</span><h2 id="design-heading">Make it yours</h2></div></div>
          <fieldset className={styles.controls} disabled={!ready}>
            <legend className="sr-only">Customize your signature</legend>
            <label>Brand color<span className={styles.colorControl}><input aria-label="Custom accent color" type="color" value={accent} onChange={e => customize({ color: e.target.value })} /><span>{accent.toUpperCase()}</span><button type="button" onClick={() => customize({ color: "" })}>Use card color</button></span></label>
            <div className={styles.swatches} aria-label="Suggested colors">{["#665080", "#925b75", "#c5a8df", "#62557c", "#45334f", "#8a7799"].map(color => <button type="button" key={color} aria-label={`Use ${color}`} aria-pressed={accent.toLowerCase() === color} style={{ background: color }} onClick={() => customize({ color })}>{accent.toLowerCase() === color && <Check size={12} />}</button>)}</div>
            <label>Typography<select value={settings.font} onChange={e => customize({ font: e.target.value as SignatureSettings["font"] })}><option value="sans">Modern / Sans serif</option><option value="serif">Classic / Serif</option></select></label>
            <label>Contact link text<input maxLength={36} value={settings.cta} onChange={e => customize({ cta: e.target.value })} placeholder="Save my contact" /></label>
            <label>Photo design<select value={settings.photoDesign || "diagonal"} onChange={e => customize({ photoDesign: e.target.value as SignatureSettings["photoDesign"] })}>{photoDesigns.map(design => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label>
            <p className={styles.saved}>Your full photo stays visible in every style. Frames sit around the photo.</p>
            <label>Animation<select value={settings.motion} onChange={e => customize({ motion: e.target.value as SignatureSettings["motion"] })}><option value="reveal">Smooth entrance</option><option value="float">Floating portrait</option><option value="none">Still / No animation</option></select></label>
            <div className={styles.toggles}>{([["portrait", "Profile portrait"], ["socials", "Social links"], ["compact", "Compact layout"]] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="checkbox" role="switch" checked={settings[key]} onChange={e => customize({ [key]: e.target.checked })} /></label>)}</div>
            <button type="button" className={styles.reset} onClick={() => customize(defaultSignatureSettings)}><RotateCcw size={13} />Reset design</button>
          </fieldset>
          <p className={styles.saved}>Design preferences are saved in this browser.</p>
        </section>
        <section className={styles.previewPanel} aria-labelledby="preview-heading">
          <div className={styles.sectionHeading}><div><span className={styles.liveDot} /><h2 id="preview-heading">Your signature, in context</h2></div><button type="button" onClick={() => setReplay(v => v + 1)} className={styles.replay}><RotateCcw size={12} /> Replay</button></div>
          <div className={styles.emailStage}>
            <div className={styles.emailWindow}>
              <div className={styles.emailToolbar}><span className={styles.windowDots}><i /><i /><i /></span><span>New message</span><Mail size={13} /></div>
              <div className={styles.emailTo}><span>To</span> your next connection</div>
              <div className={styles.emailSubject}>A great connection starts here.</div>
              <div className={styles.emailBody}><p>Hello,</p><p>It was a pleasure connecting. Looking forward to what’s next.</p><p>Best,</p>
                <div key={`${settings.template}-${settings.motion}-${replay}`} className={`${styles.signature} ${settings.template === "studio" ? styles.studio : ""} ${styles[settings.motion]}`}><SignaturePreview html={html} label={`${activeTemplate.name} signature preview`} /></div>
              </div>
              <div className={styles.emailFooter}><span className={styles.footerPill}><Sparkles size={11} /> {activeTemplate.name}</span><span>Your next impression, beautifully signed.</span></div>
            </div>
          </div>
          <div id="signature-export" className={styles.exportBar}><div><h3>A clickable signature, sized for email</h3><p>440 px wide, or 380 px with Compact layout. Copy the email signature to keep every link clickable. Photos and icons are saved as public images so they can load in email. The website preview expands to fit this panel.</p></div><div className={styles.copyActions}>
            <button type="button" disabled={exporting || !ready} onClick={() => copy("rich")} className="btn btn-dark py-2 text-xs">{copied === "rich" ? <Check size={14} /> : <Copy size={14} />}{exporting ? "Preparing…" : copied === "rich" ? "Copied" : "Copy email signature"}<ArrowUpRight size={13} /></button>
            <button type="button" disabled={exporting || !ready} onClick={copyExact} className="btn btn-ghost py-2 text-xs disabled:opacity-50">{copied === "exact" ? <Check size={14} /> : <Copy size={14} />}{exporting ? "Preparing…" : copied === "exact" ? "Profile image copied" : "Copy image (profile link)"}</button>
            <button type="button" disabled={exporting || !ready} onClick={download} className="btn btn-ghost py-2 text-xs disabled:opacity-50"><Download size={14} />Download PNG</button>
            <button type="button" disabled={exporting || !ready} onClick={() => copy("html")} className="btn btn-ghost py-2 text-xs">{copied === "html" ? <Check size={14} /> : <Copy size={14} />}{copied === "html" ? "Copied HTML" : "HTML"}</button>

          </div></div>
          <div className={styles.emailInstructions}><h3>Add it to your email</h3><ol><li>Choose your template and photo design, then click <strong>Copy email signature</strong>.</li><li>Open your email app’s signature settings, paste the signature, and save.</li><li>Send yourself a test email and check the website, social icons, and profile links.</li></ol><p>Replace the old pasted signature with this newly copied version. Recipients may need to allow images. Use Copy email signature for individual links. Copy image and Download PNG preserve the artwork but support only one link for the whole image.</p></div>
          <p role="status" className={styles.status} hidden={!error && !copied}>{error || (copied ? "Copied to clipboard." : "")}</p>
        </section>
      </div>
    </div>
  );
}
