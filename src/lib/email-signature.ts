import type { Card } from "@/lib/types";

export const SIGNATURE_WIDTH = 440;
export const COMPACT_SIGNATURE_WIDTH = 380;

export type SignatureCard = Pick<Card, "full_name" | "job_title" | "company" | "email" | "phone" | "accent"> & Partial<Pick<Card, "avatar_url" | "logo_url" | "website" | "socials">>;
export const signatureTemplates = [
  { id: "studio", name: "Lavender", category: "SIGNATURE", description: "Soft lavender, a social rail, and sculpted portrait panels.", color: "#665080" },
  { id: "executive", name: "Midnight", category: "DARK", description: "The same striking geometry in ink and muted lilac.", color: "#c5a8df" },
  { id: "minimal", name: "Pearl", category: "LIGHT", description: "Pale silver, crisp typography, and quiet violet details.", color: "#62557c" },
  { id: "editorial", name: "Rose", category: "WARM", description: "Blush paper and plum accents with an editorial finish.", color: "#925b75" },
] as const;
export const photoDesigns = [
  { id: "diagonal", name: "Diagonal accents" },
  { id: "arch", name: "Arch frame" },
  { id: "rounded", name: "Rounded frame" },
  { id: "plain", name: "Original photo / No design" },
] as const;
export type SignatureSettings = { template: typeof signatureTemplates[number]["id"]; color: string; font: "sans" | "serif"; compact: boolean; photoDesign?: typeof photoDesigns[number]["id"]; portrait: boolean; socials: boolean; motion: "none" | "reveal" | "float"; cta: string };
export const defaultSignatureSettings: SignatureSettings = { template: "studio", color: "#665080", font: "sans", compact: false, photoDesign: "diagonal", portrait: true, socials: true, motion: "none", cta: "Save my contact" };
export const escapeSignatureText = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function signatureUrl(value: string) {
  if (!value || (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value))) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

/** Preview assets belong to the running app, which may differ from the public profile domain. */
export function signaturePreviewHtml(html: string) {
  return html.replace(/(<img\b[^>]*\bsrc=")https?:\/\/[^/"\s]+(\/(?:signature\/[^"?]+\.png|api\/signature-(?:portrait|motion)(?:\?[^"<]*)?))"/g, '$1$2"');
}

