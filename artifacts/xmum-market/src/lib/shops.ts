import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, increment,
  onSnapshot, Timestamp, deleteField,
} from "firebase/firestore";

import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { Shop, ShopListing, ShopInquiry, ShopAd, InquiryStatus, ShopOrderQuestion, ShopOrder, ShopReview } from "@/lib/types";
import { shopListingHasActiveReport } from "@/lib/reportHold";

import {
  notifyShopInquiryReceived,
  notifyInquiryStatusChanged,
  notifyShopOrderReceived,
} from "@/lib/notifications";

function stripUndefined(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function cleanQuestions(questions: ShopOrderQuestion[]): ShopOrderQuestion[] {
  return questions.map((q) => {
    const clean: any = { id: q.id, label: q.label, type: q.type, required: q.required };
    if (q.type === "select") clean.options = (q.options ?? []).filter(Boolean);
    return clean;
  });
}

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
    isActive: false,
    approvalStatus: "pending",
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
  const uid = auth.currentUser?.uid ?? shopId;
  const storageRef = ref(storage, `shopBanners/${uid}/banner_${shopId}.jpg`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadShopLogo(shopId: string, file: File): Promise<string> {
  const uid = auth.currentUser?.uid ?? shopId;
  const storageRef = ref(storage, `shopLogos/${uid}/logo_${shopId}.jpg`);
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
  try {
    const { arrayUnion } = await import("firebase/firestore");
    await updateDoc(doc(db, "users", editorUid), {
      editorShopIds: arrayUnion(shopId),
    });
  } catch {}
}

export async function removeShopEditor(shopId: string, editorUid: string, currentEditors: string[]): Promise<void> {
  await updateDoc(doc(db, "shops", shopId), {
    editorIds: currentEditors.filter((id) => id !== editorUid),
  });
  try {
    const { arrayRemove } = await import("firebase/firestore");
    await updateDoc(doc(db, "users", editorUid), {
      editorShopIds: arrayRemove(shopId),
    });
  } catch {}
}

// ── Shop Listings ─────────────────────────────────────────────────────────────
export async function createShopListing(data: Omit<ShopListing, "id" | "viewCount" | "inquiryCount" | "rating" | "reviewCount" | "createdAt">): Promise<string> {
  const payload = stripUndefined({
    ...data,
    createdAt: Date.now(),
    viewCount: 0,
    inquiryCount: 0,
    rating: 0,
    reviewCount: 0,
    isActive: true,
  });
  if (payload.orderQuestions) payload.orderQuestions = cleanQuestions(payload.orderQuestions);
  const docRef = await addDoc(collection(db, "shopListings"), payload);
  await updateDoc(doc(db, "shops", data.shopId), { totalListings: increment(1) });
  return docRef.id;
}

export async function getShopListings(shopId: string): Promise<ShopListing[]> {
  // Single equality filter — no composite index needed; filter + sort client-side
  const q = query(
    collection(db, "shopListings"),
    where("shopId", "==", shopId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ShopListing))
    .filter((l) => l.isActive !== false)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getFeaturedShops(limitCount = 8): Promise<Shop[]> {
  try {
    const q = query(
      collection(db, "shops"),
      orderBy("createdAt", "desc"),
      limit(limitCount * 2)
    );
    const snap = await getDocs(q);
    const active = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Shop))
      .filter((s) => s.isActive !== false && s.isSuspended !== true && s.subscriptionStatus !== "expired");

    // Sort: shops with ratings first, then by createdAt
    active.sort((a, b) => {
      if ((b.reviewCount ?? 0) !== (a.reviewCount ?? 0)) return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      return b.createdAt - a.createdAt;
    });

    return active.slice(0, limitCount);
  } catch {
    return [];
  }
}

export async function getRecentShopListings(limitCount = 6): Promise<ShopListing[]> {
  try {
    const q = query(
      collection(db, "shopListings"),
      orderBy("createdAt", "desc"),
      limit(limitCount * 2)
    );
    const snap = await getDocs(q);
    const listings = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as ShopListing))
      .filter((l) => l.isActive !== false);

    const shopIds = [...new Set(listings.map((l) => l.shopId))];
    const shopStatuses: Record<string, boolean> = {};
    await Promise.all(
      shopIds.map(async (id) => {
        try {
          const s = await getDoc(doc(db, "shops", id));
          shopStatuses[id] = s.exists() && s.data()?.isActive !== false && s.data()?.isSuspended !== true && s.data()?.subscriptionStatus !== "expired";
        } catch {
          shopStatuses[id] = false;
        }
      })
    );
    return listings
      .filter((l) => shopStatuses[l.shopId] !== false)
      .slice(0, limitCount);
  } catch {
    return [];
  }
}

