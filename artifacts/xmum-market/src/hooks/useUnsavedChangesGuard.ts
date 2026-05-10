import { useEffect } from "react";

export function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const originalPushState = history.pushState.bind(history);
    history.pushState = function (...args) {
      const confirmed = window.confirm(
        "You have unsaved changes. Leave anyway?"
      );
      if (confirmed) {
        history.pushState = originalPushState;
        originalPushState(...args);
      }
    };
    return () => {
      history.pushState = originalPushState;
    };
  }, [isDirty]);
}
