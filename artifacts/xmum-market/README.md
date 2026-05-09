# XMUM Market — Marketplace App

Last updated: Sat, 09 May 2026 19:55:34 GMT

---

## 10. What Was Last Worked On

```
=== UPDATE THIS SECTION EVERY TIME YOU MAKE CHANGES ===
```

**Most recent work (May 2025):**
- Fixed Bug 2 & 3: Admin panel Firestore silent failures — replaced `getFirestore()` with `initializeFirestore(..., { experimentalAutoDetectLongPolling: true })` in `artifacts/xmum-admin/src/lib/firebase.ts`
- Added error alerts to `AdsPage.tsx` and `ReportsPage.tsx` catch blocks
- Added ad frequency / scheduling feature: `timesPerHour` and `durationHours` fields on `SponsoredAd`; throttle logic in `ads.ts`; `recordAdImpression()` called in `SponsoredAdCard.tsx` on mount
- Added `timesPerHour` and `durationHours` to `SponsoredAd` in both `types.ts` files
- Replaced `ads.ts` with throttle-aware implementation

**Known pending task:**
- Bug 1 (report submission silently fails) — fix is purely a Firestore rules deployment. The rules file at `artifacts/xmum-market/firestore.rules` is already correct; it has never been deployed to Firebase. Run the command in the "Firestore Rules Deployment" section below.

---

## 1. Project Overview

XMUM Market is a mobile-first community marketplace for students of Xiamen University Malaysia (XMUM). Students can post items for sale or lost-and-found listings, contact sellers via WhatsApp/WeChat, report suspicious listings, and manage their profile.

**Who it is for:** XMUM students with a verified `@xmu.edu.my` email address.

**Tech stack:**
- React 19 + Vite 7 + TypeScript
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- Wouter (client-side routing — NOT React Router, NOT Next.js)
- Firebase SDK v12: Authentication, Firestore, Storage
- i18n: custom bilingual system in `src/lib/i18n.ts` (English + Simplified Chinese)
- Package manager: pnpm (workspace monorepo)

---

## 2. Current Project State

Last updated: Sat, 09 May 2026 19:55:34 GMT

**Working features:**
- Sign up / sign in with `@xmu.edu.my` email only — enforced at Firebase Auth and Firestore rules level
- Email verification required before posting or contacting sellers
- Buy & Sell feed and Lost & Found feed, paginated (12 items per page, "Load More" cursor)
- Create listing: title, description, price (optional), category, condition, up to 3 photos (Firebase Storage)
- Mark listing as Sold (Buy & Sell) or Resolved (Lost & Found) — owner-only button on card and detail page
- Search: keyword + price range + condition filters
- Listing detail page with seller contact info (WhatsApp/WeChat/Teams)
- Sponsored ads injected into feed — frequency throttle enforced (`timesPerHour`, `durationHours`)
- Profile settings: avatar upload, display name, WhatsApp/WeChat/Teams contact edit, password change
- Privacy toggles: show/hide email, WhatsApp, WeChat per-listing
- Dark mode (localStorage key `xmum-theme`, `useDarkMode` hook)
- Bilingual UI: EN / ZH toggle (stored in React context, `LanguageContext.tsx`)
- Report a listing: form with category + free-text reason, writes to `reports` Firestore collection
- In-app notifications (subcollection `users/{uid}/notifications`)
- Offline persistence (Firestore SDK `initializeFirestore` with `experimentalAutoDetectLongPolling`)

**Known bugs / incomplete:**
- Report submission fails silently (permission-denied) — Firestore rules not yet deployed. See "Firestore Rules Deployment" section.
- Storage rules do not cover the `avatars/{userId}/` path — avatar uploads work only if Firebase Storage default rules allow authenticated writes. Should add an explicit `avatars` rule.
- `lastBumpedAt` / `sortKey` fields on listings are stored but the UI has no "bump listing" button yet.
- `teams` field (Microsoft Teams handle) is stored in `Listing` and `UserProfile` but is not displayed in the listing detail contact section.
- The `analytics` Firestore collection exists in rules but nothing writes to it yet.

---

## 3. Firebase Configuration

This app requires a Firebase project with **Authentication**, **Firestore**, and **Storage** enabled.

Create a `.env` file in `artifacts/xmum-market/` (copy from `.env.example` if it exists) with these variables:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Get these values from: **Firebase Console → Project Settings → General → Your apps → Web app → SDK setup and configuration**.

**Required Firebase Console setup:**
1. **Authentication** → Sign-in method → enable **Email/Password**
2. **Firestore** → Create database (select `(default)`, start in production mode)
3. **Storage** → Enable Firebase Storage, then apply the storage rules below
4. **Firestore composite index** → `listings` collection → fields: `type ASC`, `isArchived ASC`, `status ASC`, `createdAt DESC`

---

## 4. Firestore Rules (full copy)