export async function getAllShopListings(limitCount = 40): Promise<ShopListing[]> {
  const q = query(
    collection(db, "shopListings"),
    orderBy("createdAt", "desc"),
    limit(limitCount * 3),
  );
  const snap = await getDocs(q);
  const listings = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ShopListing))
    .filter((l) => l.isActive !== false);

  const shopIds = [...new Set(listings.map((l) => l.shopId))];
  const shopStatuses: Record<string, boolean> = {};
  await Promise.all(
    shopIds.map(async (id) => {
      try {
        const s = await getDoc(doc(db, "shops", id));
        shopStatuses[id] = s.exists() && s.data()?.isActive !== false && s.data()?.isSuspended !== true && s.data()?.subscriptionStatus !== "expired";
      } catch {
        shopStatuses[id] = false;
      }
    })
  );

  return listings
    .filter((l) => shopStatuses[l.shopId] !== false)
    .slice(0, limitCount);
}

export async function getShopListingsByCategory(category: string, limitCount = 40): Promise<ShopListing[]> {
  const q = query(
    collection(db, "shopListings"),
    where("category", "==", category),
  );
  const snap = await getDocs(q);
  const listings = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ShopListing))
    .filter((l) => l.isActive !== false)
    .sort((a, b) => b.createdAt - a.createdAt);

  const shopIds = [...new Set(listings.map((l) => l.shopId))];
  const shopStatuses: Record<string, boolean> = {};
  await Promise.all(
    shopIds.map(async (id) => {
      try {
        const s = await getDoc(doc(db, "shops", id));
        shopStatuses[id] = s.exists() && s.data()?.isActive !== false && s.data()?.isSuspended !== true && s.data()?.subscriptionStatus !== "expired";
      } catch {
        shopStatuses[id] = false;
      }
    })
  );

  return listings
    .filter((l) => shopStatuses[l.shopId] !== false)
    .slice(0, limitCount);
}

export async function updateShopListing(listingId: string, data: Partial<ShopListing>): Promise<void> {
  const { id, ...rest } = data as any;
  const clean = stripUndefined(rest);
  if ("orderQuestions" in rest) {
    if (Array.isArray(rest.orderQuestions) && rest.orderQuestions.length > 0) {
      clean.orderQuestions = cleanQuestions(rest.orderQuestions);
    } else {
      // empty array → remove the field so listing falls back to shop-level questions
      clean.orderQuestions = deleteField();
    }
  }
  await updateDoc(doc(db, "shopListings", listingId), clean);
}

export async function deleteShopListing(listingId: string, shopId: string): Promise<void> {
  const held = await shopListingHasActiveReport(listingId);
  if (held) {
    await updateDoc(doc(db, "shopListings", listingId), { isActive: false });
    throw Object.assign(new Error("report-hold"), { code: "report-hold" });
  }
  // Delete photos from Storage before deactivating the document
  const listingSnap = await getDoc(doc(db, "shopListings", listingId));
  const photos: string[] = listingSnap.data()?.photos ?? [];
  if (photos.length > 0) {
    await Promise.allSettled(
      photos.map((url) => {
        const path = storagePathFromUrl(url);
        if (!path) return Promise.resolve();
        return deleteObject(ref(storage, path)).catch(() => {});
      })
    );
  }
  await updateDoc(doc(db, "shopListings", listingId), { isActive: false });
  await updateDoc(doc(db, "shops", shopId), { totalListings: increment(-1) });
}

export async function incrementShopListingView(listingId: string, shopId?: string, visitorId?: string): Promise<void> {
  await updateDoc(doc(db, "shopListings", listingId), { viewCount: increment(1) });
  if (shopId) {
    addDoc(collection(db, "shopVisits"), {
      shopId,
      listingId,
      visitedAt: Date.now(),
      ...(visitorId ? { visitorId } : {}),
    }).catch(() => {});
  }
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
  // Fire-and-forget counter updates — never block or fail the inquiry submission
  Promise.all([
    updateDoc(doc(db, "shopListings", data.shopListingId), { inquiryCount: increment(1) }),
    updateDoc(doc(db, "shops", data.shopId), { totalInquiries: increment(1) }),
  ]).catch(() => {}); // Silently ignore counter update failures

  // Notify the shop owner and editors — non-critical, fire and forget
  const shop = await getShopById(data.shopId);
  if (shop) {
    notifyShopInquiryReceived(
      shop.ownerId,
      data.shopName,
      data.buyerName,
      docRef.id,
      data.shopId,
    ).catch(() => {});
    for (const editorId of shop.editorIds) {
      notifyShopInquiryReceived(editorId, data.shopName, data.buyerName, docRef.id, data.shopId).catch(() => {});
    }
  }

  return docRef.id;
}

