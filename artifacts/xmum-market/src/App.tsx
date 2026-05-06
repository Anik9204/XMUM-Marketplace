import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import SearchPage from "@/pages/SearchPage";
import PostPage from "@/pages/PostPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import ListingDetailPage from "@/pages/ListingDetailPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// Intercepts Firebase Auth action URLs (?mode=resetPassword&oobCode=...)
// and redirects them to the dedicated in-app route before any page renders.
function FirebaseActionHandler() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const oobCode = params.get("oobCode");

    if (mode === "resetPassword" && oobCode) {
      navigate(`/reset-password?oobCode=${encodeURIComponent(oobCode)}`, {
        replace: true,
      });
    }
  }, []);

  return null;
}

function Router() {
  return (
    <Layout>
      <FirebaseActionHandler />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/post" component={PostPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/listing/:id" component={ListingDetailPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
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
  );
}

export default App;
