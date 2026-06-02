import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DarkModeProvider } from "@/contexts/DarkModeContext";
import Layout from "@/components/Layout";
import LoadingScreen from "@/components/LoadingScreen";

const HomePage          = lazy(() => import("@/pages/HomePage"));
const SearchPage        = lazy(() => import("@/pages/SearchPage"));
const PostPage          = lazy(() => import("@/pages/PostPage"));
const ProfilePage       = lazy(() => import("@/pages/ProfilePage"));
const SettingsPage      = lazy(() => import("@/pages/SettingsPage"));
const ListingDetailPage = lazy(() => import("@/pages/ListingDetailPage"));
const EditListingPage   = lazy(() => import("@/pages/EditListingPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const MessagesPage      = lazy(() => import("@/pages/MessagesPage"));
const SellerProfilePage = lazy(() => import("@/pages/SellerProfilePage"));
const CampusMarketPage  = lazy(() => import("@/pages/CampusMarketPage"));
const CreateShopPage    = lazy(() => import("@/pages/CreateShopPage"));
const ShopDashboardPage = lazy(() => import("@/pages/ShopDashboardPage"));
const ShopPublicPage          = lazy(() => import("@/pages/ShopPublicPage"));
const ShopListingDetailPage   = lazy(() => import("@/pages/ShopListingDetailPage"));
const HelpPage                = lazy(() => import("@/pages/HelpPage"));
const NotFound                = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 animate-pulse" />
  );
}

function FirebaseActionHandler() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");

    // If on /__/auth/action with no mode, Firebase already handled verification.
    // Redirect to homepage and open sign in modal.
    if (!mode) {
      if (window.location.pathname === "/__/auth/action") {
        navigate("/?signin=1", { replace: true });
      }
      return;
    }

    if (mode === "resetPassword" && oobCode) {
      navigate(`/reset-password?oobCode=${encodeURIComponent(oobCode)}`, {
        replace: true,
      });
      return;
    }

    if (mode === "verifyEmail" && oobCode) {
      import("firebase/auth").then(({ applyActionCode }) => {
        import("@/lib/firebase").then(({ auth }) => {
          applyActionCode(auth, oobCode)
            .then(() => auth.currentUser?.reload())
            .catch(() => {})
            .finally(() => {
              navigate("/", { replace: true });
            });
        });
      });
      return;
    }

    // All other cases (mode=verifyEmail without oobCode, or unknown mode)
    // User arrived via Firebase's own verification page — oobCode already consumed
    // Open homepage with sign in modal
    navigate("/?signin=1", { replace: true });
  }, []);

  return null;
}

function Router() {
  return (
    <Layout>
      <FirebaseActionHandler />
      <Suspense fallback={<PageSkeleton />}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/search" component={SearchPage} />
          <Route path="/post" component={PostPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/listing/:id" component={ListingDetailPage} />
          <Route path="/edit/:id" component={EditListingPage} />
          <Route path="/messages" component={MessagesPage} />
          <Route path="/seller/:uid" component={SellerProfilePage} />
          <Route path="/campus-market" component={CampusMarketPage} />
          <Route path="/create-shop" component={CreateShopPage} />
          <Route path="/shop-dashboard/:shopId" component={ShopDashboardPage} />
          <Route path="/shop/:slug" component={ShopPublicPage} />
          <Route path="/shop-listing/:listingId" component={ShopListingDetailPage} />
          <Route path="/help" component={HelpPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <DarkModeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
      {loading && <LoadingScreen onFinish={() => setLoading(false)} />}
    </DarkModeProvider>
  );
}

export default App;