export async function getInquiriesForShop(shopId: string): Promise<ShopInquiry[]> {
  try {
    const q = query(
      collection(db, "shopInquiries"),
      where("shopId", "==", shopId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopInquiry));
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const q2 = query(collection(db, "shopInquiries"), where("shopId", "==", shopId));
      const snap2 = await getDocs(q2);
      return snap2.docs
        .map((d) => ({ id: d.id, ...d.data() } as ShopInquiry))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    throw err;
  }
}

export async function getInquiriesForBuyer(buyerId: string): Promise<ShopInquiry[]> {
  try {
    const q = query(
      collection(db, "shopInquiries"),
      where("buyerId", "==", buyerId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopInquiry));
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const q2 = query(collection(db, "shopInquiries"), where("buyerId", "==", buyerId));
      const snap2 = await getDocs(q2);
      return snap2.docs
        .map((d) => ({ id: d.id, ...d.data() } as ShopInquiry))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    throw err;
  }
}

export async function updateInquiryStatus(inquiryId: string, status: InquiryStatus): Promise<void> {
  await updateDoc(doc(db, "shopInquiries", inquiryId), { status, updatedAt: Date.now() });

  // Notify the buyer — non-critical, fire and forget
  try {
    const snap = await getDoc(doc(db, "shopInquiries", inquiryId));
    if (snap.exists()) {
      const inquiry = snap.data() as ShopInquiry;
      notifyInquiryStatusChanged(
        inquiry.buyerId,
        inquiry.shopName,
        status,
        inquiryId,
        inquiry.shopId,
      ).catch(() => {});
    }
  } catch {
    // Silently ignore — notification is non-critical
  }
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export async function leaveShopReview(data: {
  shopId: string;
  shopListingId: string;
  inquiryId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar?: string;
  listingTitle: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const confirmedQ = query(
    collection(db, "shopOrders"),
    where("shopId", "==", data.shopId),
    where("buyerId", "==", data.reviewerId),
    where("status", "==", "confirmed")
  );
  const confirmedOrders = await getDocs(confirmedQ);
  if (confirmedOrders.empty) {
    throw new Error("You can only review a shop after the shop has confirmed your order.");
  }
  await addDoc(collection(db, "shopReviews"), { ...data, createdAt: Date.now() });
  // Mark the order as reviewed (use inquiryId as orderId for orders path)
  await updateDoc(doc(db, "shopOrders", data.inquiryId), { reviewLeft: true }).catch(() => {
    // Fall back to shopInquiries for backward-compat
    return updateDoc(doc(db, "shopInquiries", data.inquiryId), { reviewLeft: true }).catch(() => {});
  });
  // Update shop-level rating
  const shopReviewsSnap = await getDocs(query(collection(db, "shopReviews"), where("shopId", "==", data.shopId)));
  const shopReviews = shopReviewsSnap.docs.map((d) => d.data() as ShopReview);
  const shopAvg = shopReviews.reduce((sum, r) => sum + r.rating, 0) / shopReviews.length;
  await updateDoc(doc(db, "shops", data.shopId), {
    rating: Math.round(shopAvg * 10) / 10,
    reviewCount: shopReviews.length,
  });
  // Update per-listing rating
  try {
    const listingReviewsSnap = await getDocs(
      query(collection(db, "shopReviews"), where("shopListingId", "==", data.shopListingId))
    );
    const listingReviews = listingReviewsSnap.docs.map((d) => d.data() as ShopReview);
    const listingAvg = listingReviews.reduce((sum, r) => sum + r.rating, 0) / listingReviews.length;
    await updateDoc(doc(db, "shopListings", data.shopListingId), {
      rating: Math.round(listingAvg * 10) / 10,
      reviewCount: listingReviews.length,
    });
  } catch {
    // Non-critical — silently ignore per-listing update failures
  }
}

export async function getListingReviews(shopListingId: string): Promise<ShopReview[]> {
  try {
    const q = query(
      collection(db, "shopReviews"),
      where("shopListingId", "==", shopListingId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopReview));
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const q2 = query(collection(db, "shopReviews"), where("shopListingId", "==", shopListingId));
      const snap2 = await getDocs(q2);
      return snap2.docs
        .map((d) => ({ id: d.id, ...d.data() } as ShopReview))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    throw err;
  }
}

export async function getShopVisitorCount30Days(shopId: string): Promise<number> {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  try {
    const q = query(
      collection(db, "shopVisits"),
      where("shopId", "==", shopId),
      where("visitedAt", ">=", since)
    );
    const snap = await getDocs(q);
    const uniqueVisitors = new Set<string>();
    snap.docs.forEach((d) => {
      const vid = d.data().visitorId as string | undefined;
      if (vid) uniqueVisitors.add(vid);
    });
    return uniqueVisitors.size > 0 ? uniqueVisitors.size : snap.size;
  } catch {
    return 0;
  }
}

export async function getListingViews30Days(shopId: string): Promise<Record<string, number>> {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  try {
    const q = query(
      collection(db, "shopVisits"),
      where("shopId", "==", shopId),
      where("visitedAt", ">=", since)
    );
    const snap = await getDocs(q);
    const counts: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const lid = d.data().listingId as string;
      counts[lid] = (counts[lid] ?? 0) + 1;
    });
    return counts;
  } catch {
    return {};
  }
}

