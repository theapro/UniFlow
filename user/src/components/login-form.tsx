"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle, 
  Loader2, 
  KeyRound, 
  Mail, 
  ArrowRight, 
  ShieldCheck 
} from "lucide-react";
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
    <div className={cn("relative w-full max-w-[440px] px-6 animate-in fade-in zoom-in duration-700", className)} {...props}>
      <div className="rounded-[35px] border border-white/[0.06] bg-zinc-900/40 backdrop-blur-2xl p-8 md:p-10 shadow-xl">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white/90">Uniflow Chat</h1>
          <p className="text-[11px] text-muted-foreground/40 uppercase tracking-[0.3em] mt-2 font-semibold">
          </p>
        </div>

        <form 
          onSubmit={method === "password" ? handleEmailLogin : verifyLoginCode} 
          className="space-y-6"
        >
          <div className="space-y-4">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-widest ml-1 text-muted-foreground/50">
                Institutional Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-12 rounded-2xl bg-white/[0.02] border-white/5 focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm text-white placeholder:text-white/10"
                  required
                />
              </div>
            </div>

            {/* Password or Code Field */}
            {method === "password" ? (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    Security Key
                  </Label>
                  <button type="button" className="text-[10px] font-bold uppercase tracking-widest text-primary/40 hover:text-primary transition-colors">
                    Recovery
                  </button>
                </div>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-12 rounded-2xl bg-white/[0.02] border-white/5 focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm text-white"
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="code" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    One-Time Code
                  </Label>
                  <button
                    type="button"
                    onClick={requestLoginCode}
                    disabled={!email || codeLoading}
                    className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors disabled:opacity-30"
                  >
                    {codeRequested ? "Resend" : "Send Code"}
                  </button>
                </div>
                <div className="relative group">
                  <ShieldCheck className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground/20 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="code"
                    inputMode="numeric"
                    placeholder="······"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-12 pl-12 rounded-2xl bg-white/[0.02] border-white/5 focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm text-white font-mono tracking-widest"
                    required
                    disabled={!codeRequested}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          {(error || info) && (
            <div className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 animate-in slide-in-from-top-1",
              error ? "bg-red-500/5 border-red-500/10 text-red-500/70" : "bg-primary/5 border-primary/10 text-primary/70"
            )}>
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold leading-tight uppercase tracking-tight">
                {error || info}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/10 transition-all active:scale-[0.98] border-t border-white/20"
              disabled={loading || (method === "code" && !codeRequested)}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {method === "password" ? "Authorize Access" : "Verify Identity"}
                  <ArrowRight size={14} className="opacity-50" />
                </span>
              )}
            </Button>

            <button
              type="button"
              className="w-full text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30 hover:text-primary transition-colors"
              onClick={toggleMethod}
            >
              {method === "password" ? "Use Code for Login" : "Return to Password"}
            </button>
          </div>
        </form>

        <div className="mt-8 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="bg-white/5" />
            </div>
            <div className="relative flex justify-center text-[9px] uppercase tracking-[0.3em]">
              <span className="bg-[#0e0e10] rounded-full px-4 text-muted-foreground/30 font-bold backdrop-blur-sm">
                SSO Options
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => loginWithGoogle()}
            disabled={!googleClientId || googleLoading || loading}
            className="w-full h-12 rounded-2xl border-white/5 bg-white/[0.03] hover:bg-white/[0.08] text-[10px] font-bold uppercase tracking-widest transition-all text-white/70 hover:text-white"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FcGoogle className="mr-3 h-5 w-5" />
            )}
            Continue with Google
          </Button>
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-[10px] font-bold text-muted-foreground/20 uppercase tracking-[0.2em]">
          Encrypted Protocol v2.4.0
        </p>
      </div>
    </div>
  );
}