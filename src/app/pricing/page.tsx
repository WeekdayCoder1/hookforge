"use client";

import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize
  useEffect(() => {
    setMounted(true);

    // Check for success/cancelled in URL
    if (searchParams.get("success") === "true") {
      setSuccessMessage("You're now Pro 🎉");
    } else if (searchParams.get("cancelled") === "true") {
      setErrorMessage("Checkout cancelled");
    }

    const bootstrap = async (sessionUser: { id: string; email?: string } | null) => {
      if (!sessionUser) return;

      const { data: existingUser } = await supabase
        .from("users")
        .select("plan")
        .eq("id", sessionUser.id)
        .single();

      if (existingUser) {
        setPlan(existingUser.plan ?? "free");
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      bootstrap(sessionUser);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        bootstrap(sessionUser);
      }
    );

    // Dark mode
    const stored = localStorage.getItem("theme");
    if (
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }

    // Auto-dismiss messages
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
        window.history.replaceState({}, "", "/pricing");
      }, 5000);
      return () => clearTimeout(timer);
    }

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [searchParams, successMessage, errorMessage]);

  const handleUpgrade = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Please login first.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/lemonsqueezy/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data?.error?.message || data?.error || "Something went wrong";
        alert(message);
        setLoading(false);
        return;
      }

      const checkoutUrl = data?.data?.checkout_url || data?.checkout_url;
      if (!checkoutUrl) {
        alert("No checkout URL received. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = checkoutUrl;
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Checkout failed. Please try again.");
      setLoading(false);
    }
  };

  const handleDowngrade = () => {
    alert("Downgrade feature coming soon. Contact support for help.");
  };

  if (!mounted) return null;

  return (
    <div
      className={`min-h-screen ${
        darkMode ? "dark dark-gradient-bg" : "light-gradient-bg"
      }`}
    >
      {/* Navigation Bar */}
      <div className="sticky top-0 z-20 glass border-b border-gray-200/60 dark:border-white/5">
        <div className="px-5 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-300/40 dark:shadow-violet-900/40">
              <img 
                src="logo.png" 
                alt="HookForge" 
                className="w-5 h-5 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <span className="text-sm font-extrabold text-gray-900 dark:text-white">
              HookForge
            </span>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/40 animate-fade-in">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-red-500 text-white font-semibold shadow-lg shadow-red-500/40 animate-fade-in">
          {errorMessage}
        </div>
      )}

      {/* Main Content */}
      <div className="px-5 md:px-10 py-16 max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
            Start free. Upgrade when you&apos;re ready to grow.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="glass rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-black/40 p-8 border border-gray-200/60 dark:border-white/5 hover:shadow-2xl transition-all duration-300 flex flex-col">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Free
              </h3>
              <p className="text-gray-600 dark:text-slate-400 text-sm">
                Perfect for getting started
              </p>
            </div>

            <div className="mb-8">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                $0
              </span>
              <span className="text-gray-600 dark:text-slate-400 text-sm ml-2">
                / month
              </span>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-8 flex-1">
              {[
                "30 credits/month",
                "3-day hook history",
                "Watermark on copy",
                "Standard generation speed",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3 h-3 text-violet-600 dark:text-violet-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700 dark:text-slate-300">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            {/* Button */}
            <button
              disabled={plan === "free"}
              onClick={plan === "free" ? undefined : handleDowngrade}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                plan === "free"
                  ? "bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-slate-500 cursor-not-allowed"
                  : "bg-white/60 dark:bg-white/10 text-gray-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/20 border border-gray-200 dark:border-white/10"
              }`}
            >
              {plan === "free" ? "Current Plan" : "Downgrade to Free"}
            </button>
          </div>

          {/* Pro Plan */}
          <div className="glass rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-black/40 p-8 border-2 border-violet-600/60 dark:border-violet-500/40 hover:shadow-2xl transition-all duration-300 flex flex-col relative scale-105 md:scale-100 origin-center md:origin-auto">
            {/* Pro Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="inline-block px-4 py-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-500 text-white text-xs font-bold shadow-lg shadow-violet-300/40">
                ⏰ Early Creator Pricing
              </span>
            </div>

            {/* Glow effect for dark mode */}
            <div className="absolute inset-0 rounded-2xl opacity-0 dark:opacity-30 bg-gradient-to-br from-violet-600/20 to-purple-500/20 blur-xl pointer-events-none" />

            <div className="mb-6 relative z-10">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Pro
              </h3>
              <p className="text-gray-600 dark:text-slate-400 text-sm">
                For serious creators
              </p>
            </div>

            <div className="mb-8 relative z-10">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-semibold text-gray-400 dark:text-slate-500 line-through">
                  $10
                </span>
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                  $5
                </span>
              </div>
              <span className="text-gray-600 dark:text-slate-400 text-sm ml-2">
                / month
              </span>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-8 flex-1 relative z-10">
              {[
                "300 credits/month",
                "No ads",
                "Unlimited history",
                "Faster generation",
                "No watermark on copy",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-violet-600/20 dark:bg-violet-500/20 flex items-center justify-center shrink-0">
                    <svg
                      className="w-3 h-3 text-violet-600 dark:text-violet-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            {/* Button */}
            <button
              disabled={plan === "pro" || loading}
              onClick={handleUpgrade}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 relative z-10 ${
                plan === "pro"
                  ? "bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-slate-500 cursor-not-allowed"
                  : loading
                  ? "bg-gradient-to-r from-violet-600 to-purple-500 text-white opacity-80 cursor-wait"
                  : "bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 text-white shadow-lg shadow-violet-300/40 dark:shadow-violet-900/40 hover:scale-105 active:scale-95"
              }`}
            >
              {loading
                ? "Redirecting..."
                : plan === "pro"
                ? "Current Plan"
                : "Upgrade to Pro"}
            </button>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            All plans include 24/7 support · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}