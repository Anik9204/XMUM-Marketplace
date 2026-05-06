# XMUM Market

A mobile-first community marketplace for Xiamen University Malaysia (XMUM) students. Built with React + Vite, Firebase, and Tailwind CSS.

## Run & Operate

```bash
pnpm --filter @workspace/xmum-market run dev   # start dev server
pnpm --filter @workspace/xmum-market run build # production build
```

Required env vars (set in Replit Secrets as `VITE_FIREBASE_*`):
`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`

## Stack

- **Frontend**: React 18, Vite 7, Tailwind CSS 4, Wouter (routing — NOT Next.js)
- **Backend**: Firebase Auth + Firestore + Storage (SDK v12, offline persistence)
- **UI**: Radix UI, Lucide React, React Icons
- **i18n**: Custom locale system (`lib/i18n.ts`) — English + Simplified Chinese

## Where things live

```
src/
├── lib/
│   ├── firebase.ts       # Firebase init (offline persistence)
│   ├── auth.ts           # signUp(email,pw,fullName,wa?,wc?), signIn, logOut, resetPassword
│   ├── userProfile.ts    # getProfile, updateProfile, uploadAvatar, changePassword
│   ├── listings.ts       # CRUD + deleteObject + limit(40) queries
│   ├── types.ts          # Listing, UserProfile interfaces
│   └── i18n.ts           # All bilingual UI strings
├── contexts/
│   ├── AuthContext.tsx   # Firebase User state via useAuth()
│   └── LanguageContext.tsx
├── components/
│   ├── AuthModal.tsx     # signup: fullName (required) + whatsapp/wechat (optional)
│   └── ListingCard.tsx   # loading="lazy" images
└── pages/
    ├── ProfilePage.tsx       # Tabs: My Listings | Settings (avatar, info, password, privacy)
    └── ListingDetailPage.tsx # Contact buttons respect seller privacy toggles
```

Source of truth: `types.ts` for data shapes, `i18n.ts` for all UI strings.

## Architecture decisions

- Wouter for routing — `useLocation()` hook, never `next/navigation` or `useRouter`
- `deleteDoc` always races against a 6s resolve-timeout (offline persistence can block indefinitely)
- Photo deletes run in parallel *before* `deleteDoc` (sequenced, not concurrent)
- Privacy toggles (`showWhatsApp`, `showWeChat`, `showEmail`) stored in `users/{uid}` Firestore doc; detail page fetches seller profile and gates contact buttons accordingly — defaults to showing if profile is missing (backward-compatible)
- Avatar stored at `avatars/{uid}/avatar.{ext}` in Storage

## Product

1. **Auth**: @xmu.edu.my only, email verification required; signup captures Full Name + optional WhatsApp/WeChat
2. **Buy & Sell / Lost & Found**: dual feed with photo uploads (up to 3), categories, condition
3. **Mark as Sold/Resolved**: owners see button in ListingCard (Profile) and ListingDetailPage; sold items get badge overlay; contact buttons hidden when sold
4. **Paginated feed**: `getListingsPage()` with Firestore cursor; 12 items per page; "Load More" button; fallback to client-side filter if index is missing
5. **Dark mode**: `useDarkMode` hook (localStorage key `xmum-theme` + `prefers-color-scheme` fallback); Sun/Moon toggle in header; full `dark:` variant coverage across all pages
6. **Profile Settings**: avatar upload, name/contact edit, password change, privacy toggles
7. **Privacy-respecting contact**: WhatsApp/WeChat hidden if seller toggled off; hidden entirely when listing is sold
8. **Search**: keyword + price range + condition filters (only shows available listings)
9. **Bilingual**: EN / ZH toggle

## Firebase Console setup required

1. **Auth** → enable Email/Password
2. **Firestore** → create `(default)` database; deploy `firestore.rules`
3. **Storage** → rules: `listings/{userId}/{allPaths=**}` and `avatars/{userId}/{allPaths=**}` — authenticated write where `uid == userId`
4. **Firestore indexes** → create composite index: `listings` collection on `type ASC + isArchived ASC + status ASC + createdAt DESC` (for paginated feed). Fallback to existing `type+isArchived+createdAt` index with client-side status filter if missing.

## User preferences

- Deep Navy `#003366` + Clean White palette
- Apple-inspired mobile-first aesthetic, sticky bottom nav on mobile
- PDPA disclaimer in footer

## Gotchas

- "Firestore not found" console warnings = expected false positive in dev (offline persistence) — not a code error
- `markAsSold` and `deleteDoc` always race against a 6s resolve-timeout (offline persistence can block indefinitely)
- `getUserListings` intentionally has NO status filter — owners see all listings including sold in My Profile
- Dark mode uses class strategy: `useDarkMode` toggles `.dark` on `<html>`; Tailwind v4 `@custom-variant dark (&:is(.dark *))` in `index.css`
