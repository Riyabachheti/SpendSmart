import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";

import { SessionLoading } from "./session-loading";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <SessionLoading />;
  }

  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
