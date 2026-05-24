export type ModerationContext =
  | "listing"
  | "shop-listing"
  | "shop-profile"
  | "inquiry"
  | "review";

export interface ModerationResult {
  result: "SAFE" | "FLAGGED" | "BLOCKED";
  reason: string;
  suggestion: string;
}

const FAIL_OPEN: ModerationResult = { result: "SAFE", reason: "", suggestion: "" };

export async function moderateContent(
  content: string,
  context: ModerationContext
): Promise<ModerationResult> {
  if (!content || content.trim().length < 3) return FAIL_OPEN;
  try {
    const res = await fetch("/api/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, context }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return FAIL_OPEN;
    const data = await res.json();
    if (!["SAFE", "FLAGGED", "BLOCKED"].includes(data.result)) return FAIL_OPEN;
    return data as ModerationResult;
  } catch {
    return FAIL_OPEN;
  }
}
