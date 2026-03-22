"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authApi } from "@/lib/api";
import axios from "@/lib/axios";

interface ProtectedRouteProps {
  children: React.ReactNode;
  lang: string;
}

export function ProtectedRoute({ children, lang }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const validateAuth = async () => {
      const token = authApi.getStoredToken();

      if (!token) {
        // No token found, redirect to login
        router.push(`/${lang}/login?from=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        // Verify token with backend by making a test request
        await axios.get("/api/admin/verify");
        setIsAuthenticated(true);
      } catch (error: any) {
        const status = error?.response?.status;

        // Token is valid but user is not allowed in admin panel (e.g. STUDENT).
        // Per requirements: redirect them to /chat (do NOT log them out).
        if (status === 403 && typeof window !== "undefined") {
          const userAppUrl = process.env.NEXT_PUBLIC_USER_APP_URL;
          const target = userAppUrl
            ? `${userAppUrl.replace(/\/$/, "")}/chat`
            : "/chat";
          window.location.href = target;
          return;
        }

        // Token is invalid or expired
        console.error("Authentication failed:", error);
        authApi.logout();
        router.push(
          `/${lang}/login?from=${encodeURIComponent(pathname)}&error=session_expired`,
        );
      } finally {
        setIsValidating(false);
      }
    };

    validateAuth();
  }, [router, lang, pathname]);

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
