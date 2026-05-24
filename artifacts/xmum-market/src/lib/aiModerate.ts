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

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

const SYSTEM_PROMPT = `You are a lenient, student-friendly content moderator for XMUM Market — a university student marketplace at Xiamen University Malaysia.

Your job is NOT to be strict. When in doubt, always return SAFE.

You will receive content in one of these contexts:
- "listing": a regular marketplace listing (buy-sell, lost-found, jobs, assistance, rental)
- "shop-listing": a product/service listed inside a student campus shop
- "shop-profile": a shop name and bio
- "inquiry": a message a student sends to a shop owner
- "review": a review comment left by a student about a shop

ONLY return BLOCKED for content that is OBVIOUSLY and CLEARLY one of these:
1. Scam patterns: asking for upfront deposits via personal transfer, advance fee fraud, "send money first", phishing links
2. Clearly illegal items: weapons, drugs, counterfeit IDs, pirated goods
3. Adult/sexual services or content
4. MLM or pyramid scheme recruitment

Return FLAGGED (posts but admin sees it) for:
- Possible scam job listings (e.g. "earn RM500/day work from home")
- Unusual pricing that might indicate fraud (e.g. iPhone 15 for RM50)
- Vague "services" that could be inappropriate

Return SAFE for absolutely everything else, including:
- Poor grammar, Manglish, broken English
- Very short or vague descriptions
- Low prices (student selling cheap is normal)
- Negative but honest reviews
- Students venting frustration in reviews
- Any content you are not highly confident about

Respond ONLY with a valid JSON object, no markdown, no explanation, exactly this shape:
{
  "result": "SAFE" | "FLAGGED" | "BLOCKED",
  "reason": "one short sentence, friendly tone, only if FLAGGED or BLOCKED",
  "suggestion": "one short friendly suggestion for the student to fix it, only if BLOCKED"
}`;

export async function moderateContent(
  content: string,
  context: ModerationContext
): Promise<ModerationResult> {
  if (!content || content.trim().length < 3) return FAIL_OPEN;

  if (!GEMINI_API_KEY) {
    console.warn("[aiModerate] VITE_GEMINI_API_KEY is not set — skipping moderation");
    return FAIL_OPEN;
  }

  const userPrompt = `Context: ${context}\n\nContent to check:\n${content.slice(0, 1500)}`;

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 120,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!geminiRes.ok) {
      if (geminiRes.status === 429) {
        return { result: "BLOCKED", reason: "Our content check is temporarily busy. Please wait a moment and try again.", suggestion: "Wait 30 seconds and resubmit your listing." };
      }
      return FAIL_OPEN;
    }

    const data = await geminiRes.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed: { result: string; reason?: string; suggestion?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return FAIL_OPEN;
    }

    const result = (["SAFE", "FLAGGED", "BLOCKED"].includes(parsed.result)
      ? parsed.result
      : "SAFE") as ModerationResult["result"];

    return {
      result,
      reason: parsed.reason ?? "",
      suggestion: parsed.suggestion ?? "",
    };
  } catch {
    return FAIL_OPEN;
  }
}
