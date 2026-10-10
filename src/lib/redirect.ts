/** Browser URL normalization treats backslashes and control characters as URL syntax. */
export function safeRedirectPath(raw: unknown, fallback = "/dashboard") {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u0020]/.test(raw)) return fallback;
  try {
    const target = new URL(raw, "https://tapsynk.invalid");
    return target.origin === "https://tapsynk.invalid" ? target.pathname + target.search + target.hash : fallback;
  } catch { return fallback; }
}
