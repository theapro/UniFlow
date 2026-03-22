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
import { AlertCircle, ShieldCheck, Mail, Lock, Zap, Loader2, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

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
        headers: { "Content-Type": "application/json" },
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
    <div className="relative flex min-h-screen items-center justify-center bg-[#030711] overflow-hidden p-4">
      {/* Background Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />

      <div className="relative w-full max-w-[440px] space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <Zap className="h-7 w-7 text-primary-foreground fill-primary-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white">
            Uni<span className="text-primary">Flow</span>
          </h1>
          <p className="text-sm text-muted-foreground/60 font-medium uppercase tracking-[0.2em]">
            Academic OS
          </p>
        </div>

        <Card className="rounded-[40px] border-border/40 bg-muted/10 backdrop-blur-2xl shadow-2xl overflow-hidden border">
          <CardHeader className="pt-10 pb-6 px-10 space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-white/90">
              Welcome back
            </CardTitle>
            <CardDescription className="text-muted-foreground/50 font-medium">
              {method === "password"
                ? "Sign in to access your dashboard"
                : "Enter the verification code sent to your email"}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-10 pb-10 space-y-6">
            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-3">
               <div
                  ref={googleBtnRef}
                  className={cn(
                    "h-12 flex items-center justify-center rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer overflow-hidden",
                    googleLoading && "pointer-events-none opacity-50"
                  )}
                >
                  {googleClientId ? (
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={() => setError("Google login failed")}
                      theme="outline"
                      size="large"
                      type="icon"
                      shape="circle"
                      width={googleWidth}
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">G-Cloud</span>
                  )}
                </div>
                <Button variant="outline" className="h-12 rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 text-white/40" disabled>
                   <span className="text-xs font-bold uppercase tracking-widest">SSO</span>
                </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="bg-white/5" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em]">
                <span className="bg-transparent px-4 text-muted-foreground/40 font-bold backdrop-blur-md">
                  Secure Entry
                </span>
              </div>
            </div>

            <form
              onSubmit={method === "password" ? handleEmailLogin : verifyLoginCode}
              className="space-y-5"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 ml-1">
                    Work Email
                  </Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@university.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 rounded-2xl border-white/10 bg-white/5 pl-12 focus:ring-primary/20 transition-all text-white placeholder:text-white/10"
                      required
                    />
                  </div>
                </div>

                {method === "password" ? (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between ml-1">
                      <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        Security Key
                      </Label>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 rounded-2xl border-white/10 bg-white/5 pl-12 focus:ring-primary/20 transition-all text-white placeholder:text-white/10"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between ml-1">
                      <Label htmlFor="code" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        One-Time Passcode
                      </Label>
                      <button
                        type="button"
                        onClick={requestLoginCode}
                        disabled={!email || codeLoading}
                        className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors disabled:opacity-40"
                      >
                        {codeRequested ? "Resend OTP" : "Send OTP"}
                      </button>
                    </div>
                    <div className="relative group">
                      <ShieldCheck className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="code"
                        inputMode="numeric"
                        placeholder="000 000"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="h-12 rounded-2xl border-white/10 bg-white/5 pl-12 focus:ring-primary/20 transition-all text-white tracking-[0.5em] placeholder:text-white/10 font-mono"
                        required
                        disabled={!codeRequested}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status Messages */}
              {(error || info) && (
                <div className={cn(
                  "rounded-2xl p-4 text-xs font-medium flex items-start gap-3 animate-in fade-in duration-300",
                  error ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-primary/10 text-primary border border-primary/20"
                )}>
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error || info}</span>
                </div>
              )}

              <Button 
                type="submit" 
                className="group relative w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold uppercase tracking-widest overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all"
                disabled={loading || (method === "code" && !codeRequested)}
              >
                {loading || googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    {method === "password" ? "Authorize" : "Verify Session"}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </Button>

              <button
                type="button"
                className="w-full text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 hover:text-white/60 transition-colors pt-2"
                onClick={() => {
                   setError("");
                   setInfo("");
                   setMethod(m => m === "password" ? "code" : "password");
                }}
              >
                {method === "password" ? "Switch to Magic Link" : "Back to Password Login"}
              </button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/30 font-medium tracking-tight">
          Protected by AES-256 Encryption & OAuth 2.0 Protocol
        </p>
      </div>
    </div>
  );
}