"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  UsersRound,
  Eye,
  EyeOff,
  CheckCheck,
  ShieldCheck,
  Zap,
  Bot,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/dashboard";
    window.location.href = destination;
  };

  return (
    <div className="relative min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-background">
      {/* LEFT: Kommo-Style Full-Page Showcase Panel (Desktop) */}
      <div className="relative hidden lg:flex lg:col-span-7 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#090E17] via-[#0E1726] to-[#070B12] p-8 lg:p-12 xl:p-16 text-white border-r border-border/40">
        {/* Ambient atmospheric glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary/20 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-10 h-96 w-96 rounded-full bg-emerald-500/15 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/3 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/10 blur-[80px]"
        />

        {/* Top Header */}
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <Image
                src="/parbat-logo-white.png"
                alt="Parbat Logo"
                width={170}
                height={36}
                className="h-9 w-auto object-contain"
                priority
              />
              <p className="text-xs font-semibold text-slate-300 mt-1 tracking-wide">
                WhatsApp Sales & Automations
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-400 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>Official WhatsApp Cloud API</span>
            </div>
          </div>

          <div className="mt-12 max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-white xl:text-4xl xl:leading-tight">
              Turn WhatsApp conversations into high-value sales.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 xl:text-base">
              India's messenger-first CRM for scaling customer conversations, 24/7 automations,
              and tracking deal pipelines in real-time.
            </p>
          </div>
        </div>

        {/* Simulated WhatsApp Lead & Live Chat Card (Indian Lead & ₹ Currency) */}
        <div className="relative z-10 my-8 max-w-xl space-y-3.5 rounded-3xl border border-slate-700/60 bg-slate-900/85 p-5 shadow-2xl backdrop-blur-xl">
          {/* Header inside mock */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 font-bold text-slate-950 text-sm shadow-md shadow-emerald-500/20">
                AS
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  Aarav Sharma
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    Lead #1042
                  </span>
                </div>
                <p className="text-xs text-slate-400">WhatsApp Business • In Negotiation</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs sm:text-sm font-bold text-emerald-300 border border-emerald-500/40 shadow-sm">
              ₹1,00,00,000 Deal (1 Cr)
            </span>
          </div>

          {/* Incoming message from customer */}
          <div className="flex flex-col items-start gap-1">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-slate-800/90 px-4 py-2.5 text-xs sm:text-sm text-slate-100 shadow-sm leading-relaxed">
              Namaste! We want to integrate WhatsApp CRM for our enterprise sales team in Mumbai. Our deal pipeline estimate is ₹1 Crore. Can we schedule an onboarding session?
            </div>
            <span className="flex items-center gap-1 text-[10px] text-slate-500 pl-1">
              10:42 AM
            </span>
          </div>

          {/* Automated bot chip */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/90 border border-slate-700/80 px-3.5 py-1 text-[11px] text-slate-300 shadow-inner">
              <Bot className="h-3.5 w-3.5 text-emerald-400" />
              <span>Auto-routed to Enterprise Mumbai Sales Pipeline • Bot triggered</span>
            </div>
          </div>

          {/* Outgoing team reply */}
          <div className="flex flex-col items-end gap-1">
            <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm text-white shadow-md shadow-emerald-900/20 leading-relaxed">
              Hello Aarav! We have reserved your executive demo slot for 3:00 PM today. Our enterprise team will walk you through the ₹1 Cr deployment.
            </div>
            <span className="flex items-center gap-1 text-[10px] text-slate-400 pr-1">
              10:42 AM <CheckCheck className="h-3 w-3 text-emerald-400" />
            </span>
          </div>

          {/* Deal Stage Footer */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs sm:text-sm text-slate-400">
            <span>Stage: <strong className="text-slate-200">Enterprise High-Intent Lead</strong></span>
            <span>Value: <strong className="text-emerald-400 font-bold text-sm sm:text-base">₹1,00,00,000 (1 Crore INR)</strong></span>
          </div>
        </div>

        {/* Feature Highlights Footer - Prominent Large Stat Cards */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 xl:gap-5 border-t border-slate-800/80 pt-6">
          {/* Card 1: 2.4x Faster */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/75 p-4 xl:p-5 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-0.5">
            <div className="flex h-11 w-11 xl:h-12 xl:w-12 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-md shadow-primary/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl xl:text-2xl font-extrabold tracking-tight text-white">2.4x Faster</p>
              <p className="text-xs xl:text-sm font-semibold text-slate-300 mt-1">Lead response rate</p>
            </div>
          </div>

          {/* Card 2: 24/7 Smart Bot */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/75 p-4 xl:p-5 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-0.5">
            <div className="flex h-11 w-11 xl:h-12 xl:w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shadow-md shadow-emerald-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl xl:text-2xl font-extrabold tracking-tight text-white">24/7 Smart Bot</p>
              <p className="text-xs xl:text-sm font-semibold text-slate-300 mt-1">Auto-reply flows</p>
            </div>
          </div>

          {/* Card 3: Meta Cloud API */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/75 p-4 xl:p-5 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-0.5">
            <div className="flex h-11 w-11 xl:h-12 xl:w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 shadow-md shadow-blue-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xl xl:text-2xl font-extrabold tracking-tight text-white">Meta Cloud API</p>
              <p className="text-xs xl:text-sm font-semibold text-slate-300 mt-1">Secure & Scalable</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Login Form (Full-Page Half on Desktop) */}
      <div className="flex flex-col justify-between lg:col-span-5 min-h-screen p-6 sm:p-10 lg:p-12 xl:p-16 bg-card/95 lg:bg-background/90 backdrop-blur-xl">
        {/* Mobile Header (visible only on mobile/tablet) */}
        <div className="flex items-center justify-between lg:hidden mb-6 pb-4 border-b border-border/50">
          <div className="flex flex-col">
            <Image
              src="/parbat-logo.png"
              alt="Parbat Logo"
              width={130}
              height={28}
              className="h-7 w-auto object-contain dark:hidden"
            />
            <Image
              src="/parbat-logo-white.png"
              alt="Parbat Logo"
              width={130}
              height={28}
              className="h-7 w-auto object-contain hidden dark:block"
            />
            <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">
              WhatsApp Sales & Automations
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
            WhatsApp API
          </span>
        </div>

        <div className="my-auto mx-auto w-full max-w-sm">
          {/* Header */}
          <div className="mb-6">
            <div className="mb-4">
              <Image
                src="/parbat-logo.png"
                alt="Parbat Logo"
                width={160}
                height={34}
                className="h-8 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                src="/parbat-logo-white.png"
                alt="Parbat Logo"
                width={160}
                height={34}
                className="h-8 w-auto object-contain hidden dark:block"
                priority
              />
              <p className="text-xs font-semibold text-primary mt-1.5 tracking-wide">
                WhatsApp Sales & Automations
              </p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {inviteToken ? t("titleAccept") : t("titleWelcome")}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {inviteToken ? t("descAccept") : t("descWelcome")}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-in fade-in-50">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                {t("emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl border-border bg-muted/40 px-3.5 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                  {t("passwordLabel")}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:text-primary-hover hover:underline transition-colors"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl border-border bg-muted/40 pl-3.5 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-3 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("signingIn")}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {t("signIn")}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <span>{t("noAccount")} </span>
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="font-semibold text-primary hover:text-primary-hover hover:underline transition-colors"
            >
              {t("createAccount")}
            </Link>
          </div>
        </div>

        {/* Security reassurance footer */}
        <div className="mt-8 flex items-center justify-center gap-1.5 border-t border-border/50 pt-4 text-[11px] text-muted-foreground/80">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Secured with Supabase Auth • Indian Cloud Infrastructure</span>
        </div>
      </div>
    </div>
  );
}
