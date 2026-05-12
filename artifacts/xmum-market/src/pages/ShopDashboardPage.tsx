import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { getShopById } from "@/lib/shops";
import { Shop } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function ShopDashboardPage() {
  const [, params] = useRoute("/shop-dashboard/:shopId");
  const [, navigate] = useLocation();
  const shopId = params?.shopId ?? "";

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) { setLoading(false); return; }
    getShopById(shopId)
      .then((s) => {
        setShop(s);
        if (s) {
          navigate(`/shop/${s.slug}`, { replace: true });
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [shopId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin text-[#003366] dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-gray-500 dark:text-slate-400">Shop not found.</p>
    </div>
  );
}
