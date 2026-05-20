import { initSentry, Sentry } from "./lib/sentry";
initSentry();
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { DarkModeProvider } from "./contexts/DarkModeContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DarkModeProvider>
      <AuthProvider>
        <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred.</p>}>
          <App />
        </Sentry.ErrorBoundary>
      </AuthProvider>
    </DarkModeProvider>
  </React.StrictMode>
);
