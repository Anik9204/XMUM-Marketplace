import { Switch, Route, Redirect } from "wouter";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import AdsPage from "./pages/AdsPage";
import Layout from "./components/Layout";

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
        <Route path="/"          component={DashboardPage} />
        <Route path="/reports"   component={ReportsPage} />
        <Route path="/users"     component={UsersPage} />
        <Route path="/ads"       component={AdsPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </Layout>
  );
}
