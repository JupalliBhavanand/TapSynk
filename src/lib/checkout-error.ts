/** Never log raw Stripe errors: they can contain credentials or customer details. */
export function checkoutFailure(error: unknown) {
  const value = error && typeof error === "object" ? error as { type?: unknown; code?: unknown; param?: unknown; requestId?: unknown; message?: unknown } : {};
  const safe = (field: unknown) => typeof field === "string" && /^[a-zA-Z0-9_.\[\]-]{1,100}$/.test(field) ? field : undefined;
  const diagnostics = { type: safe(value.type), code: safe(value.code), param: safe(value.param), requestId: safe(value.requestId) };
  const invalidKey = value.type === "StripeAuthenticationError" || value.message === "Invalid STRIPE_SECRET_KEY configuration" || value.message === "Missing environment variable STRIPE_SECRET_KEY. See README → Environment variables.";
  return {
    diagnostics,
    message: invalidKey
      ? "Payments are not configured correctly. Please contact support."
      : "Payments aren't available right now. Please try again.",
  };
}
