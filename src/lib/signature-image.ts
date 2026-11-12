"use client";

import { SIGNATURE_WIDTH, signaturePreviewHtml } from "@/lib/email-signature";

/** Flatten the same HTML used in the preview; embed every image before drawing. */
export async function signaturePng(html: string): Promise<Blob> {
  const width = Number(html.match(/data-signature-width="(\d+)"/)?.[1]) || SIGNATURE_WIDTH;
  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;pointer-events:none`;
  container.innerHTML = signaturePreviewHtml(html);
  document.body.appendChild(container);
  try {
    await Promise.all(Array.from(container.querySelectorAll("img")).map(async image => {
      const response = await fetch(image.src);
      if (!response.ok) throw new Error("A signature image could not load. Please try again.");
      const blob = await response.blob();
      image.src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read a signature image.")); reader.readAsDataURL(blob); });
      await image.decode();
    }));
    const height = Math.ceil(container.getBoundingClientRect().height);
    const content = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    content.setAttribute("style", `width:${width}px;background:transparent;line-height:normal`);
    content.innerHTML = container.innerHTML;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="${width}" height="${height}">${new XMLSerializer().serializeToString(content)}</foreignObject></svg>`;
    const image = new Image();
    // A data URL with embedded images keeps the canvas origin-clean.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width * 2; canvas.height = height * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const bytes = Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]), character => character.charCodeAt(0));
    return new Blob([bytes], { type: "image/png" });
  } finally { container.remove(); }
}

export async function hostedSignatureImage(html: string, profile: string, plain: string) {
  const width = Number(html.match(/data-signature-width="(\d+)"/)?.[1]) || SIGNATURE_WIDTH;
  const png = await signaturePng(html);
  const form = new FormData(); form.set("image", png, "signature.png");
  const response = await fetch("/api/signature-export", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok || !result.url) throw new Error(result.error || "Could not prepare email signature.");
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Blob([`<a href="${escape(profile)}" target="_blank"><img src="${escape(result.url)}" alt="${escape(plain)}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0" /></a>`], { type: "text/html" });
}

/** Store all visual assets publicly before copying, preserving every individual anchor. */
export async function linkedEmailSignature(html: string): Promise<Blob> {
  const document = new DOMParser().parseFromString(signaturePreviewHtml(html), "text/html");
  const images = Array.from(document.querySelectorAll("img"));
  const sources = [...new Set(images.map(image => image.getAttribute("src")!))];
  const form = new FormData(); form.set("kind", "assets");
  await Promise.all(sources.map(async (source, index) => {
    const response = await fetch(new URL(source, window.location.origin));
    if (!response.ok) throw new Error("A signature image could not load. Refresh the page and try again.");
    form.set(`asset-${index}`, await response.blob(), `asset-${index}.png`);
  }));
  const response = await fetch("/api/signature-export", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.urls) || result.urls.length !== sources.length) throw new Error(result.error || "Could not prepare your signature images.");
  images.forEach(image => { image.src = result.urls[sources.indexOf(image.getAttribute("src")!)]; });
  return new Blob([document.body.innerHTML], { type: "text/html" });
}
