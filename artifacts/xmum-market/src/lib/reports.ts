import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";

export type UserReportReason =
  | "spam"
  | "scam"
  | "harassment"
  | "offensive_content"
  | "impersonation"
  | "other";

export const USER_REPORT_REASONS: { value: UserReportReason; label: string }[] = [
  { value: "spam",              label: "Spam or unsolicited messages" },
  { value: "scam",              label: "Suspected scam or fraud" },
  { value: "harassment",        label: "Harassment or threats" },
  { value: "offensive_content", label: "Offensive or inappropriate content" },
  { value: "impersonation",     label: "Impersonation" },
  { value: "other",             label: "Other" },
];

export async function reportUser(
  reportedByUid: string,
  reportedUserId: string,
  reportedUserEmail: string,
  reason: UserReportReason
): Promise<void> {
  const label = USER_REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  await addDoc(collection(db, "reports"), {
    reportedUserId,
    reportedUserEmail,
    reportedBy: reportedByUid,
    reason: label.slice(0, 500),
    category: "user_report",
    status: "pending",
    createdAt: Date.now(),
  });
}
