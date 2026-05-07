# XMUM Marketplace — Phase 2 Monetization & UX Prompt for Replit

## ⚠️ READ ALL FILES BEFORE WRITING A SINGLE LINE OF CODE

Read every file listed in the "Files to Read" section completely before making any changes. Do not skim. Do not start coding until you have read all of them. Confirm you have read them before writing code.

---

## Project Context

You are continuing work on XMUM Marketplace — a student-only marketplace for Xiamen University Malaysia (xmu.edu.my). The project is built with:

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + `wouter` (routing)
- **Backend:** Firebase Auth, Firestore, Cloud Storage
- **Package manager:** pnpm
- **Dev environment:** Replit

Phase 1 is complete and stable. Phase 2 adds monetization infrastructure.

---

## Files to Read Before Coding

```
artifacts/xmum-market/src/lib/types.ts
artifacts/xmum-market/src/lib/listings.ts
artifacts/xmum-market/src/lib/firebase.ts
artifacts/xmum-market/src/lib/notifications.ts
artifacts/xmum-market/src/pages/HomePage.tsx
artifacts/xmum-market/src/components/ListingCard.tsx
artifacts/xmum-market/src/components/Layout.tsx
artifacts/xmum-market/src/App.tsx
artifacts/xmum-market/src/hooks/use-dark-mode.ts
artifacts/xmum-market/firestore.indexes.json
artifacts/xmum-market/firestore.rules
artifacts/xmum-market/storage.rules
```

---

## DevSecOps Constraints — DO NOT VIOLATE

These rules are locked. Do not change them unless explicitly told to.

1. **No hardcoded secrets.** All Firebase config uses `import.meta.env.VITE_FIREBASE_*`.
2. **Firestore rules stay as-is** (users own-write only; listings create = @xmu.edu.my; update/delete = owner only).
3. **Storage rules stay as-is** (images only, 5MB limit, email-gated).
4. **`experimentalAutoDetectLongPolling: true`** must stay in the Firestore init.
5. **Never write payment confirmation from the browser to Firestore directly.** Payment status updates must be server-side only (Cloud Functions or backend).

---

## What Already Exists (Do NOT Re-Implement)

After reading the files you will confirm that these are already implemented:

- ✅ `ListingStatus` type (`"active" | "sold"`) in `types.ts`
- ✅ `markAsSold()` function in `listings.ts`
- ✅ "Mark as Sold" / "Mark as Resolved" button in `ListingCard.tsx`
- ✅ SOLD badge overlay in `ListingCard.tsx`
- ✅ Feed pagination with `getListingsPage()` using `limit` + `startAfter` cursors
- ✅ "Load More" button in `HomePage.tsx`
- ✅ Dark mode hook `useDarkMode()` in `use-dark-mode.ts` (persisted to localStorage)
- ✅ Ad placeholder `<div>` in `HomePage.tsx`
- ✅ Notification system (`notifications.ts`, `NotificationBell.tsx`)
- ✅ Messaging system (`messaging.ts`, `MessagesPage.tsx`)

---

## Your Task: Implement the Bump + Ads Monetization System

Implement the following in order. Do not move to the next task until the current one is complete and tested.

---

### TASK 1 — Add `sortKey` + `lastBumpedAt` to the Listing schema

**File:** `artifacts/xmum-market/src/lib/types.ts`

Add two optional fields to the `Listing` interface:

```typescript
lastBumpedAt?: number;   // ms timestamp — updated each time listing is bumped
sortKey?: number;        // = lastBumpedAt if bumped recently, else createdAt
```

Do not change any other fields. The `status?: ListingStatus` field already exists — keep it.

---

### TASK 2 — Add `sortKey` to new listings on creation

**File:** `artifacts/xmum-market/src/lib/listings.ts`

In the `createListing()` function, add `sortKey` to the document being written. It should equal `Date.now()` at creation time (same value as what `createdAt` will resolve to). Since `createdAt` uses `serverTimestamp()`, compute `sortKey` as a plain `Date.now()` number alongside it:

```typescript
export async function createListing(
  data: Omit<Listing, "id" | "createdAt" | "isArchived" | "status">
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(collection(db, "listings"), {
    ...data,
    createdAt: serverTimestamp(),
    sortKey: now,           // ← add this
    isArchived: false,
    status: "active",
  });
  return docRef.id;
}
```

---

### TASK 3 — Update `getListingsPage()` to sort by `sortKey`

**File:** `artifacts/xmum-market/src/lib/listings.ts`

Change the `orderBy` in `getListingsPage()` from `"createdAt"` to `"sortKey"`. Keep the `status === "active"` and `isArchived === false` filters exactly as they are. Keep the fallback block exactly as it is. Only change the `orderBy` field in the primary query constraints array:

**Before:**
```typescript
orderBy("createdAt", "desc"),
```

**After:**
```typescript
orderBy("sortKey", "desc"),
```

---

### TASK 4 — Add `bumpListing()` function

**File:** `artifacts/xmum-market/src/lib/listings.ts`

Add this function after `markAsSold()`. It updates `sortKey` and `lastBumpedAt` to the current timestamp, floating the listing to the top of the feed. It uses the same `Promise.race` timeout pattern already established in this file:

```typescript
export async function bumpListing(id: string): Promise<void> {
  const now = Date.now();
  await Promise.race([
    updateDoc(doc(db, "listings", id), {
      lastBumpedAt: now,
      sortKey: now,
    }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("timeout:bump-listing")), 6_000)
    ),
  ]);
}
```

---

### TASK 5 — Update `firestore.indexes.json`

**File:** `artifacts/xmum-market/firestore.indexes.json`

The existing indexes use `createdAt`. You must add a new composite index for the `sortKey`-based query. Add the following index to the `"indexes"` array. Do not remove the existing indexes:

```json
{
  "collectionGroup": "listings",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "type", "order": "ASCENDING" },
    { "fieldPath": "isArchived", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "sortKey", "order": "DESCENDING" }
  ]
}
```

---

### TASK 6 — Add `SponsoredAd` type

**File:** `artifacts/xmum-market/src/lib/types.ts`

Add this new interface at the end of the file:

```typescript
export interface SponsoredAd {
  id: string;
  businessName: string;
  tagline: string;
  imageUrl: string;
  ctaLabel: string;       // e.g. "Visit Us", "Order Now"
  ctaUrl: string;         // external link — WhatsApp, Instagram, website
  category?: string;      // optional: only show in certain feed tabs
  startsAt: number;
  endsAt: number;
  isActive: boolean;
  impressions: number;
  clicks: number;
}
```

---

### TASK 7 — Create `src/lib/ads.ts`

**File:** `artifacts/xmum-market/src/lib/ads.ts` *(new file)*

Create this new file:

```typescript
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "./firebase";
import { SponsoredAd } from "./types";

export async function getActiveAds(count = 2): Promise<SponsoredAd[]> {
  try {
    const now = Date.now();
    const q = query(
      collection(db, "ads"),
      where("isActive", "==", true),
      where("endsAt", ">", now),
      limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SponsoredAd));
  } catch {
    // Ads are non-critical — silently return empty array on any error
    return [];
  }
}
```

---

### TASK 8 — Create `SponsoredAdCard.tsx` component

**File:** `artifacts/xmum-market/src/components/SponsoredAdCard.tsx` *(new file)*

Create this component. It must match the existing card style (white bg, rounded-2xl, shadow-sm, dark mode support). The "Sponsored" label must always be visible and never hidden:

```typescript
import { ExternalLink } from "lucide-react";
import { SponsoredAd } from "@/lib/types";

interface Props {
  ad: SponsoredAd;
}

export default function SponsoredAdCard({ ad }: Props) {
  const handleClick = () => {
    // In production, a Cloud Function would increment ad.clicks here.
    // For now, just open the CTA URL safely.
    window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 shadow-sm">
      {/* "Sponsored" badge — must always be visible */}
      <div className="absolute top-2 left-2 z-10">
        <span className="text-[10px] font-semibold uppercase tracking-wider
                         bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300
                         px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
          Sponsored
        </span>
      </div>

      {/* Ad image */}
      <div className="aspect-[4/3] w-full bg-muted overflow-hidden">
        <img
          src={ad.imageUrl}
          alt={ad.businessName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="font-semibold text-sm text-gray-900 dark:text-slate-100">
          {ad.businessName}
        </p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">
          {ad.tagline}
        </p>
        <button
          onClick={handleClick}
          className="mt-3 w-full flex items-center justify-center gap-1.5
                     bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold
                     py-2 px-3 rounded-xl transition-colors min-h-[44px]"
        >
          {ad.ctaLabel}
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
```

