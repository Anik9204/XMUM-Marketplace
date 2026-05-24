import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

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

const _moderateFn = httpsCallable<
  { text: string; context: string; photoUrls?: string[] },
  ModerationResult
>(functions, "moderateContent");

export async function moderateContent(
  content: string,
  context: ModerationContext,
  photoUrls?: string[]
): Promise<ModerationResult> {
  if (!content || content.trim().length < 3) return FAIL_OPEN;

  try {
    const res = await _moderateFn({
      text: content,
      context,
      photoUrls: photoUrls ?? [],
    });
    const data = res.data;
    if (!data || !["SAFE", "FLAGGED", "BLOCKED"].includes(data.result)) {
      return FAIL_OPEN;
    }
    return data;
  } catch (err: any) {
    // If the function is unavailable, fail open so students are not blocked
    console.warn("[aiModerate] Cloud Function call failed, failing open:", err?.message);
    return FAIL_OPEN;
  }
}
