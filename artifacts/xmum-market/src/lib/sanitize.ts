export function sanitizeText(
  input: string,
  maxLength: number
): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, maxLength);
}

export function sanitizeListingData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...data };
  if (typeof out.title === "string")
    out.title = sanitizeText(out.title, 100);
  if (typeof out.description === "string")
    out.description = sanitizeText(out.description, 1000);
  if (typeof out.meetupSpot === "string")
    out.meetupSpot = sanitizeText(out.meetupSpot, 200);
  if (typeof out.wechat === "string")
    out.wechat = sanitizeText(out.wechat, 50);
  if (typeof out.whatsapp === "string")
    out.whatsapp = out.whatsapp.replace(/[^\d+]/g, "").slice(0, 20);
  if (typeof out.price === "number")
    out.price = Math.max(0, Math.min(1_000_000, out.price));
  return out;
}
