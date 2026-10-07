/** The card's AI button. Shared by the public card and the editor previews. */
export const AI_BUTTON = "Ask my AI anything";
export const AI_BUTTON_SUB = "It talks back, in any language";

/** One or two short sentences about the business, taken from what the owner wrote. */
export function introLine(description: string | null | undefined) {
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > 200) break;
    out += s;
  }
  out = (out || sentences[0]!).trim();
  if (out.length > 220) out = `${out.slice(0, 217).replace(/\s+\S*$/, "")}…`;
  return /[.!?…]$/.test(out) ? out : `${out}.`;
}

export function greetingFor({ businessName, ownerName, intro, booking, voice }: { businessName: string; ownerName: string; intro: string; booking: boolean; voice: boolean }) {
  const first = ownerName.split(" ")[0] || ownerName;
  return [
    `Hi there! 👋 I'm the AI assistant for ${businessName}.`,
    intro,
    booking
      ? `I can answer any questions you have, or book a time for you to meet ${first}.`
      : `I can answer any questions you have about what we do.`,
    voice ? "What would you like to know? Type, or tap the mic and talk to me in any language." : "What would you like to know?",
  ]
    .filter(Boolean)
    .join(" ");
}
