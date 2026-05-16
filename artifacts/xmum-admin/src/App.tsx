import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "./contexts/AuthContext";
import LoginPage        from "./pages/LoginPage";
import DashboardPage    from "./pages/DashboardPage";
import ReportsPage      from "./pages/ReportsPage";
import UsersPage        from "./pages/UsersPage";
import AdsPage          from "./pages/AdsPage";
import RentalAuditPage  from "./pages/RentalAuditPage";
import VerificationPage from "./pages/VerificationPage";
import ReviewsPage      from "./pages/ReviewsPage";
import ListingsPage     from "./pages/ListingsPage";
import AnalyticsPage    from "./pages/AnalyticsPage";
import ShopsPage        from "./pages/ShopsPage";
import ShopAdsPage      from "./pages/ShopAdsPage";
import AuditLogPage     from "./pages/AuditLogPage";
import ShopApprovalsPage from "./pages/ShopApprovalsPage";
import Layout           from "./components/Layout";

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
      <Switch>
        <Route path="/"               component={DashboardPage} />
        <Route path="/listings"       component={ListingsPage} />
        <Route path="/users"          component={UsersPage} />
        <Route path="/reports"        component={ReportsPage} />
        <Route path="/reviews"        component={ReviewsPage} />
        <Route path="/verifications"  component={VerificationPage} />
        <Route path="/rental-audit"   component={RentalAuditPage} />
        <Route path="/ads"            component={AdsPage} />
        <Route path="/analytics"      component={AnalyticsPage} />
        <Route path="/shops"          component={ShopsPage} />
        <Route path="/shop-ads"       component={ShopAdsPage} />
        <Route path="/audit-log"      component={AuditLogPage} />
        <Route path="/shop-approvals" component={ShopApprovalsPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Layout>
  );
}
