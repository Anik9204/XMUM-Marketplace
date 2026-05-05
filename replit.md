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

1. **Auth**: @xmu.edu.my only, email verification required; signup now captures Full Name + optional WhatsApp/WeChat
2. **Buy & Sell / Lost & Found**: dual feed with photo uploads (up to 3), categories, condition
3. **Profile Settings tab**: avatar upload, name/contact edit, password change, privacy toggles
4. **Privacy-respecting contact**: WhatsApp/WeChat buttons hidden on listing detail if seller toggled them off
5. **Search**: keyword + price range + condition filters
6. **Bilingual**: EN / ZH toggle

## Firebase Console setup required

1. **Auth** → enable Email/Password
2. **Firestore** → create `(default)` database; deploy `firestore.rules`
3. **Storage** → create bucket; rules must allow:
   - `listings/{userId}/{allPaths=**}` — authenticated write where `uid == userId`
   - `avatars/{userId}/{allPaths=**}` — authenticated write where `uid == userId`
4. **Firestore `users` collection rules**: `allow read: if true; allow write: if request.auth.uid == uid;`

## User preferences

- Deep Navy `#003366` + Clean White palette
- Apple-inspired mobile-first aesthetic, sticky bottom nav on mobile
- PDPA disclaimer in footer

## Gotchas

- "Firestore not found" console warnings = Firestore database not yet created in Firebase Console — not a code error
- Queries use `limit(40)` — add composite indexes for `type+isArchived+createdAt` if you see `failed-precondition` errors
- `satisfies UserProfile` in auth.ts enforces type-completeness on the signup Firestore write
