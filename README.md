# XMUM Market — Comprehensive Product Description

## What Is XMUM Market?

XMUM Market is a mobile-first community commerce platform built exclusively for students of Xiamen University Malaysia (XMUM). It is a single, unified digital campus where students can buy and sell second-hand items, report lost and found belongings, find jobs and freelance gigs, request assistance from fellow students, rent vehicles, run their own verified campus shops, place orders, send inquiries, chat privately, and stay notified — all within a trusted, university-authenticated environment.

Access is strictly limited to verified `@xmu.edu.my` email addresses, ensuring every user on the platform is a genuine member of the XMUM student community.

The platform consists of two separate applications sharing the same Firebase backend: the **Student App** (the main marketplace) and the **Admin Panel** (a moderation and management tool for university administrators).

---

## Who Is It For?

- **XMUM students** who want to buy, sell, trade, or give away items on campus
- **Students with skills** looking to offer tutoring, freelance design, photography, fitness coaching, music lessons, and more
- **Student entrepreneurs** who want to run a small business (food stalls, fashion, handmade goods, services) within the university community
- **Students who need help** with dorm moving, grocery runs, deliveries, tech support, and event setup
- **Vehicle owners** who want to rent out their car, motorcycle, bike, scooter, or bicycle to fellow students
- **Campus administrators** who need to moderate content, manage users, and run sponsored ad campaigns

---

## Core Features — Student App

### 1. Authentication & Identity

Every user must register with a valid `@xmu.edu.my` university email address. The sign-up form collects the student's full name and optionally their WhatsApp and WeChat contact details. Email verification is required before a user can post listings or contact sellers. A self-service password reset flow is also provided.

Each user profile stores a display name, full name, avatar, and three optional contact channels: WhatsApp, WeChat, and Microsoft Teams. Users have independent privacy toggles for each contact field — they can choose exactly which contact details are visible to other students on a per-field basis.

---

### 2. The Home Feed — Five Listing Categories

The main home feed is divided into five distinct tabs, each serving a different student need:

**Buy & Sell**
The primary second-hand marketplace. Students post items they want to sell across categories including Electronics, Books, Clothing, Furniture, Food, Services, and Others. Each listing supports up to 3 photos, a price, item condition (New or Used), a preferred meetup spot, and contact details. Listings can be marked as Sold by the owner. A daily limit of 6 active listings per user is enforced — students can post more only by deleting existing ones.

**Lost & Found**
A dedicated notice board for reporting lost or found items on campus. Listings are categorised as either Lost Item or Found Item. Owners can mark a listing as Resolved once the item is recovered or claimed.

**Jobs**
A student job board where students can offer or seek services across categories including Tutoring, Freelance Design, Freelance Development, Language Exchange, Photography, Music Lessons, Fitness Coaching, and Other Services. Listings support pricing models of per hour, per day, per month, or fixed price, and can be flagged as remote or on-site with availability details.

**Assistance**
A peer help board where students can request or offer help with practical campus tasks: Dorm Moving, Grocery Runs, Deliveries, Cleaning, Event Setup, Tech Help, and Other Assistance.

**Rental**
A vehicle rental marketplace where students can list their own vehicles for rent. Supported vehicle types include Car, Motorcycle, Bike, Bicycle, and Scooter. Rental listings capture the vehicle brand, model, year, plate number, rental price per day and optionally per hour, deposit amount, availability window, license and insurance requirements, and full rental terms. Renters must accept a Terms & Conditions agreement before posting, and an audit log is written to Firestore for compliance.

**Feed Features across all tabs:**
- Category filter chips below the tab bar for quick narrowing
- Paginated feed loading 12 listings per page with a "Load More" button using Firestore cursors
- Sponsored ad cards injected between organic listings at controlled frequency
- Context-aware "+" floating action button (on Home and Search pages) that pre-selects the correct listing type based on the active tab

---

### 3. Search

A dedicated search page allows students to find listings across all categories using keyword matching across listing titles and descriptions, with additional filters for price range and item condition. Results are paginated and respond to filter changes in real time.

---

### 4. Campus Market — Student Shop System

The Campus Market is a Shopee-inspired storefront system that allows any verified student to open and operate their own campus shop.

