import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

interface LegacyRedirectProps {
  to: string;
  message?: string;
}

export function LegacyRedirect({ to, message }: LegacyRedirectProps) {
  const location = useLocation();

  useEffect(() => {
    toast.info("URL Updated", {
      description: message || `This page has moved to ${to}. Please update your bookmarks.`,
      duration: 5000,
    });
  }, [to, message]);

  return <Navigate to={to} replace state={{ from: location.pathname }} />;
}
