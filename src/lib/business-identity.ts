/** Website facts can replace a legacy platform label, never an owner's custom business name. */
export function learnedBusinessName(knowledge: string | null | undefined) {
  const text = (knowledge || "").trim();
  const explicit = text.match(/^\s*(?:\*\*)?Business name(?:\*\*)?\s*:\s*(.+)$/im)?.[1];
  const overview = text.match(/(?:^|\n)(?:#{1,3}\s*)?Overview\s*\n+\s*([^\n]{1,120}?)\s+is\s+(?:an?\s)/i)?.[1];
  return (explicit || overview || "").replace(/\*\*/g, "").trim().slice(0, 120);
}

export function businessIdentity(name: string | null | undefined, company: string | null | undefined, owner: string, knowledge?: string | null) {
  const platform = (value: string) => /^tap\s*s[yi]n[ck]$/i.test(value.trim());
  const configured = name?.trim() || "";
  if (configured && !platform(configured)) return configured;
  const learned = learnedBusinessName(knowledge);
  if (learned && !platform(learned)) return learned;
  if (company?.trim() && !platform(company)) return company.trim();
  return owner.trim() || "this business";
}
