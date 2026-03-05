"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
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

  const toggleMethod = () => {
    setError("");
    setInfo("");
    setPassword("");
    setCode("");
    setCodeRequested(false);
    setMethod((m) => (m === "password" ? "code" : "password"));
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.message || "Login failed");
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

  const requestLoginCode = async () => {
    setError("");
    setInfo("");
    setCode("");
    setCodeLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login-code/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
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
      const res = await fetch(`${API_URL}/api/auth/login-code/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
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

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError("");
      setInfo("");
      setGoogleLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: tokenResponse.access_token }),
        });
        const json = await res.json();
        if (!res.ok || !json?.success) {
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
    },
    onError: () => setError("Google login failed"),
  });

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <form
            onSubmit={
              method === "password" ? handleEmailLogin : verifyLoginCode
            }
            className="p-6 md:p-8"
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-balance text-muted-foreground">
                  {method === "password"
                    ? "Login to your account"
                    : "Use a one-time code sent to your email"}
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
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
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                      <a
                        href="#"
                        onClick={(e) => e.preventDefault()}
                        className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Forgot your password?
                      </a>
                    </div>
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
                  <div className="grid gap-2">
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
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {info && !error && (
                <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground text-center">
                  {info}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                    onClick={toggleMethod}
                  >
                    {method === "password"
                      ? "Login with code instead"
                      : "Login with password instead"}
                  </Button>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || (method === "code" && !codeRequested)}
                >
                  {loading
                    ? "Loading..."
                    : method === "password"
                      ? "Login"
                      : "Verify & login"}
                </Button>
              </div>

              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Button variant="outline" className="w-full" disabled>
                  <span className="text-base"></span>
                  <span className="sr-only">Login with Apple</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  type="button"
                  onClick={() => loginWithGoogle()}
                  disabled={!googleClientId || googleLoading}
                >
                  <FcGoogle
                    className={cn(
                      "h-5 w-5",
                      googleLoading ? "animate-spin" : "",
                    )}
                  />
                  <span className="sr-only">Login with Google</span>
                </Button>
                <Button variant="outline" className="w-full" disabled>
                  <span className="text-base font-semibold">∞</span>
                  <span className="sr-only">Login with Meta</span>
                </Button>
              </div>

              <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <a href="/signup" className="underline underline-offset-4">
                  Sign up
                </a>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  );
}
