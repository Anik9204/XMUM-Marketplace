export type ListingType = "buy-sell" | "lost-found";
export type Condition = "new" | "used";
export type ListingStatus = "active" | "sold";

export interface Listing {
  id: string;
  type: ListingType;
  title: string;
  description: string;
  price?: number;
  category: string;
  condition: Condition;
  photos: string[];
  userId: string;
  userEmail: string;
  userName: string;
  whatsapp?: string;
  wechat?: string;
  teams?: string;
  meetupSpot?: string;
  createdAt: number;
  isArchived: boolean;
  status?: ListingStatus;
  lastBumpedAt?: number;
  sortKey?: number;
}

export interface AppNotification {
  id: string;
  type: "listing_deleted" | "listing_sold" | "welcome";
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  listingId?: string;
}

export interface SponsoredAd {
  id: string;
  businessName: string;
  tagline: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  category?: string;
  startsAt: number;
  endsAt: number;
  isActive: boolean;
  impressions: number;
  clicks: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  fullName: string;
  avatarUrl?: string;
  whatsapp?: string;
  wechat?: string;
  emailVerified: boolean;
  isVerified: boolean;
  rating: number;
  isBlacklisted: boolean;
  isFeatured: boolean;
  showEmail: boolean;
  showWhatsApp: boolean;
  showWeChat: boolean;
  createdAt: number;
  role?: "user" | "editor" | "admin";
}

export type ReportCategory =
  | "spam"
  | "scam"
  | "offensive"
  | "prohibited_item"
  | "wrong_category"
  | "other";

export interface ListingReport {
  id: string;
  listingId: string;
  listingTitle: string;
  listingUserId: string;
  listingUserEmail: string;
  reportedBy: string;
  reportedByEmail: string;
  reason: string;
  category: ReportCategory;
  status: "pending" | "reviewed" | "dismissed" | "actioned";
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}
