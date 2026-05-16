export type ListingType = "buy-sell" | "lost-found" | "jobs" | "assistance" | "rental" | "shop-listing";
export type Condition = "new" | "used";
export type ListingStatus = "active" | "sold";

export type ShopCategory =
  | "Food & Beverage"
  | "Tutoring & Education"
  | "Fashion & Apparel"
  | "Electronics"
  | "Beauty & Wellness"
  | "Transport & Rental"
  | "Handmade & Custom"
  | "Books & Stationery"
  | "Services"
  | "Travel & Lifestyle"
  | "Others";

export interface Shop {
  id: string;
  ownerId: string;
  ownerEmail: string;
  name: string;
  slug: string;
  bio: string;
  category: ShopCategory;
  bannerUrl?: string;
  logoUrl?: string;
  whatsapp?: string;
  wechat?: string;
  createdAt: number;
  isActive: boolean;
  isSuspended?: boolean;
  editorIds: string[]; // max 3 editor UIDs
  totalListings: number;
  totalInquiries: number;
  autoReplyEnabled?: boolean;
  autoReplyMessage?: string;
  rating?: number;
  reviewCount?: number;
  orderQuestions?: ShopOrderQuestion[];
}

export interface ShopOrderQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  options?: string[];
  required: boolean;
}

export interface ShopOrder {
  id: string;
  shopId: string;
  shopName: string;
  shopOwnerId: string;
  listingId: string;
  shopListingId?: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  offeredPrice?: number | null;
  answers: Record<string, string>;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: number;
  updatedAt: number;
  reviewLeft: boolean;
  hasReviewed?: boolean;
}

export interface ShopReview {
  id: string;
  shopId: string;
  shopListingId?: string;
  inquiryId?: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  rating: number;
  comment?: string;
  createdAt: number;
}

export interface Review {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId?: string;
  rating: number;
  comment?: string;
  createdAt: number;
}

export interface ShopListing {
  id: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  shopOwnerId: string;
  title: string;
  description: string;
  price?: number;
  pricingModel?: "fixed" | "per_hour" | "per_day" | "negotiable";
  category: ShopCategory;
  photos: string[];
  isActive: boolean;
  createdAt: number;
  viewCount: number;
  inquiryCount: number;
  orderQuestions?: ShopOrderQuestion[];
  rating?: number;
  reviewCount?: number;
  isReportHeld?: boolean;
  reportHeldAt?: number;
}

export type InquiryStatus = "pending" | "replied";

export interface ShopInquiry {
  id: string;
  shopId: string;
  shopName: string;
  shopListingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity?: number;
  note: string;
  status: InquiryStatus;
  createdAt: number;
  updatedAt: number;
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
  submittedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

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
  vehicleType?: "car" | "motorcycle" | "bicycle" | "electric-bike";
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
  isReportHeld?: boolean;
  reportHeldAt?: number;
}

export interface RentalListing extends Listing {
  vehicleType: "car" | "motorcycle" | "bicycle" | "electric-bike";
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
    | "listing_expiring"
    | "shop_inquiry_received"
    | "shop_inquiry_confirmed"
    | "shop_inquiry_completed"
    | "shop_ad_approved"
    | "shop_ad_rejected"
    | "shop_editor_added"
    | "shop_editor_removed";
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  listingId?: string;
  shopId?: string;
  inquiryId?: string;
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
  activeListingCount?: number;
  totalListingCount?: number;
  myShopIds?: string[]; // shops the user owns
  editorShopIds?: string[]; // shops the user is an editor of
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