export async function getPendingActivityCount(shopId: string): Promise<number> {
  try {
    const [ordersSnap, inquiriesSnap] = await Promise.all([
      getDocs(query(collection(db, "shopOrders"), where("shopId", "==", shopId), where("status", "==", "pending"))),
      getDocs(query(collection(db, "shopInquiries"), where("shopId", "==", shopId), where("status", "==", "pending"))),
    ]);
    return ordersSnap.size + inquiriesSnap.size;
  } catch {
    return 0;
  }
}

export async function getShopReviews(shopId: string): Promise<ShopReview[]> {
  try {
    const q = query(
      collection(db, "shopReviews"),
      where("shopId", "==", shopId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopReview));
  } catch (err: any) {
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      const q2 = query(collection(db, "shopReviews"), where("shopId", "==", shopId));
      const snap2 = await getDocs(q2);
      return snap2.docs
        .map((d) => ({ id: d.id, ...d.data() } as ShopReview))
        .sort((a, b) => b.createdAt - a.createdAt);
    }
    throw err;
  }
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
  // Single equality filter only — filter date range client-side
  const q = query(
    collection(db, "shopAds"),
    where("status", "==", "approved"),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ShopAd))
    .filter((ad) => ad.startDate <= now && ad.endDate >= now);
}

// ── Orders ────────────────────────────────────────────────────────────────────
export async function deleteInquiry(inquiryId: string): Promise<void> {
  await deleteDoc(doc(db, "shopInquiries", inquiryId));
}

export async function createOrder(data: {
  shopId: string;
  shopName: string;
  shopListingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  buyerWhatsapp?: string | null;
  buyerWechat?: string | null;
  quantity: number;
  offeredPrice?: number | null;
  answers: Record<string, string>;
}): Promise<string> {
  const payload = Object.fromEntries(
    Object.entries({ ...data, status: "pending", createdAt: Date.now(), updatedAt: Date.now(), reviewLeft: false })
      .map(([k, v]) => [k, v === undefined ? null : v])
  );
  const docRef = await addDoc(collection(db, "shopOrders"), payload);
  // Notify owner + editors — non-critical, fire and forget
  const shop = await getShopById(data.shopId);
  if (shop) {
    notifyShopOrderReceived(
      shop.ownerId, data.shopName, data.buyerName, docRef.id, data.shopId, shop.editorIds,
    ).catch(() => {});
  }
  return docRef.id;
}

export async function getOrdersForShop(shopId: string): Promise<ShopOrder[]> {
  try {
    const q = query(
      collection(db, "shopOrders"),
      where("shopId", "==", shopId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopOrder));
  } catch (err: any) {
    const code = err?.code ?? "";
    if (code === "failed-precondition" || code === "unimplemented" || err?.message?.includes("index")) {
      try {
        const q2 = query(collection(db, "shopOrders"), where("shopId", "==", shopId));
        const snap2 = await getDocs(q2);
        return snap2.docs
          .map((d) => ({ id: d.id, ...d.data() } as ShopOrder))
          .sort((a, b) => b.createdAt - a.createdAt);
      } catch {
        return [];
      }
    }
    // Permission errors or other failures — return empty rather than crashing the UI
    console.warn("[shops] getOrdersForShop failed:", err?.code, err?.message);
    return [];
  }
}

