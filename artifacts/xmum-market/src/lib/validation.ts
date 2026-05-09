/**
 * Validates a WhatsApp number.
 * Rules:
 *   - Must start with "+" followed by 1–3 digit country code.
 *   - Full number must be 7–15 digits (excluding the leading "+").
 *   - Allowed characters after "+": digits only (no spaces, dashes, parentheses).
 *   - Examples of VALID:   +60123456789  +1234567890  +447911123456
 *   - Examples of INVALID: 60123456789  +60  01234567  +60 12-345 6789
 */
export function validateWhatsApp(value: string): { valid: boolean; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true, error: "" };
  if (!trimmed.startsWith("+")) {
    return { valid: false, error: "WhatsApp number must start with a country code, e.g. +60123456789" };
  }
  const digitsOnly = trimmed.slice(1);
  if (!/^\d{7,15}$/.test(digitsOnly)) {
    return { valid: false, error: "Enter a valid international number, e.g. +60123456789 (7–15 digits after the +)" };
  }
  return { valid: true, error: "" };
}

export function suggestMalaysianFormat(value: string): string {
  const stripped = value.replace(/\D/g, "");
  if (stripped.startsWith("60")) return "+" + stripped;
  if (stripped.startsWith("0")) return "+6" + stripped;
  return value;
}