---

### TASK 9 — Inject ads into `HomePage.tsx`

**File:** `artifacts/xmum-market/src/pages/HomePage.tsx`

Read the current `HomePage.tsx` completely before editing. Make these minimal, targeted changes:

**9a. Add imports at the top** (alongside existing imports):
```typescript
import { getActiveAds } from "@/lib/ads";
import { SponsoredAd } from "@/lib/types";
import SponsoredAdCard from "@/components/SponsoredAdCard";
```

**9b. Add ads state** (alongside existing `useState` declarations):
```typescript
const [ads, setAds] = useState<SponsoredAd[]>([]);
```

**9c. Fetch ads once on mount** (add a new `useEffect`, separate from the existing listings `useEffect`):
```typescript
useEffect(() => {
  getActiveAds(2).then(setAds);
}, []);
```

**9d. Replace the existing ad placeholder div** with real ad injection logic.

Find this block in `HomePage.tsx`:
```tsx
{/* Ad Space — placeholder for future advertisements */}
{/* TODO: Replace with real ad network code (e.g. Google AdSense) when ready */}
<div className="max-w-5xl mx-auto px-4 mt-4">
  <div className="w-full h-16 bg-gray-100 dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex items-center justify-center">
    <p className="text-xs text-gray-400 dark:text-slate-600 font-medium tracking-wide uppercase">
      Advertisement
    </p>
  </div>
</div>
```

Replace it with:
```tsx
{/* Sponsored ads — injected every INJECT_EVERY listings */}
{/* Only show top banner ad when ads are available */}
{ads.length > 0 && (
  <div className="max-w-5xl mx-auto px-4 mt-4">
    <SponsoredAdCard ad={ads[0]} />
  </div>
)}
```

**9e. Inject ads inline in the listing grid** by updating the grid rendering. Find the listings grid section (the `<div className="grid ...">` that maps `displayedListings`) and replace just the content of that grid to interleave ad cards every 6 listings:

Replace:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {displayedListings.map((listing) => (
    <ListingCard key={listing.id} listing={listing} />
  ))}
</div>
```

With:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {displayedListings.map((listing, i) => (
    <>
      <ListingCard key={listing.id} listing={listing} />
      {/* Inject second ad after every 6th listing, if available */}
      {(i + 1) % 6 === 0 && ads[1] && (
        <SponsoredAdCard key={`ad-${i}`} ad={ads[1]} />
      )}
    </>
  ))}
</div>
```

---

### TASK 10 — Update Firestore rules to include the `ads` collection

**File:** `artifacts/xmum-market/firestore.rules`

Add one new match block to the existing rules. Do not change any existing rules. Add after the `listings` block:

```
match /ads/{adId} {
  allow read: if true;
  allow write: if false;  // Admin only — managed via Firebase console or Cloud Functions
}
```

---

### TASK 11 — Add Bump button to ProfilePage (owner view)

**File:** `artifacts/xmum-market/src/pages/ProfilePage.tsx`

Read `ProfilePage.tsx` completely before editing.

The profile page already shows the user's own listings with "Mark as Sold", "Edit", and "Delete" buttons via `ListingCard`. You need to add a "Bump" button that calls `bumpListing()`.

Find the section in `ProfilePage.tsx` where `ListingCard` is rendered for owned listings. It will look something like:

```tsx
<ListingCard
  listing={listing}
  showDelete
  showMarkSold
  showEdit
  onMarkSold={...}
  onDelete={...}
  onEdit={...}
/>
```