export async function getOrdersForBuyer(buyerId: string): Promise<ShopOrder[]> {
  try {
    const q = query(
      collection(db, "shopOrders"),
      where("buyerId", "==", buyerId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShopOrder));
  } catch (err: any) {
    const q2 = query(collection(db, "shopOrders"), where("buyerId", "==", buyerId));
    const snap2 = await getDocs(q2);
    return snap2.docs
      .map((d) => ({ id: d.id, ...d.data() } as ShopOrder))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: "confirmed" | "cancelled",
  cancellationReason?: string
): Promise<void> {
  const updateData: any = { status, updatedAt: Date.now() };
  if (status === "cancelled" && cancellationReason) {
    updateData.cancellationReason = cancellationReason.trim();
  }
  await updateDoc(doc(db, "shopOrders", orderId), updateData);
}

// ── Shop Order Questions ───────────────────────────────────────────────────────
export async function saveOrderQuestions(
  shopId: string,
  questions: ShopOrderQuestion[]
): Promise<void> {
  await updateDoc(doc(db, "shops", shopId), {
    orderQuestions: questions.length > 0 ? cleanQuestions(questions) : deleteField(),
  });
}

// ── Automated Inquiry Reply ───────────────────────────────────────────────────
export async function saveAutoReply(shopId: string, message: string): Promise<void> {
  await updateDoc(doc(db, "shops", shopId), {
    autoReplyMessage: message.trim(),
    autoReplyEnabled: message.trim().length > 0,
  });
}

export async function getAutoReply(shopId: string): Promise<{ enabled: boolean; message: string } | null> {
  const snap = await getDoc(doc(db, "shops", shopId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    enabled: data.autoReplyEnabled ?? false,
    message: data.autoReplyMessage ?? "",
  };
}

// ── Storage path helper ───────────────────────────────────────────────────────
function storagePathFromUrl(url: string): string | null {
  try {
    const decodedUrl = decodeURIComponent(url);
    const match = decodedUrl.match(/\/o\/(.+?)(\?|$)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ── Complete shop deletion ────────────────────────────────────────────────────
export async function deleteShopCompletely(shopId: string): Promise<void> {
  const { writeBatch } = await import("firebase/firestore");

  // Fetch all sub-collections in parallel
  const [listingsSnap, inquiriesSnap, ordersSnap, reviewsSnap] = await Promise.all([
    getDocs(query(collection(db, "shopListings"), where("shopId", "==", shopId))),
    getDocs(query(collection(db, "shopInquiries"), where("shopId", "==", shopId))),
    getDocs(query(collection(db, "shopOrders"), where("shopId", "==", shopId))),
    getDocs(query(collection(db, "shopReviews"), where("shopId", "==", shopId))),
  ]);

  // Delete all listing photos and shop media from storage (best-effort)
  const storageJobs: Promise<void>[] = [];
  for (const d of listingsSnap.docs) {
    for (const url of (d.data().photos ?? []) as string[]) {
      const path = storagePathFromUrl(url);
      if (path) storageJobs.push(deleteObject(ref(storage, path)).catch(() => {}));
    }
  }
  const shopSnap = await getDoc(doc(db, "shops", shopId));
  if (shopSnap.exists()) {
    const sd = shopSnap.data();
    for (const url of [sd.bannerUrl, sd.logoUrl].filter(Boolean)) {
      const path = storagePathFromUrl(url as string);
      if (path) storageJobs.push(deleteObject(ref(storage, path)).catch(() => {}));
    }
  }
  await Promise.allSettled(storageJobs);

  // Batch-delete all Firestore documents (max 400 per batch)
  const allDocs = [
    ...listingsSnap.docs,
    ...inquiriesSnap.docs,
    ...ordersSnap.docs,
    ...reviewsSnap.docs,
  ];
  const BATCH_SIZE = 400;
  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const d of allDocs.slice(i, i + BATCH_SIZE)) batch.delete(d.ref);
    await batch.commit();
  }

  // Finally delete the shop document itself
  await deleteDoc(doc(db, "shops", shopId));
}

export async function getAllShops(limitCount = 50): Promise<Shop[]> {
  // orderBy on single field uses auto-created single-field index; filter isActive client-side
  const q = query(
    collection(db, "shops"),
    orderBy("createdAt", "desc"),
    limit(limitCount * 2),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Shop))
    .filter((s) => s.isActive !== false && s.isSuspended !== true && s.subscriptionStatus !== "expired")
    .slice(0, limitCount);
}
