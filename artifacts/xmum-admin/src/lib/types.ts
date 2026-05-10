export type UserRole = "user" | "editor" | "admin";
export type ReportStatus = "pending" | "reviewed" | "dismissed" | "actioned";
export type ReportCategory = "spam" | "scam" | "offensive" | "prohibited_item" | "wrong_category" | "other";
export type ListingType = "buy-sell" | "lost-found";
export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  isBlacklisted: boolean;
  isFeatured: boolean;
  createdAt: number;
  emailVerified: boolean;
  isVerified?: boolean;
  verificationStatus?: VerificationStatus;
  verificationSubmittedAt?: number;
  verificationReviewedAt?: number;
  verificationRejectionReason?: string;
  shopName?: string;
  shopSlug?: string;
  shopBio?: string;
  shopCategories?: string[];
  shopBannerUrl?: string;
  activeListingCount?: number;
}

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
  status: ReportStatus;
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
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
  timesPerHour: number;
  durationHours: number;
  createdBy: string;
  createdByEmail: string;
  updatedAt: number;
}
