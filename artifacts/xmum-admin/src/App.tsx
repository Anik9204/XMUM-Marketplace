import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { useAuth } from "./contexts/AuthContext";
import LoginPage        from "./pages/LoginPage";
import Layout           from "./components/Layout";

const DashboardPage         = lazy(() => import("./pages/DashboardPage"));
const ReportsPage           = lazy(() => import("./pages/ReportsPage"));
const UsersPage             = lazy(() => import("./pages/UsersPage"));
const AdsPage               = lazy(() => import("./pages/AdsPage"));
const RentalAuditPage       = lazy(() => import("./pages/RentalAuditPage"));
const ListingsPage          = lazy(() => import("./pages/ListingsPage"));
const AnalyticsPage         = lazy(() => import("./pages/AnalyticsPage"));
const ShopsPage             = lazy(() => import("./pages/ShopsPage"));
const ShopAdsPage           = lazy(() => import("./pages/ShopAdsPage"));
const AuditLogPage          = lazy(() => import("./pages/AuditLogPage"));
const ShopApprovalsPage     = lazy(() => import("./pages/ShopApprovalsPage"));
const SubscriptionConfigPage = lazy(() => import("./pages/SubscriptionConfigPage"));
const AiFlaggedPage          = lazy(() => import("./pages/AiFlaggedPage"));

export default function App() {
  const { user, isEditor, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isEditor) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <Switch>
        <Route path="/"               component={DashboardPage} />
        <Route path="/listings"       component={ListingsPage} />
        <Route path="/users"          component={UsersPage} />
        <Route path="/reports"        component={ReportsPage} />
        <Route path="/rental-audit"   component={RentalAuditPage} />
        <Route path="/ads"            component={AdsPage} />
        <Route path="/analytics"      component={AnalyticsPage} />
        <Route path="/shops"          component={ShopsPage} />
        <Route path="/shop-ads"       component={ShopAdsPage} />
        <Route path="/audit-log"      component={AuditLogPage} />
        <Route path="/shop-approvals"      component={ShopApprovalsPage} />
        <Route path="/subscription-config" component={SubscriptionConfigPage} />
        <Route path="/ai-flagged"          component={AiFlaggedPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
      </Suspense>
    </Layout>
  );
}
