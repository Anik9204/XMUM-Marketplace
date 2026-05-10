import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, increment,
  onSnapshot, Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Shop, ShopListing, ShopInquiry, ShopReview, ShopAd, InquiryStatus } from "@/lib/types";

// ── Slug helpers ──────────────────────────────────────────────────────────────
export function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const q = query(collection(db, "shops"), where("slug", "==", slug), limit(1));
  const snap = await getDocs(q);
  return snap.empty;
}

// ── Shop CRUD ─────────────────────────────────────────────────────────────────
export async function createShop(
  ownerId: string,
  ownerEmail: string,
  data: { name: string; slug: string; bio: string; category: string; whatsapp?: string; wechat?: string }
): Promise<string> {
  const docRef = await addDoc(collection(db, "shops"), {
    ownerId,
    ownerEmail,
    name: data.name.trim(),
    slug: data.slug,
    bio: data.bio.trim(),
    category: data.category,
    whatsapp: data.whatsapp ?? "",
    wechat: data.wechat ?? "",
    createdAt: Date.now(),
    isActive: true,
    editorIds: [],
    totalListings: 0,
    totalInquiries: 0,
    rating: 0,
    reviewCount: 0,
  });
  return docRef.id;
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const q = query(collection(db, "shops"), where("slug", "==", slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Shop;
}

export async function getShopById(shopId: string): Promise<Shop | null> {
  const snap = await getDoc(doc(db, "shops", shopId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Shop;
}

export async function getShopsByOwner(ownerId: string): Promise<Shop[]> {
  const q = query(collection(db, "shops"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shop));
}

export async function getShopsWhereEditor(uid: string): Promise<Shop[]> {
  const q = query(collection(db, "shops"), where("editorIds", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shop));
}

export async function updateShop(shopId: string, data: Partial<Shop>): Promise<void> {
  const { id, ...rest } = data as any;
  await updateDoc(doc(db, "shops", shopId), rest);
}

export async function uploadShopBanner(shopId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `shopBanners/${shopId}/banner.jpg`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadShopLogo(shopId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `shopLogos/${shopId}/logo.jpg`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ── Shop Editors ──────────────────────────────────────────────────────────────
export async function addShopEditor(shopId: string, editorUid: string, currentEditors: string[]): Promise<void> {
  if (currentEditors.length >= 3) throw new Error("Maximum 3 editors allowed.");
  if (currentEditors.includes(editorUid)) throw new Error("User is already an editor.");
  await updateDoc(doc(db, "shops", shopId), {
    editorIds: [...currentEditors, editorUid],
  });
}

export async function removeShopEditor(shopId: string, editorUid: string, currentEditors: string[]): Promise<void> {
  await updateDoc(doc(db, "shops", shopId), {
    editorIds: currentEditors.filter((id) => id !== editorUid),
  });
}

// ── Shop Listings ─────────────────────────────────────────────────────────────
export async function createShopListing(data: Omit<ShopListing, "id" | "viewCount" | "inquiryCount" | "createdAt">): Promise<string> {
  const docRef = await addDoc(collection(db, "shopListings"), {
    ...data,
    createdAt: Date.now(),
    viewCount: 0,
    inquiryCount: 0,
    isActive: true,
  });
  await updateDoc(doc(db, "shops", data.shopId), { totalListings: increment(1) });
  return docRef.id;
}

export async function getShopListings(shopId: string): Promise<ShopListing[]> {
  const q = query(
    collection(db, "shopListings"),
    where("shopId", "==", shopId),
    where("isActive", "==", true),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopListing));
}

export async function getAllShopListings(limitCount = 40): Promise<ShopListing[]> {
  const q = query(
    collection(db, "shopListings"),
    where("isActive", "==", true),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopListing));
}

export async function getShopListingsByCategory(category: string, limitCount = 40): Promise<ShopListing[]> {
  const q = query(
    collection(db, "shopListings"),
    where("isActive", "==", true),
    where("category", "==", category),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopListing));
}

export async function updateShopListing(listingId: string, data: Partial<ShopListing>): Promise<void> {
  const { id, ...rest } = data as any;
  await updateDoc(doc(db, "shopListings", listingId), rest);
}

export async function deleteShopListing(listingId: string, shopId: string): Promise<void> {
  await updateDoc(doc(db, "shopListings", listingId), { isActive: false });
  await updateDoc(doc(db, "shops", shopId), { totalListings: increment(-1) });
}

export async function incrementShopListingView(listingId: string): Promise<void> {
  await updateDoc(doc(db, "shopListings", listingId), { viewCount: increment(1) });
}

export async function uploadShopListingPhoto(shopId: string, file: File, index: number): Promise<string> {
  const storageRef = ref(storage, `shopListingPhotos/${shopId}/${Date.now()}_${index}.jpg`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ── Inquiries ─────────────────────────────────────────────────────────────────
export async function createInquiry(data: {
  shopId: string;
  shopName: string;
  shopListingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  quantity?: number;
  note: string;
}): Promise<string> {
  const docRef = await addDoc(collection(db, "shopInquiries"), {
    ...data,
    status: "pending" as InquiryStatus,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    reviewLeft: false,
  });
  await updateDoc(doc(db, "shopListings", data.shopListingId), { inquiryCount: increment(1) });
  await updateDoc(doc(db, "shops", data.shopId), { totalInquiries: increment(1) });
  return docRef.id;
}

export async function getInquiriesForShop(shopId: string): Promise<ShopInquiry[]> {
  const q = query(
    collection(db, "shopInquiries"),
    where("shopId", "==", shopId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopInquiry));
}

export async function getInquiriesForBuyer(buyerId: string): Promise<ShopInquiry[]> {
  const q = query(
    collection(db, "shopInquiries"),
    where("buyerId", "==", buyerId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopInquiry));
}

export async function updateInquiryStatus(inquiryId: string, status: InquiryStatus): Promise<void> {
  await updateDoc(doc(db, "shopInquiries", inquiryId), { status, updatedAt: Date.now() });
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export async function leaveShopReview(data: {
  shopId: string;
  inquiryId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  listingTitle: string;
  rating: number;
  comment: string;
}): Promise<void> {
  await addDoc(collection(db, "shopReviews"), { ...data, createdAt: Date.now() });
  await updateDoc(doc(db, "shopInquiries", data.inquiryId), { reviewLeft: true });
  const reviewsSnap = await getDocs(query(collection(db, "shopReviews"), where("shopId", "==", data.shopId)));
  const reviews = reviewsSnap.docs.map((d) => d.data() as ShopReview);
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  await updateDoc(doc(db, "shops", data.shopId), {
    rating: Math.round(avg * 10) / 10,
    reviewCount: reviews.length,
  });
}

export async function getShopReviews(shopId: string): Promise<ShopReview[]> {
  const q = query(
    collection(db, "shopReviews"),
    where("shopId", "==", shopId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopReview));
}

// ── Shop Ads ──────────────────────────────────────────────────────────────────
export async function submitShopAd(data: Omit<ShopAd, "id" | "impressions" | "clicks" | "submittedAt" | "status">): Promise<string> {
  const docRef = await addDoc(collection(db, "shopAds"), {
    ...data,
    status: "pending" as const,
    impressions: 0,
    clicks: 0,
    submittedAt: Date.now(),
  });
  return docRef.id;
}

export async function getApprovedShopAds(): Promise<ShopAd[]> {
  const now = Date.now();
  const q = query(
    collection(db, "shopAds"),
    where("status", "==", "approved"),
    where("startDate", "<=", now),
    where("endDate", ">=", now)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopAd));
}

export async function getAllShops(limitCount = 50): Promise<Shop[]> {
  const q = query(
    collection(db, "shops"),
    where("isActive", "==", true),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shop));
}