**Step 1:** Import `bumpListing` at the top of `ProfilePage.tsx`:
```typescript
import { bumpListing } from "@/lib/listings";
```

**Step 2:** Add a bump handler function inside the component. Add it alongside the existing `handleDelete` and `handleMarkSold` handlers:
```typescript
const handleBump = async (listing: Listing) => {
  if (listing.status === "sold") return;
  try {
    await bumpListing(listing.id);
    toast.success(lang === "en" ? "Listing bumped to top!" : "已置顶！");
  } catch (err: any) {
    toast.error(lang === "en" ? "Failed to bump listing" : "置顶失败");
  }
};
```

**Step 3:** Add a "Bump" button directly below the existing action buttons on the owned listing card. Since `ListingCard` already has its own action button slots, add the bump button as a standalone `<button>` element just below the `<ListingCard>` component in the grid, wrapped in the same card container if applicable. If `ProfilePage.tsx` renders action buttons separately outside of `ListingCard`, add the bump button there. Adapt to what you actually see in the file.

The button should:
- Only appear if `listing.status !== "sold"`
- Show a rocket/arrow-up icon (use `ArrowUp` from lucide-react)
- Have a subtle style: `text-xs text-purple-600 border border-purple-200 rounded-lg py-1.5 hover:bg-purple-50 transition-colors w-full min-h-[44px]`
- Text: `lang === "en" ? "Bump to Top" : "置顶"`

---

### TASK 12 — Data migration note (add as a code comment, not code)

**File:** `artifacts/xmum-market/src/lib/listings.ts`

Add this comment block above the `createListing` function:

```typescript
// ── MIGRATION NOTE ────────────────────────────────────────────────────────────
// Existing listing documents do NOT have a sortKey field.
// Before deploying to production, run a one-time migration script that sets
// sortKey = createdAt for all existing documents, or the new sortKey-based
// index/query will return inconsistent results.
// New listings created after this deployment will have sortKey set automatically.
// ──────────────────────────────────────────────────────────────────────────────
```

---

## Testing Checklist

After implementing all tasks, verify the following:

- [ ] `pnpm run typecheck` passes with no errors
- [ ] A new listing created after these changes has `sortKey` set in Firestore (check Firebase console)
- [ ] The home feed still loads and paginates correctly
- [ ] Existing listings without `sortKey` fall back gracefully (the index fallback in `getListingsPage` handles this)
- [ ] `SponsoredAdCard` renders correctly in dark mode
- [ ] The "Bump" button appears only on active (non-sold) listings in Profile
- [ ] No hardcoded Firebase keys exist anywhere in source files
- [ ] No TypeScript errors on new files

---

## What NOT to Change

- Do not touch `AuthModal.tsx`
- Do not touch `auth.ts`
- Do not touch `userProfile.ts`
- Do not touch `storage.rules`
- Do not touch the existing Firestore security rules blocks (only ADD the new `ads` block)
- Do not touch the `use-dark-mode.ts` hook (dark mode is already working)
- Do not add `react-query` usage — state is managed with `useState`/`useEffect` directly in this project
- Do not change the `wouter` routing setup in `App.tsx`
- Do not remove the index fallback logic in `getListingsPage()`

---

## Summary of All File Changes

| File | Action |
|------|--------|
| `src/lib/types.ts` | Add `lastBumpedAt?`, `sortKey?` to Listing; add `SponsoredAd` interface |
| `src/lib/listings.ts` | Add `sortKey` to `createListing()`; change `orderBy` to `sortKey`; add `bumpListing()`; add migration comment |
| `src/lib/ads.ts` | **NEW** — `getActiveAds()` function |
| `src/components/SponsoredAdCard.tsx` | **NEW** — Ad card component |
| `src/pages/HomePage.tsx` | Import ads; fetch ads on mount; replace placeholder; inject ad cards in grid |
| `src/pages/ProfilePage.tsx` | Import `bumpListing`; add `handleBump`; add Bump button to owned listings |
| `firestore.indexes.json` | Add `sortKey` composite index |
| `firestore.rules` | Add `ads` collection rule (read=true, write=false) |