**Shop Creation**
Any verified student can create a shop with a name, a unique URL slug, a bio, a category, and optional WhatsApp and WeChat contact details. Shops can have a banner image and a logo. They are assigned to one of 11 categories: Food & Beverage, Tutoring & Education, Fashion & Apparel, Electronics, Beauty & Wellness, Transport & Rental, Handmade & Custom, Books & Stationery, Services, Travel & Lifestyle, or Others.

**Shop Listings**
Shop owners create individual product or service listings under their shop with a title, description, photos, and one of four pricing models: Fixed Price, Negotiable, Per Hour, or Per Day.

**Shop Public Page**
Every shop has a public-facing storefront showing the banner, logo, name, category, star rating, review count, bio, contact details, and all active listings. Customers can submit inquiries or place orders directly from this page.

**Shop Dashboard — Seller View**
Shop owners and editors manage everything from a tabbed dashboard:

- **Listings tab**: Create, edit, activate, deactivate, and delete shop listings with photo upload support.
- **Inquiries tab**: View all incoming customer inquiries with full status tracking. Each card shows the customer's name, email, message, and status badge. Owners can reply via email, open a direct in-app chat with the inquirer (which navigates straight into the conversation with a pre-drafted greeting), mark an inquiry as Replied (which removes the Pending badge and turns it green), or permanently delete the inquiry from Firestore.
- **Orders tab**: View and manage all incoming orders, update order status, and trigger automatic buyer notifications on confirmation or cancellation.
- **Settings tab**: Update all shop details, configure an auto-reply message for inquiries, define custom order intake questions, and manage shop editors — all from one place.

**Shop Editors**
Shop owners can add up to 3 co-editors. Editors can manage listings, handle inquiries and orders, and update shop settings. In-app notifications are sent when editors are added or removed. Editor management lives inside the Settings tab.

**Order System**
Customers place structured orders via a form that captures quantity and, for Negotiable listings, an offered price. Shops can define custom intake questions that appear on every order form. Orders are stored in Firestore and trigger in-app notifications to the shop owner and editors. Status updates (confirmed, cancelled) send notifications back to the buyer.

**Reviews**
After a completed transaction, buyers can leave a star rating and written comment on the shop. Reviews are aggregated into the shop's public star rating and review count.

**Sponsored Shop Ads**
Shop owners can submit ad campaigns with an image, tagline, call-to-action label and URL, date range, and daily price. Ads go through admin approval before going live. Active ads are injected into the home feed with impression and click tracking.

---

### 5. Listing & Shop Detail Pages

Each listing and shop listing has a dedicated detail page with a full photo gallery, complete description, price, all relevant details, and seller or shop contact options respecting the user's privacy settings. Owners see edit, delete, and status-update controls. Customers see inquiry and order buttons that are always fully accessible and never obscured by the navigation bar.

---

### 6. Seller Profile Page

Clicking a seller's name opens their public profile, showing their avatar, display name, join date, and all active listings — giving buyers a way to browse everything that seller has posted.

---

### 7. Private Messaging

Students can send private messages to any seller or shop owner directly within the app. All conversations are real-time and protected so only the two participants can read the thread.

Chat features include real-time message delivery, typing indicators, read receipts (Sent / Seen), date separator labels, auto-scroll to latest message, auto-resizing text input up to 1,000 characters with a character counter, conversation search by contact name or listing title, conversation delete/clear from both the list view and the active chat header, an unread message badge on the Messages tab, deep-link support for opening a specific conversation with a pre-filled draft, report user functionality from within any chat, and client-side rate limiting of 30 messages per minute.

---

### 8. Notifications

A real-time notification bell with an unread badge count sits in the top navigation bar. Notification types include: welcome message, listing deletion alert, new inquiry received, inquiry status change, order received, order confirmed, order cancelled, and editor role added or removed. Notifications support read and unread state and are private per user.

---

### 9. User Profile & Settings

The Profile page is a personal hub with tabs for Active Listings, Sold Listings, Saved Listings (real-time synced), My Shop (owned and edited shops), My Inquiries (with status tracking and a Leave Review button), and My Orders (with live status updates).

