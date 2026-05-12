# XMUM Market

A mobile-first community marketplace for Xiamen University Malaysia (XMUM) students. Built with React + Vite, Firebase, and Tailwind CSS.

## Run & Operate

```bash
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/xmum-market run dev    # start dev server (port 5000 required for Replit webview)
pnpm --filter @workspace/xmum-market run build                         # production build
```

Required env vars (set as shared env vars in Replit):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, Wouter (routing)
- **Auth/DB/Storage**: Firebase Auth + Firestore + Storage (SDK v12, offline persistence)
- **UI**: Radix UI, Lucide React, React Icons
- **i18n**: Custom locale system (`lib/i18n.ts`) — English + Simplified Chinese
- **Package manager**: pnpm workspaces

## Where things live

```
artifacts/xmum-market/src/
├── lib/
│   ├── firebase.ts       # Firebase init (offline persistence + long-polling)
│   ├── auth.ts           # signUp, signIn, logOut, resetPassword
│   ├── userProfile.ts    # getProfile, updateProfile, uploadAvatar, changePassword
│   ├── listings.ts       # CRUD + deleteObject + paginated queries
│   ├── types.ts          # Listing, UserProfile interfaces (source of truth)
│   └── i18n.ts           # All bilingual UI strings (source of truth)
├── contexts/
│   ├── AuthContext.tsx   # Firebase User state via useAuth()
│   └── LanguageContext.tsx
├── components/
│   ├── AuthModal.tsx     # signup: fullName + optional whatsapp/wechat
│   └── ListingCard.tsx
└── pages/
    ├── ProfilePage.tsx
    └── ListingDetailPage.tsx

artifacts/api-server/      # Express 5 backend (currently only /api/healthz)
lib/db/                    # Drizzle ORM + Postgres (schema currently empty)
lib/api-spec/              # OpenAPI spec + Orval codegen config
```

## Architecture decisions

- Wouter for routing — `useLocation()` hook; never `next/navigation` or `useRouter`
- Firebase Firestore long-polling forced (`experimentalAutoDetectLongPolling`) so it works through Replit's proxy
- `deleteDoc` always races against a 6s resolve-timeout (offline persistence can block indefinitely)
- Photo deletes run in parallel *before* `deleteDoc`
- Privacy toggles (`showWhatsApp`, `showWeChat`, `showEmail`) stored in `users/{uid}` Firestore doc

## Product

1. **Auth**: @xmu.edu.my only, email verification required; signup captures Full Name + optional WhatsApp/WeChat
2. **Buy & Sell / Lost & Found**: dual feed with photo uploads (up to 3), categories, condition
3. **Mark as Sold/Resolved**: owners see button in ListingCard and ListingDetailPage
4. **Paginated feed**: Firestore cursor; 12 items per page; "Load More" button
5. **Dark mode**: `useDarkMode` hook (localStorage key `xmum-theme`)
6. **Profile Settings**: avatar upload, name/contact edit, password change, privacy toggles
7. **Search**: keyword + price range + condition filters
8. **Bilingual**: EN / ZH toggle

## Firebase Console setup required

1. **Auth** → enable Email/Password
2. **Firestore** → create `(default)` database; deploy `firestore.rules`
3. **Storage** → authenticated write rules for `listings/{userId}/` and `avatars/{userId}/`
4. **Firestore indexes** → composite index: `listings` on `type ASC + isArchived ASC + status ASC + createdAt DESC`

## User preferences

- Deep Navy `#003366` + Clean White palette
- Apple-inspired mobile-first aesthetic, sticky bottom nav on mobile
- PDPA disclaimer in footer

## New Replit account setup (read this first if the preview shows "Your app is not running")

Every time this project is opened in a **new Replit account**, do the following steps in order:

### 1. Install dependencies
Run from the workspace root (already handled by the post-merge script, but do it manually if needed):
```bash
pnpm install
```

### 2. Delete the nested workspace file — CRITICAL
The file `artifacts/xmum-market/pnpm-workspace.yaml` must **not** exist. If it is present, delete it:
```bash
rm -f artifacts/xmum-market/pnpm-workspace.yaml
```

**Why:** Replit's artifact system runs `pnpm --filter @workspace/xmum-market run dev` from *inside* the `artifacts/xmum-market/` directory. If a local `pnpm-workspace.yaml` is present there, pnpm treats that subdirectory as its own isolated workspace root and cannot resolve the `@workspace/xmum-market` filter — causing the workflow to fail with "No projects matched the filters". Removing the file makes pnpm walk up to the real workspace root at `/home/runner/workspace` where the package is correctly registered.

This file does **not** affect Vercel — Vercel runs `pnpm install` and `pnpm --filter @workspace/xmum-market run build` from the repo root, so it is unaffected by this file being absent.

### 3. Set the required environment variables
In Replit → Secrets (or Environment Variables → Shared), add all six Firebase vars:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### 4. Start the workflows
- **XMUM Market app** → start the `artifacts/xmum-market: web` workflow (port 5000, shown in preview)
- **Admin panel** → start the `Start admin panel` workflow (port 3002, switch preview port to 3002)

---

## Gotchas

- "Firestore not found" console warnings in dev = Firebase project needs Firestore database created in the Firebase Console — not a code error
- `PORT` and `BASE_PATH` env vars are required by `vite.config.ts` at startup; they default to `5000` and `/` if unset, so the artifact workflow works without them
- HMR WebSocket errors in the browser console are cosmetic — the Replit proxy uses a different port for the artifact workflow (23007) vs what the Vite client expects; the app works fine
- The `pnpm-lock.yaml` inside `artifacts/xmum-market/` is harmless and can stay

<!-- test push from Antigravity -->