/** The clipboard and preview use identical table-based HTML and PNG artwork. */
export function buildEmailSignature(card: SignatureCard, link: string, settings: SignatureSettings) {
  const e = escapeSignatureText;
  const brand = /^#[0-9a-f]{6}$/i.test(card.accent) ? card.accent : "#5654d9";
  const accent = /^#[0-9a-f]{6}$/i.test(settings.color) ? settings.color : brand;
  const palettes = {
    studio: { bg: "#e5cfe6", ink: "#29212f", muted: "#65546b", line: "#b7a0be", rail: "#e0c8e3" },
    executive: { bg: "#25212f", ink: "#f5edf8", muted: "#c3b3cd", line: "#64546f", rail: "#302939" },
    minimal: { bg: "#eeebf2", ink: "#302b3b", muted: "#71677e", line: "#c7bfce", rail: "#e4deeb" },
    editorial: { bg: "#efdadf", ink: "#462c3b", muted: "#836473", line: "#c9a8b7", rail: "#e7ccd5" },
  };
  const palette = palettes[settings.template];
  const font = settings.font === "serif" ? "Georgia,Times New Roman,serif" : "Arial,Helvetica,sans-serif";
  const profile = signatureUrl(link);
  const origin = profile ? new URL(profile).origin : "";
  const initials = card.full_name.split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join("") || "T";
  const avatar = settings.portrait ? signatureUrl(card.avatar_url || "") : "";
  const logo = signatureUrl(card.logo_url || "");
  const website = signatureUrl(card.website || "");
  const anchor = (url: string, content: string, label?: string) => url ? `<a href="${e(url)}" target="_blank" rel="noopener noreferrer"${label ? ` aria-label="${e(label)}"` : ""} style="text-decoration:none;color:inherit">${content}</a>` : content;
  const assets = `${origin}/signature`;
  const socialItems = [
    { name: "Website", icon: "web", url: website },
    { name: "Instagram", icon: "instagram", url: signatureUrl(card.socials?.instagram || "") },
    { name: "LinkedIn", icon: "linkedin", url: signatureUrl(card.socials?.linkedin || "") },
    { name: "YouTube", icon: "youtube", url: signatureUrl(card.socials?.youtube || "") },
    { name: "X", icon: "x", url: signatureUrl(card.socials?.x || "") },
  ].filter(item => item.url && (settings.socials || item.name === "Website"));
  const dark = settings.template === "executive";
  const socialRail = socialItems.map(item => `<tr><td align="center" style="padding:12px 0">${anchor(item.url, `<img src="${assets}/${item.icon}${dark ? "-light" : ""}.png" alt="${item.name}" width="16" height="16" style="display:block;border:0">`, `Open ${item.name}`)}</td></tr>`).join("");
  const mark = `<span data-signature-part="logo">${logo ? `<img src="${e(logo)}" alt="${e(card.company || "Company logo")}" width="34" height="34" style="display:block;object-fit:contain;border-radius:8px">` : `<span style="display:block;width:34px;line-height:34px;border-radius:8px;background:${accent};color:${dark ? "#25212f" : "#ffffff"};font-size:13px;font-weight:700;text-align:center">${e(initials)}</span>`}</span>`;
  const company = e(card.company || card.full_name || "Your brand");
  const pad = settings.compact ? 16 : 25;
  const height = settings.compact ? 208 : 242;
  const portraitParams = new URLSearchParams({ src: avatar, initials, color: accent.slice(1), theme: settings.template, design: settings.photoDesign || "diagonal", v: "3" });
  const portrait = `<img data-signature-part="portrait" src="${e(origin)}/api/signature-portrait?${e(portraitParams.toString())}" alt="${e(card.full_name)}" width="190" height="${height}" style="display:block;width:190px;height:${height}px;object-fit:contain;border:0">`;
  const contacts = [
    { value: card.email, url: card.email ? `mailto:${encodeURIComponent(card.email.trim()).replace(/%40/g, "@")}` : "" },
    { value: card.phone, url: `tel:${card.phone.replace(/[^+\d]/g, "")}` },
    { value: website.replace(/^https?:\/\//, "").replace(/\/$/, ""), url: website },
  ].filter(item => item.value).map(item => `<div style="font-size:14px;line-height:1.6;overflow-wrap:anywhere;color:${palette.muted}">${anchor(item.url, e(item.value))}</div>`).join("");
  const cta = e(settings.cta.trim() || "Save my contact");
  // Do not imply verification: the reference's blue badge is omitted for unverified profiles.
  let html = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="${palette.bg}" style="width:600px;max-width:600px;table-layout:fixed;font-family:${font};color:${palette.ink};background:${palette.bg};border:1px solid ${palette.line};border-radius:7px;border-collapse:separate"><tr>
    <td width="81" style="width:81px;padding:${pad}px 0 ${pad}px 20px;vertical-align:middle"><table role="presentation" cellpadding="0" cellspacing="0" width="56" style="width:56px;background:${palette.rail};border:1px solid ${palette.line};height:${settings.compact ? 208 : 242}px;border-radius:7px"><tr><td align="center" style="padding:14px 0 9px">${anchor(profile, mark, "Open my TapSynk profile")}</td></tr>${socialRail || `<tr><td style="height:80px">&nbsp;</td></tr>`}<tr><td style="height:9px"></td></tr></table></td>
    <td style="vertical-align:middle;padding:${pad}px ${settings.portrait ? 8 : 25}px ${pad}px 25px"><div style="font-size:25px;font-weight:500;letter-spacing:5px;line-height:1.3;overflow-wrap:anywhere;text-transform:uppercase;margin-bottom:14px;color:${palette.ink}"><img src="${logo ? e(logo) : `${assets}/brand${dark ? "-light" : ""}.png`}" width="33" height="27" alt="" style="display:inline-block;width:33px;height:27px;object-fit:contain;vertical-align:middle;margin-right:8px;border:0">${company}</div><div style="font-size:${card.full_name.length > 22 ? 18 : 22}px;font-weight:700;letter-spacing:-.5px;line-height:1.15;overflow-wrap:anywhere;color:${palette.ink}">${anchor(profile, e(card.full_name || "Your name"), "Open my TapSynk profile")}</div>${card.job_title ? `<div style="font-size:15px;line-height:1.5;margin-top:2px;color:${palette.muted};overflow-wrap:anywhere">${e(card.job_title)}</div>` : ""}<div style="margin-top:18px;margin-bottom:3px;font-size:13px;font-weight:700;line-height:1.4;overflow-wrap:anywhere;color:${palette.ink}">${company}</div>${contacts}<div style="margin-top:8px;font-size:12px;font-weight:700;color:${palette.ink}">${anchor(profile, `${cta} &#8599;`, "Open my TapSynk profile")}</div></td>
    ${settings.portrait ? `<td width="205" style="width:205px;padding:${pad}px 15px ${pad}px 0;vertical-align:middle">${anchor(profile, portrait, "Open my TapSynk profile")}</td>` : ""}
  </tr></table>`;
  const width = settings.compact ? COMPACT_SIGNATURE_WIDTH : SIGNATURE_WIDTH;
  const ratio = width / 600;
  // Real email dimensions, without transforms/zoom that email clients strip.
  html = html.replace(/style="([^"]*)"/g, (_, style: string) => `style="${style.replace(/([\d.]+)px/g, (_, value: string) => `${Math.round(Number(value) * ratio * 100) / 100}px`)}"`)
    .replace(/(width|height)="(\d+)"/g, (_, attribute: string, value: string) => `${attribute}="${Math.round(Number(value) * ratio)}"`);
  html = `<div data-signature-width="${width}" title="${cta}" style="width:${width}px;max-width:100%">${html}</div>`;
  const plain = [card.full_name, [card.job_title, card.company].filter(Boolean).join(" · "), card.email, card.phone, website, ...socialItems.filter(s => s.url !== website).map(s => s.url), link].filter(Boolean).join("\n");
  return { html, plain, accent };
}
