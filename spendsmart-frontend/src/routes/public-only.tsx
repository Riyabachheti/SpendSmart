import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";

import { SessionLoading } from "./session-loading";

export function PublicOnly() {
  const { status } = useAuth();

  if (status === "loading") {
    return <SessionLoading />;
  }

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