Deploy these via: `cd artifacts/xmum-market && npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    function isXmuEmail() {
      return isSignedIn() &&
        request.auth.token.email.matches('.*@xmu\\.edu\\.my');
    }
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function isAdmin() {
      return isSignedIn() && getUserRole() == 'admin';
    }
    function isEditor() {
      return isSignedIn() && (getUserRole() == 'editor' || getUserRole() == 'admin');
    }

    match /users/{userId} {
      allow read: if true;
      allow write: if isOwner(userId) || isAdmin();
    }

    match /listings/{listingId} {
      allow read: if true;
      allow create: if isXmuEmail();
      allow update, delete: if isOwner(resource.data.userId) || isEditor();
    }

    match /reports/{reportId} {
      allow create: if isXmuEmail()
                    && request.resource.data.reportedBy == request.auth.uid
                    && request.resource.data.reason.size() <= 500;
      allow read, update: if isEditor();
      allow delete: if isAdmin();
    }

    match /ads/{adId} {
      allow read: if true;
      allow create, update: if isEditor();
      allow delete: if isAdmin();
    }

    match /analytics/{docId} {
      allow read: if isEditor();
      allow write: if isAdmin();
    }

    match /users/{userId}/notifications/{notifId} {
      allow read: if isOwner(userId);
      allow write: if isOwner(userId) || isEditor();
    }

    match /conversations/{convId} {
      allow read: if isSignedIn()
                  && request.auth.uid in resource.data.participants;
      allow create: if isXmuEmail()
                    && request.auth.uid in request.resource.data.participants;
      allow update: if isSignedIn()
                    && request.auth.uid in resource.data.participants;

      match /messages/{messageId} {
        allow read: if isSignedIn()
                    && request.auth.uid in get(/databases/$(database)/documents/conversations/$(convId)).data.participants;
        allow create: if isSignedIn()
                      && request.auth.uid in get(/databases/$(database)/documents/conversations/$(convId)).data.participants
                      && request.auth.uid == request.resource.data.senderId;
      }
    }
  }
}
```

---

## 5. Firebase Storage Rules (full copy)

Deploy via: **Firebase Console → Storage → Rules** (paste and publish).

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /listings/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.token.email.matches('.*@xmu\\.edu\\.my')
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

> **Note:** Avatar uploads use path `avatars/{userId}/avatar` but this path is not covered by the rules above. Add a matching rule for `avatars/{userId}/{allPaths=**}` to avoid permission errors on avatar upload.

---

## 6. Firestore Collection Schema

### `users/{uid}`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Firebase Auth UID (same as document ID) |
| `email` | string | User's @xmu.edu.my email |
| `displayName` | string | Short display name shown in listings |
| `fullName` | string | Full name captured at signup |
| `avatarUrl` | string? | Firebase Storage download URL for profile photo |
| `whatsapp` | string? | WhatsApp number (optional) |
| `wechat` | string? | WeChat ID (optional) |
| `emailVerified` | boolean | Whether Firebase email is verified |
| `isVerified` | boolean | Admin-verified badge (not yet used in UI) |
| `rating` | number | Seller rating (not yet used in UI) |
| `isBlacklisted` | boolean | If true, user is banned |
| `isFeatured` | boolean | If true, user gets a featured badge |
| `showEmail` | boolean | Privacy toggle — show email to other users |
| `showWhatsApp` | boolean | Privacy toggle — show WhatsApp |
| `showWeChat` | boolean | Privacy toggle — show WeChat |
| `createdAt` | number | Unix timestamp (ms) of account creation |
| `role` | "user" \| "editor" \| "admin" | Admin panel access level |

### `listings/{listingId}`
| Field | Type | Description |
|---|---|---|
| `id` | string | Firestore document ID |
| `type` | "buy-sell" \| "lost-found" | Feed type |
| `title` | string | Listing title |
| `description` | string | Full description |
| `price` | number? | Asking price (buy-sell only, optional) |
| `category` | string | Category label |
| `condition` | "new" \| "used" | Item condition |
| `photos` | string[] | Array of Firebase Storage download URLs |
| `userId` | string | Owner's Firebase Auth UID |
| `userEmail` | string | Owner's email |
| `userName` | string | Owner's display name at time of posting |
| `whatsapp` | string? | Owner's WhatsApp (denormalised from profile) |
| `wechat` | string? | Owner's WeChat (denormalised from profile) |
| `teams` | string? | Owner's Microsoft Teams handle |
| `meetupSpot` | string? | Preferred meetup location |
| `createdAt` | number | Unix timestamp (ms) |
| `isArchived` | boolean | Soft-delete flag |
| `status` | "active" \| "sold" | Current listing status |
| `lastBumpedAt` | number? | Unix timestamp of last bump (feature not yet exposed in UI) |
| `sortKey` | number? | Combined sort key for feed ordering |

