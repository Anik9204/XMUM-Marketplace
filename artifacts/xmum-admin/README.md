# XMUM Admin Panel

Last updated: Tue, 12 May 2026 21:49:21 GMT

---

## 10. What Was Last Worked On

```
=== UPDATE THIS SECTION EVERY TIME YOU MAKE CHANGES ===
```

**Most recent work (May 2025):**
- Fixed Bug 2 & 3: Replaced `getFirestore()` with `initializeFirestore(..., { experimentalAutoDetectLongPolling: true })` in `src/lib/firebase.ts` — fixes all silent Firestore failures (ads not saving, reports not loading)
- Fixed Bug 1 (Reports page): Replaced one-time `getDocs` with real-time `onSnapshot` listener — reports now appear without manual refresh; added live count badges on filter tabs
- Fixed Bug 3 (Delete report): `handleActionAndDelete` now deletes both the report document AND the associated listing from Firestore, and sends a notification to the listing owner
- Fixed Bug 4: `MAIN_APP_URL` now reads from `import.meta.env.VITE_MAIN_APP_URL` instead of hardcoded placeholder
- Fixed Bug 5 (Dashboard): Pending Reports badge is real-time via `onSnapshot`; added a Refresh button for other counters
- Fixed Bug 6 (Users page): Ban/unban and role changes now require a confirmation dialog; success/error toast appears after each action
- Added report detail modal — click any report card to open full details
- Added ad frequency / scheduling fields (`timesPerHour`, `durationHours`) to Create/Edit Ad form and ad list display

**Next planned task:**
- Deploy Firestore rules (`artifacts/xmum-market/firestore.rules`) — Bug 1 in the marketplace (report submission fails silently) is blocked on this
- Set `VITE_MAIN_APP_URL` env var on Vercel to the live marketplace URL so "View Listing" links work

---

## 1. Project Overview

XMUM Admin Panel is a separate React + Vite web application that connects to the same Firebase project as the main XMUM Market marketplace. It provides moderators and administrators with tools to manage users, review reports, manage sponsored ads, and monitor platform statistics.

**Who it is for:** Designated admin and editor accounts — must have `role: "admin"` or `role: "editor"` set in their Firestore user document.

**Tech stack:**
- React 18 + Vite 5 + TypeScript
- Tailwind CSS 3
- Wouter (client-side routing)
- Firebase SDK v10: Authentication, Firestore
- Package manager: pnpm (workspace monorepo at repo root)

**This is a completely separate app** from `artifacts/xmum-market`. It shares the same Firebase project (and thus the same Firestore database and Auth users), but has its own `package.json`, `vite.config.ts`, `index.html`, and deployment.

---

## 2. Current Project State

Last updated: Tue, 12 May 2026 21:49:21 GMT

**Working features:**
- Login with `@xmu.edu.my` email — only users with `role: "admin"` or `role: "editor"` can enter
- Dashboard with live Pending Reports counter (`onSnapshot`) + Refresh button for Users / Listings / Active Ads counts
- Reports page: real-time list of all reports (`onSnapshot`), filter by status (all / pending / reviewed / actioned / dismissed), click-to-expand detail modal, mark as actioned / dismissed, delete report + listing + notify user (admin only)
- Users page: search by name/email, role assignment (admin only, with confirmation), ban/unban (with confirmation), success/error toast feedback
- Ads page: create / edit / delete sponsored ads with full form including frequency controls (`timesPerHour`, `durationHours`), toggle active/paused per ad
- Dark mode support (inherits system preference via Tailwind `dark:` classes)
- All Firestore writes use the 6-second Promise.race timeout pattern

**Known limitations:**
- No pagination on Users or Ads pages — all documents loaded at once (acceptable for XMUM scale)
- `VITE_MAIN_APP_URL` env var must be set for "View Listing" links to work correctly
- No image upload in the Ads form — admins must supply a public image URL manually
- The `analytics` Firestore collection exists in security rules but nothing writes to it yet

---

## 3. Firebase Configuration

