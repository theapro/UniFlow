"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";
import { auth } from "@/lib/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [method, setMethod] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const from = useMemo(() => {
    const raw = searchParams.get("from");
    return raw && raw.startsWith("/") ? raw : "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError === "session_expired") {
      setError("Your session has expired. Please log in again.");
    } else if (urlError === "unauthorized") {
      setError("You are not authorized to access that page.");
    }
  }, [searchParams]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const json = await response.json();
      if (!response.ok || !json?.success) {
        setError(json?.message || "Login failed");
        return;
      }

      auth.storeAuth(json.data.token, json.data.user);
      router.push(from);
    } catch (err: any) {
      setError(err?.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  const requestLoginCode = async () => {
    setError("");
    setInfo("");
    setCode("");
    setCodeLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login-code/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const json = await response.json();
      if (!response.ok || !json?.success) {
        setError(json?.message || "Failed to send code");
        return;
      }

      setCodeRequested(true);
      setInfo("Code sent to your email.");
    } catch (err: any) {
      setError(err?.message || "Failed to send code");
    } finally {
      setCodeLoading(false);
    }
  };

  const verifyLoginCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login-code/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const json = await response.json();
      if (!response.ok || !json?.success) {
        setError(json?.message || "Invalid or expired code");
        return;
      }

      auth.storeAuth(json.data.token, json.data.user);
      router.push(from);
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    const idToken = credentialResponse?.credential;
    if (!idToken) {
      setError("Google login failed: missing credential");
      return;
    }

    setError("");
    setGoogleLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const json = await response.json();
      if (!response.ok || !json?.success) {
        setError(json?.message || "Google login failed");
        return;
      }

      auth.storeAuth(json.data.token, json.data.user);
      router.push(from);
    } catch (err: any) {
      setError(err?.message || "Google login failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const toggleMethod = () => {
    setError("");
    setInfo("");
    setPassword("");
    setCode("");
    setCodeRequested(false);
    setMethod((m) => (m === "password" ? "code" : "password"));
  };

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const [googleWidth, setGoogleWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = googleBtnRef.current;
    if (!el) return;

    const measure = () => {
      const w = el.clientWidth;
      if (w && w > 0) setGoogleWidth(w);
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">UniFlow</h1>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Sign in</CardTitle>
            <CardDescription className="text-center">
              {method === "password"
                ? "Use your email and password"
                : "Use a one-time code sent to your email"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                  onClick={toggleMethod}
                >
                  {method === "password"
                    ? "Login with code instead"
                    : "Login with password instead"}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled
                  aria-label="Continue with GitHub"
                >
                  <span className="text-lg font-semibold">⌁</span>
                </Button>

                <div
                  ref={googleBtnRef}
                  className={
                    "h-11 flex items-center justify-center rounded-md border bg-background " +
                    (googleLoading ? "pointer-events-none opacity-70" : "")
                  }
                >
                  {googleClientId ? (
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError("Google login failed")}
                      theme="outline"
                      size="large"
                      type="icon"
                      shape="rectangular"
                      width={googleWidth}
                      logo_alignment="center"
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">G</span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled
                  aria-label="Continue with Apple"
                >
                  <span className="text-lg"></span>
                </Button>
              </div>

              {googleLoading && (
                <div className="text-center text-xs text-muted-foreground">
                  Signing in...
                </div>
              )}

              <form
                onSubmit={
                  method === "password" ? handleEmailLogin : verifyLoginCode
                }
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {method === "password" ? (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="code">Code</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-sm"
                        onClick={requestLoginCode}
                        disabled={!email || codeLoading}
                      >
                        {codeRequested ? "Resend code" : "Send code"}
                      </Button>
                    </div>
                    <Input
                      id="code"
                      inputMode="numeric"
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                      disabled={!codeRequested}
                    />
                    {!codeRequested && (
                      <div className="text-xs text-muted-foreground">
                        Click &quot;Send code&quot; to receive a one-time code.
                      </div>
                    )}
                  </div>
                )}

                {info && !error && (
                  <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    {info}
                  </div>
                )}

                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {method === "password" ? (
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Loading..." : "Login"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || !codeRequested}
                  >
                    {loading ? "Loading..." : "Verify & login"}
                  </Button>
                )}
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
