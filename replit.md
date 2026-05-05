# XMUM Market

A mobile-first community marketplace for Xiamen University Malaysia (XMUM) students. Built with React + Vite, Firebase, and Tailwind CSS.

## Architecture

This is a **pnpm monorepo** with the following artifacts:

| Artifact | Path | Description |
|---|---|---|
| `xmum-market` | `/artifacts/xmum-market` | Main React/Vite web app (SPA) |
| `api-server` | `/artifacts/api-server` | Express API server |
| `mockup-sandbox` | `/artifacts/mockup-sandbox` | Canvas component preview server |

## Tech Stack

- **Frontend**: React 18, Vite 7, Tailwind CSS 4, Wouter (routing)
- **Backend**: Firebase (Auth, Firestore, Storage)
- **UI**: Radix UI, Lucide React, React Icons
- **i18n**: Custom locale system (English + Simplified Chinese)
- **PWA**: manifest.json + meta tags (Add to Home Screen)

## Firebase Setup

All Firebase config comes from environment secrets (set in Replit Secrets):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Key Features

1. **Auth**: Email/password with `@xmu.edu.my` domain restriction + email verification
2. **Buy & Sell**: Listings with up to 3 photos, price, category, condition
3. **Lost & Found**: Separate feed for lost/found items
4. **Contact**: WhatsApp, WeChat, MS Teams deep links with pre-filled messages
5. **Search**: Full-text search with price range + condition filters
6. **Bilingual**: English / Simplified Chinese toggle
7. **PWA**: Installable as app on iOS/Android

## Source Structure (`/artifacts/xmum-market/src`)

```
src/
├── App.tsx                  # Root router + providers
├── main.tsx                 # Entry point
├── index.css                # Tailwind + CSS variables
├── contexts/
│   ├── AuthContext.tsx       # Firebase auth state
│   └── LanguageContext.tsx  # i18n toggle
├── lib/
│   ├── firebase.ts          # Firebase init
│   ├── auth.ts              # Auth helpers (signUp, signIn, etc.)
│   ├── listings.ts          # Firestore CRUD for listings
│   ├── i18n.ts              # All UI strings (EN + ZH)
│   └── types.ts             # TypeScript interfaces
├── components/
│   ├── Layout.tsx           # Header + bottom nav + footer
│   ├── ListingCard.tsx      # Card component for listings grid
│   ├── AuthModal.tsx        # Sign in / sign up / forgot password
│   └── VerificationBanner.tsx # Email verification prompt
└── pages/
    ├── HomePage.tsx          # Hero + tab feed (Buy&Sell / Lost&Found)
    ├── SearchPage.tsx        # Search bar + filters + results
    ├── PostPage.tsx          # Create listing form
    ├── ProfilePage.tsx       # User profile + my listings
    └── ListingDetailPage.tsx # Item detail + contact buttons
```

## Firebase Console Setup Required

After deploying, set up in Firebase Console:
1. **Authentication** → Enable Email/Password provider
2. **Firestore** → Create database, deploy `firestore.rules` and `firestore.indexes.json`
3. **Storage** → Create bucket, set rules to allow authenticated writes
4. **Firestore Indexes** → The composite indexes in `firestore.indexes.json` must be created (or will auto-create on first query error)

## Vercel Deployment

The app is a standard Vite SPA. To deploy to Vercel:
1. Push to GitHub
2. Import to Vercel
3. Set all `VITE_FIREBASE_*` env vars in Vercel dashboard
4. Build command: `pnpm --filter @workspace/xmum-market run build`
5. Output directory: `artifacts/xmum-market/dist/public`

## User Preferences

- Deep Navy (#003366) and Clean White color palette
- Apple-inspired clean/modern aesthetic
- Mobile-first design with sticky bottom nav on mobile, header nav on desktop
- PDPA disclaimer in footer (Malaysian data protection law)
