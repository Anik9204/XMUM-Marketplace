export type ListingType = "buy-sell" | "lost-found" | "jobs" | "assistance" | "rental";
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
  jobSubtype?: "offering" | "seeking";
  pricingModel?: "per_hour" | "per_day" | "per_month" | "fixed";
  isRemote?: boolean;
  availability?: string;
  vehicleType?: "car" | "bike" | "motorcycle" | "bicycle" | "scooter";
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  plateNumber?: string;
  rentalPricePerDay?: number;
  rentalPricePerHour?: number;
  depositAmount?: number;
  availableFrom?: number;
  availableTo?: number;
  requiresLicense?: boolean;
  requiresInsuranceProof?: boolean;
  rentalTerms?: string;
  tcAcceptedAt?: number;
  tcAcceptedVersion?: string;
  viewCount?: number;
}

export interface RentalListing extends Listing {
  vehicleType: "car" | "bike" | "motorcycle" | "bicycle" | "scooter";
  brand: string;
  model: string;
  year: number;
  plateNumber: string;
  rentalPricePerDay: number;
  rentalPricePerHour?: number;
  depositAmount: number;
  availableFrom: number;
  availableTo: number;
  requiresLicense: boolean;
  requiresInsuranceProof: boolean;
  terms: string;
  tcAcceptedAt: number;
  tcAcceptedVersion: string;
}

export interface RentalTcAuditLog {
  id: string;
  userId: string;
  userEmail: string;
  listingId: string;
  listingTitle: string;
  tcVersion: string;
  acceptedAt: number;
  ipHint?: string;
  userAgent: string;
}

export interface SellerTcAuditLog {
  id: string;
  userId: string;
  userEmail: string;
  shopName: string;
  tcVersion: string;
  acceptedAt: number;
  userAgent: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  sellerId: string;
  listingId: string;
  listingTitle: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  type:
    | "listing_deleted"
    | "listing_sold"
    | "welcome"
    | "daily_digest"
    | "new_message_digest"
    | "new_message"
    | "bump_available"
    | "review_received"
    | "listing_expiring"
    | "shop_approved"
    | "shop_rejected";
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
  timesPerHour: number;
  durationHours: number;
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
  shopName?: string;
  shopSlug?: string;
  shopBio?: string;
  shopBannerUrl?: string;
  shopCategories?: string[];
  verificationStatus?: "none" | "pending" | "approved" | "rejected";
  verificationSubmittedAt?: number;
  verificationReviewedAt?: number;
  verificationRejectionReason?: string;
  sellerTcAcceptedAt?: number;
  sellerTcVersion?: string;
  activeListingCount?: number;
  totalListingCount?: number;
}

export type ReportCategory =
  | "spam"
  | "scam"
  | "offensive"
  | "prohibited_item"
  | "wrong_category"
  | "other";

export interface SavedListing {
  listingId: string;
  savedAt: number;
  listingTitle: string;
  listingPhoto: string;
  listingPrice?: number;
  listingUserId: string;
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
  status: "pending" | "reviewed" | "dismissed" | "actioned";
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}