The Settings page covers display name, full name, avatar, WhatsApp, WeChat, Teams contact details, password change, per-field privacy toggles, and account deletion with password confirmation.

---

### 10. Content Moderation & Reporting

Any student can report a listing with categories covering Spam, Scam, Offensive Content, Prohibited Item, Wrong Category, and Other. A content filter screens all listing text at submission time before it reaches Firestore.

---

### 11. User Experience & Accessibility

- **Mobile-first design** with a sticky bottom navigation bar (Home, Search, Market, Messages, Profile) and unread badge on Messages
- **Context-aware FAB** on Home and Search pages only, pre-selecting the correct post type for the active tab
- **Full dark mode** with persistent preference in `localStorage`
- **Bilingual UI** in English and Simplified Chinese covering every label, button, placeholder, and error message
- **Offline persistence** via Firebase SDK caching for use on a poor campus network
- **Unsaved changes guard** prompting users before leaving a form with unsaved data
- **Auto-saving draft** on the post creation form via `localStorage`
- **Online/offline connectivity banner** shown at the top of the app
- **Error boundaries** for graceful component-level failure handling
- **Rate limiting** on listing creation (6 per day) and messaging (30 per minute)
- **PDPA disclaimer** in the desktop footer for Malaysian data protection compliance

---

## Admin Panel — Separate Application

The Admin Panel is a separate React + Vite web app sharing the same Firebase backend, deployed independently on Vercel.

**Access Control**: Role-based with `admin` (full access) and `editor` (limited moderation) levels. Only users with the correct Firestore role field can log in.

**Dashboard**: Live counts of pending reports, total users, total listings, and active ad campaigns.

**Reports Management**: Real-time list of all community reports filterable by status. Expandable detail view with one-click moderation actions — action (deletes listing and notifies owner), dismiss, or delete. All actions require confirmation.

**User Management**: Search by name or email, assign roles, and ban or unban accounts with confirmation dialogs.

**Listings Management**: Browse and delete any marketplace listing with automatic owner notification on deletion.

**Shops Management**: Browse and manage all registered campus shops.

**Sponsored Ads Management**: Full campaign lifecycle — create, approve, reject, pause, delete. Configure frequency throttling and scheduling per campaign. View live impression and click metrics.

**Shop Ads Management**: Separate approval workflow for shop-specific ad submissions from the Campus Market system.

**Rental Audit**: Compliance audit log of all rental listing Terms & Conditions acceptances with timestamps and version tracking.

**Reviews Management**: Browse and manage all student shop reviews.

**User Verification**: Dedicated page for student identity verification management.

**Analytics**: Reserved dashboard with infrastructure ready for future data pipeline integration.

---

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4 |
| Routing | Wouter |
| Database | Firebase Firestore (offline persistence, long-polling) |
| Authentication | Firebase Auth — Email/Password, `@xmu.edu.my` restricted |
| File Storage | Firebase Storage |
| UI Components | Radix UI, shadcn/ui, Lucide React, React Icons |
| Internationalisation | Custom EN / ZH bilingual system via `lib/i18n.ts` |
| Package Manager | pnpm monorepo workspaces |
| Deployment | Vercel — student app and admin panel as separate projects |

---

## Security Model

- All Firestore write operations gated behind Security Rules
- Registration restricted to `@xmu.edu.my` email addresses only
- Listing edits and deletions restricted to the listing owner or admin/editor roles
- Shop management restricted to the shop owner or named editors (max 3)
- Private conversations readable only by the two participants
- Notifications private and unreadable by any other user
- Sponsored ad management requires editor-level or admin access
- User role changes and bans require admin access with confirmation
- Rental listing creation requires explicit T&C acceptance logged to a Firestore audit collection
- Content filter screens all listing text at submission time

---

## Platform

XMUM Market is a Progressive Web App (PWA) accessible on any modern mobile or desktop browser. It is optimised for mobile-first usage on iOS and Android with a native-app feel, delivered through the sticky bottom navigation, floating action button, smooth transitions, and fully responsive layout across all screen sizes.

---

*XMUM Market is built for the XMUM campus community — a safe, verified, and feature-rich space for students to trade, work, connect, and build businesses together.*