### `reports/{reportId}`
| Field | Type | Description |
|---|---|---|
| `id` | string | Firestore document ID |
| `listingId` | string | ID of the reported listing |
| `listingTitle` | string | Title of the reported listing (denormalised) |
| `listingUserId` | string | UID of the listing owner |
| `listingUserEmail` | string | Email of the listing owner |
| `reportedBy` | string | UID of the user who filed the report |
| `reportedByEmail` | string | Email of the reporter |
| `reason` | string | Free-text reason (max 500 chars) |
| `category` | "spam" \| "scam" \| "offensive" \| "prohibited_item" \| "wrong_category" \| "other" | Report category |
| `status` | "pending" \| "reviewed" \| "dismissed" \| "actioned" | Admin review status |
| `createdAt` | number | Unix timestamp (ms) |
| `reviewedBy` | string? | UID of admin who reviewed |
| `reviewedAt` | number? | Unix timestamp of review |

### `ads/{adId}`
| Field | Type | Description |
|---|---|---|
| `id` | string | Firestore document ID |
| `businessName` | string | Advertiser name |
| `tagline` | string | Short ad tagline |
| `imageUrl` | string | Ad image URL |
| `ctaLabel` | string | Button label |
| `ctaUrl` | string | Button destination URL |
| `category` | string? | Optional category targeting |
| `startsAt` | number | Campaign start timestamp (ms) |
| `endsAt` | number | Campaign end timestamp (ms) |
| `isActive` | boolean | Whether the ad is shown in the feed |
| `impressions` | number | Total impression count |
| `clicks` | number | Total click count |
| `timesPerHour` | number | Max times this ad can appear per hour of browsing (1–10) |
| `durationHours` | number | Hours per day this ad is shown (1–24) |
| `createdBy` | string | UID of admin who created the ad |
| `createdByEmail` | string | Email of admin who created the ad |
| `updatedAt` | number | Last modified timestamp (ms) |

### `users/{uid}/notifications/{notifId}`
| Field | Type | Description |
|---|---|---|
| `id` | string | Firestore document ID |
| `type` | "listing_deleted" \| "listing_sold" \| "welcome" \| "listing_removed" | Notification type |
| `title` | string | Notification title |
| `body` | string | Notification body text |
| `createdAt` | number | Unix timestamp (ms) |
| `read` | boolean | Whether the user has seen it |
| `listingId` | string? | Related listing ID (if applicable) |

### `conversations/{convId}`
| Field | Type | Description |
|---|---|---|
| `participants` | string[] | Array of two UIDs (buyer + seller) |

### `conversations/{convId}/messages/{messageId}`
| Field | Type | Description |
|---|---|---|
| `senderId` | string | UID of the message sender |
| `text` | string | Message body |
| `createdAt` | number | Unix timestamp (ms) |

### `analytics/{docId}`
Reserved collection — rules exist but nothing writes to it yet.

---

## 7. How to Run the Project

```bash
# 1. Clone or import the project into Replit (or locally)

# 2. Install all workspace dependencies from the monorepo root
pnpm install

# 3. Create environment file for the marketplace
cp artifacts/xmum-market/.env.example artifacts/xmum-market/.env
# Fill in your Firebase values in artifacts/xmum-market/.env

# 4. Start the marketplace (Replit webview uses port 5000)
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/xmum-market run dev

# 5. Build for production
pnpm --filter @workspace/xmum-market run build
```

**Replit-specific notes:**
- The Replit workflow "Start application" runs `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/xmum-market run dev` — do not change the port
- `BASE_PATH` is required by `vite.config.ts` at startup — omitting it causes a startup error
- Firebase Firestore uses `experimentalAutoDetectLongPolling: true` to bypass Replit's WebSocket proxy block — do not change this
- The `.replit` file configures the webview to port 5000

---

## 8. Deployment Notes

**Platform:** Vercel (or any static host — the app is a pure client-side SPA)

**Vercel project settings:**
| Setting | Value |
|---|---|
| Root Directory | `artifacts/xmum-market` |
| Framework | Vite |
| Build Command | `pnpm run build` |
| Output Directory | `dist` |

**Environment variables to set in Vercel:**
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

**Post-deploy:**
- Add the Vercel domain to Firebase Console → Authentication → Settings → Authorized domains

---

## 9. Admin Account Setup

After deploying:

1. Sign up for an account on the marketplace using an `@xmu.edu.my` email and verify it
2. Go to **Firebase Console → Firestore → `users` collection**
3. Find the document for your account (search by email)
4. Add/edit the field `role` → type: **string** → value: `"admin"`
5. Log in to the admin panel — it will now accept your credentials

Without the `role: "admin"` field, the admin panel login is rejected even with valid credentials.

---

## Firestore Rules Deployment

The rules file is already correct at `artifacts/xmum-market/firestore.rules`. Run this command to deploy them:

```bash
cd artifacts/xmum-market
npx firebase-tools login --no-localhost   # only needed once
npx firebase-tools deploy --only firestore:rules --project YOUR_PROJECT_ID
```
