# XMUM Market

A mobile-first community marketplace for Xiamen University Malaysia (XMUM) students. Built with React + Vite, Firebase, and Tailwind CSS.

## Run & Operate

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/xmum-market run dev   # start dev server
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

## Gotchas

- "Firestore not found" console warnings in dev = Firebase project needs Firestore database created in the Firebase Console — not a code error
- `PORT` and `BASE_PATH` env vars are required by `vite.config.ts` at startup
- Workflow runs: `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/xmum-market run dev`