This app shares the Firebase project with `artifacts/xmum-market`. All env var values come from the same Firebase project.

Create a `.env` file in `artifacts/xmum-admin/` with:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_MAIN_APP_URL=
```

Get the Firebase values from: **Firebase Console → Project Settings → General → Your apps → Web app → SDK setup and configuration**.

Set `VITE_MAIN_APP_URL` to the deployed URL of the main marketplace (e.g. `https://xmum-market.vercel.app`). This is used for the "View Listing" links in the Reports page.

**CRITICAL:** `src/lib/firebase.ts` must use `initializeFirestore(app, { experimentalAutoDetectLongPolling: true })` — NOT `getFirestore(app)`. In Replit's proxy environment, `getFirestore()` uses WebSockets which are blocked, causing all Firestore operations to fail silently. Do not change this.

---

## 4. Firestore Rules (full copy)

These rules live in `artifacts/xmum-market/firestore.rules` and cover both the marketplace and the admin panel (same Firestore database). Deploy via Firebase CLI.

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

These rules are shared with the marketplace. The admin panel does not upload files directly.

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

---

## 6. Firestore Collection Schema

See `artifacts/xmum-market/README.md` for the full schema — both apps share the same Firestore database. The admin panel reads and writes to these collections:

| Collection | Admin panel access |
|---|---|
| `users` | Read all (Users page), write role + isBlacklisted (admin only) |
| `listings` | Delete (via report action — admin only) |
| `reports` | Read all, update status (editor+), delete (admin only) |
| `ads` | Read all, create/update (editor+), delete (admin only) |
| `users/{uid}/notifications` | Write (admin only — when deleting a listing) |

### Admin-specific fields on `ads` collection

| Field | Type | Description |
|---|---|---|
| `timesPerHour` | number | Max times ad appears per hour of browsing (1–10) |
| `durationHours` | number | Hours per day ad is shown (1–24) |
| `createdBy` | string | UID of creating admin |
| `createdByEmail` | string | Email of creating admin |
| `updatedAt` | number | Last modified timestamp (ms) |

---

## 7. How to Run the Project

```bash
# 1. Clone or import the monorepo into Replit (or locally)

# 2. Install all workspace dependencies from the monorepo root
pnpm install

# 3. Create environment file for the admin panel
# Create artifacts/xmum-admin/.env and fill in Firebase values + VITE_MAIN_APP_URL

# 4. Start the admin panel dev server (port 3002)
PORT=3002 pnpm --filter xmum-admin run dev

# 5. Build for production
pnpm --filter xmum-admin run build
```

**Replit-specific notes:**
- The Replit workflow "Start admin panel" runs `PORT=3002 pnpm --filter xmum-admin run dev` on the console port (not the webview)
- Firestore MUST use `initializeFirestore` with `experimentalAutoDetectLongPolling: true` — see `src/lib/firebase.ts`
- All Firestore writes use `Promise.race([...op, timeout(6000)])` — do not remove this pattern

---

## 8. Deployment Notes

**Platform:** Vercel

**Vercel project settings:**
| Setting | Value |
|---|---|
| Root Directory | `artifacts/xmum-admin` |
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
VITE_MAIN_APP_URL        ← set to your live marketplace URL
```

**Post-deploy:**
1. Add the Vercel domain to Firebase Console → Authentication → Settings → Authorized domains
2. The `vercel.json` in this directory already handles SPA routing (all paths redirect to `index.html`)

---

## 9. Admin Account Setup

After deploying the admin panel:

1. Sign up for an account on the **main marketplace** using an `@xmu.edu.my` email and verify it
2. Go to **Firebase Console → Firestore → `users` collection**
3. Click the document whose ID matches your user (the document ID = Firebase Auth UID)
4. Add a field: name `role`, type **string**, value `"admin"`
5. Save — then log in to the admin panel with those credentials

**Role levels:**
- `"admin"` — full access (can delete reports, change user roles, delete ads)
- `"editor"` — limited access (can review reports, create/edit ads, but cannot delete reports or change roles)
- `"user"` (default) — no admin panel access
