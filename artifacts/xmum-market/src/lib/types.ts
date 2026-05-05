export type ListingType = "buy-sell" | "lost-found";
export type Condition = "new" | "used";

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
  createdAt: number;
  isArchived: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isVerified: boolean;
  rating: number;
  isBlacklisted: boolean;
  isFeatured: boolean;
  createdAt: number;
}
