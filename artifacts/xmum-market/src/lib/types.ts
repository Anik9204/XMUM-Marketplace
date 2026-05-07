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
}
