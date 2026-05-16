export type UserRole = "user" | "editor" | "admin";
export type ReportStatus = "pending" | "reviewed" | "dismissed" | "actioned";
export type ReportCategory = "spam" | "scam" | "offensive" | "prohibited_item" | "wrong_category" | "other";
export type ListingType = "buy-sell" | "lost-found" | "jobs" | "assistance" | "rental";
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
  rating?: number;
  totalReviews?: number;
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

export interface AdminListing {
  id: string;
  type: ListingType;
  title: string;
  category: string;
  price?: number;
  photos: string[];
  userId: string;
  userEmail: string;
  userName: string;
  status?: "active" | "sold";
  isArchived: boolean;
  createdAt: number;
  viewCount?: number;
  isFeatured?: boolean;
}

export interface AdminShop {
  id: string;
  shopName: string;
  shopSlug: string;
  ownerEmail: string;
  ownerUid: string;
  shopBio?: string;
  shopCategories?: string[];
  shopBannerUrl?: string;
  activeListingCount?: number;
  rating?: number;
  totalReviews?: number;
  inquiryCount?: number;
  createdAt: number;
}

export type ShopAdStatus = "pending" | "approved" | "rejected";

export interface ShopAd {
  id: string;
  shopId: string;
  shopName: string;
  shopOwnerId: string;
  imageUrl: string;
  tagline: string;
  ctaLabel: string;
  ctaUrl: string;
  pricePerDay: number;
  startDate: number;
  endDate: number;
  status: ShopAdStatus;
  adminNote?: string;
  impressions: number;
  clicks: number;
  submittedBy?: string;
  submittedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface AdminReview {
  id: string;
  shopId: string;
  shopListingId?: string;
  inquiryId?: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  shopName?: string;
  rating: number;
  comment?: string;
  createdAt: number;
}
