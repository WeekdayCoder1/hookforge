"use client";

import { supabase } from "@/lib/supabase";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

export default function Home() {
  // ─── Router ───────────────────────────────────────────────────────────────────
  const router = useRouter();

  // ─── State ───────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("Motivation");
  const [tone, setTone] = useState("Bold");
  const [hooks, setHooks] = useState<string[]>([]);
  const [creditsRemaining, setCreditsRemaining] = useState<number>(0);
  const [creditsTotal, setCreditsTotal] = useState<number>(30);
  const [plan, setPlan] = useState<string>("free");
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState("Youtube");
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState<number | null>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [history, setHistory] = useState<{ id: string; topic: string; platform: string; hooks: string; created_at: string }[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNicheToneModal, setShowNicheToneModal] = useState(false);
  const [generatedPlatform, setGeneratedPlatform] = useState<string | null>(null);
  const [nicheToneTab, setNicheToneTab] = useState<"niche" | "tone">("niche");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [hookOfTheDay, setHookOfTheDay] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const loginEmailRef = useRef<HTMLInputElement>(null);

  // ─── Dark mode initialization ─────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // ─── Auth + user-row bootstrap ───────────────────────────────────────────
  useEffect(() => {
    setMounted(true);

    // Capture referral param from URL into localStorage
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refId = urlParams.get("ref");
      if (refId) {
        localStorage.setItem("hookforge_referrer", refId);
      }
    } catch { /* ignore */ }

    // Fetch Hook of the Day
    fetch("/api/hook-of-the-day")
      .then((res) => res.json())
      .then((data) => {
        if (data?.hook) setHookOfTheDay(data.hook);
      })
      .catch(() => { /* silent */ });

    const bootstrap = async (sessionUser: { id: string; email?: string } | null) => {
      if (!sessionUser) return;

      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", sessionUser.id)
        .single();

      if (!existingUser) {
        // New user: create with default free credits
        await supabase.from("users").insert({
          id: sessionUser.id,
          email: sessionUser.email,
          plan: "free",
          is_pro: false,
          credits_remaining: 30,
          credits_total: 30,
          last_credit_reset: new Date().toISOString(),
        });
        setCreditsRemaining(30);
        setCreditsTotal(30);
        setPlan("free");

        // Process referral if there's a stored referrer
        try {
          const storedReferrer = localStorage.getItem("hookforge_referrer");
          if (storedReferrer && storedReferrer !== sessionUser.id) {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (token) {
              await fetch("/api/referral", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  referrerId: storedReferrer,
                  newUserId: sessionUser.id,
                }),
              });
            }
            localStorage.removeItem("hookforge_referrer");
          }
        } catch { /* silent */ }
      } else {
        // Existing user: fetch current credits
        const creditsRemaining = existingUser.credits_remaining ?? 30;
        const creditsTotal = existingUser.credits_total ?? 30;
        setCreditsRemaining(creditsRemaining);
        setCreditsTotal(creditsTotal);
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

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ─── Load hook history ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    const loadHistory = async () => {
      const { data } = await supabase
        .from("generated_hooks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setHistory(data);
    };
    loadHistory();
  }, [user]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const openLoginModal = () => {
    setLoginEmail("");
    setLoginSuccess(false);
    setShowLoginModal(true);
    // Focus input on next tick after modal mounts
    setTimeout(() => loginEmailRef.current?.focus(), 50);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setLoginEmail("");
    setLoginSuccess(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    setLoginLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: loginEmail.trim() });
    setLoginLoading(false);
    if (error) {
      // Show error inline — keep modal open
      alert(error.message);
    } else {
      setLoginSuccess(true);
      setTimeout(() => closeLoginModal(), 3000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCreditsRemaining(0);
    setCreditsTotal(30);
    setPlan("free");
  };

  const handleCopy = (text: string, index: number) => {
    // Free users get watermark appended
    const copyText = plan === "pro" ? text : `${text}\n— Hookforge AI`;
    navigator.clipboard.writeText(copyText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleNewHook = () => {
    setTopic("");
    setHooks([]);
    setSidebarOpen(false);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleHistoryClick = (item: { topic: string; hooks: string; platform?: string }) => {
    setTopic(item.topic);
    // Parse hooks from JSON string if it's a string
    const parsedHooks = typeof item.hooks === 'string' && item.hooks.startsWith('[') 
      ? JSON.parse(item.hooks)
      : item.hooks.split("\n").filter(Boolean);
    setHooks(parsedHooks);
    if (item.platform) {
      setPlatform(item.platform);
      setGeneratedPlatform(item.platform);
    }
    setSidebarOpen(false);
    setTimeout(() => {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (creditsRemaining < 3) {
      alert(`Not enough credits. You need 3 credits but only have ${creditsRemaining}.`);
      return;
    }

    try {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Get auth token if user is logged in
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (user) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ topic, niche, tone, platform }),
      });

      const data = await response.json();

      // Handle insufficient credits error
      if (response.status === 403) {
        setHooks([data.error || "Not enough credits. Upgrade to Pro for more credits."]);
        setLoading(false);
        return;
      }

      // Handle other errors
      if (!response.ok) {
        setHooks([data.error || "Something went wrong. Please try again."]);
        setLoading(false);
        return;
      }

      const payload = data?.data ?? data;
if (payload?.hooks && Array.isArray(payload.hooks)) {
  const generatedHooks = payload.hooks;
  setHooks(generatedHooks);
  setGeneratedPlatform(platform);
  if (typeof payload.credits_remaining === "number") {
    setCreditsRemaining(payload.credits_remaining);
  }

        if (user) {
          // Sync credits from server response
          if (typeof data.credits_remaining === "number") {
            setCreditsRemaining(data.credits_remaining);
          }

          // Reload history from generated_hooks
          const { data: historyData } = await supabase
            .from("generated_hooks")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
          if (historyData) setHistory(historyData);
        }
      } else {
        setHooks(["Something went wrong. Please try again."]);
      }
    } catch {
      setHooks(["Error generating hooks. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (creditsRemaining < 1) {
      alert("Not enough credits. You need 1 credit to regenerate.");
      return;
    }
    try {
      setRegenerateLoading(true);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (user) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers,
        body: JSON.stringify({ topic, niche, tone, platform }),
      });
      const data = await response.json();
      const payload = data?.data ?? data;
if (response.ok && payload?.hooks) {
  setHooks(payload.hooks);
  if (typeof payload.credits_remaining === "number") {
    setCreditsRemaining(payload.credits_remaining);
  }
      }
    } catch {
      // silent fail
    } finally {
      setRegenerateLoading(false);
    }
  };

  // Viral score heuristic (70-100)
  const getViralScore = (hook: string): number => {
    let score = 70;
    const words = hook.toLowerCase().split(/\s+/);
    // Numbers boost
    if (/\d/.test(hook)) score += 5;
    // Curiosity words
    const curiosityWords = ["secret", "hidden", "truth", "why", "how", "never", "always", "stop", "nobody", "everyone", "mistake"];
    if (curiosityWords.some(w => words.includes(w))) score += 8;
    // Power verbs
    const powerVerbs = ["destroy", "crush", "dominate", "explode", "transform", "hack", "unlock", "master", "kill", "expose"];
    if (powerVerbs.some(w => words.includes(w))) score += 7;
    // Short hooks score higher (under 8 words)
    if (words.length <= 8) score += 5;
    if (words.length <= 5) score += 3;
    // Cap at 100
    return Math.min(100, score + Math.floor(Math.random() * 6));
  };

  // Share handler
  const handleShare = (hook: string, target: "x" | "linkedin" | "copy") => {
    const shareText = `\uD83D\uDD25 Viral Hook Idea\n\n${hook}\n\nGenerated with Hookforge\nhttps://tryhookforge.com`;
    if (target === "x") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank");
    } else if (target === "linkedin") {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://tryhookforge.com")}&summary=${encodeURIComponent(shareText)}`, "_blank");
    } else {
      navigator.clipboard.writeText(shareText);
    }
    setShowShareMenu(null);
  };

  const creditProgressPct = (creditsRemaining / creditsTotal) * 100;
  const hasEnoughCredits = creditsRemaining >= 3;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className={`flex h-screen smooth-transition overflow-hidden ${
        darkMode ? "dark dark-gradient-bg" : "light-gradient-bg"
      }`}
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease" }}
    >
      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ════════════════════ LOGIN MODAL ════════════════════ */}
      {showLoginModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLoginModal();
          }}
        >
          <div
            className={`
              relative w-full max-w-md
              bg-white dark:bg-slate-900
              border border-gray-200/80 dark:border-slate-700/60
              rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60
              p-8
              transform transition-all duration-300 ease-in-out
              ${showLoginModal ? "opacity-100 scale-100" : "opacity-0 scale-95"}
            `}
          >
            {/* Close X */}
            <button
              onClick={closeLoginModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-200"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {loginSuccess ? (
              /* ── Success State ── */
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Magic link sent!
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                  Check your inbox at{" "}
                  <span className="font-semibold text-violet-600 dark:text-violet-400">
                    {loginEmail}
                  </span>{" "}
                  and click the link to sign in.
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
                  This modal will close automatically…
                </p>
              </div>
            ) : (
              /* ── Form State ── */
              <>
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-300/40 dark:shadow-violet-900/40 mb-5">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>

                {/* Title */}
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">
                  Sign in to HookForge
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                  Enter your email to receive a magic login link.
                </p>

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Email input */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Email address
                    </label>
                    <input
                      ref={loginEmailRef}
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/60 focus:border-violet-400 dark:focus:border-violet-500 transition-all duration-200"
                    />
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loginLoading || !loginEmail.trim()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-violet-300/30 dark:shadow-violet-900/30 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                  >
                    {loginLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Sending link…
                      </span>
                    ) : (
                      "Send Magic Link →"
                    )}
                  </button>

                  {/* Cancel */}
                  <button
                    type="button"
                    onClick={closeLoginModal}
                    className="w-full py-2 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 font-medium transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ SIDEBAR ════════════════════ */}
      <aside
        className={`
          fixed md:static z-40 top-0 left-0 h-full
          glass-sidebar
          flex flex-col
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${sidebarCollapsed ? "md:w-20" : "md:w-64"}
          w-72 shrink-0
        `}
      >
        {/* ── Logo + New Hook button ── */}
        <div
          className={`p-5 pb-0 transition-all duration-300 ${
            sidebarCollapsed && !sidebarOpen ? "md:p-3" : ""
          }`}
        >
          {/* Collapse Toggle (desktop only) */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`
              hidden md:flex items-center justify-center
              w-8 h-8 rounded-lg
              text-gray-500 dark:text-slate-400
              hover:bg-gray-100 dark:hover:bg-white/10
              transition-all duration-200
              mb-3
              ${sidebarCollapsed ? "w-full justify-center" : ""}
            `}
            title={sidebarCollapsed ? "Expand" : "Collapse"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>

          {/* Logo */}
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 mb-5 animate-fade-in">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-300/40 dark:shadow-violet-900/40 shrink-0 overflow-hidden">
                <img
                  src="logo.png"
                  alt="HookForge"
                  className="w-5 h-5 object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              </div>
              <span className="text-lg font-extrabold text-gray-900 dark:text-white">
                HookForge
              </span>
            </div>
          )}

          {/* New Hook button */}
          {sidebarCollapsed ? (
            <button
              onClick={handleNewHook}
              className="w-full flex items-center justify-center py-2.5 px-0 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white font-semibold shadow-md shadow-violet-300/40 dark:shadow-violet-900/30 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 group relative"
              title="New Hook"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {/* Tooltip */}
              <div className="absolute left-full ml-2 hidden group-hover:flex items-center gap-2 whitespace-nowrap bg-gray-900 dark:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg">
                New Hook
              </div>
            </button>
          ) : (
            <button
              onClick={handleNewHook}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white font-semibold text-sm shadow-md shadow-violet-300/40 dark:shadow-violet-900/30 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 animate-fade-in"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Hook
            </button>
          )}

          {/* Divider */}
          <div className="h-px bg-gray-100 dark:bg-white/5 my-4" />

          {/* History label */}
          {!sidebarCollapsed && (
            <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1 animate-fade-in">
              History
            </p>
          )}
        </div>

        {/* ── Scrollable History ── */}
        <div className="flex-1 overflow-y-auto sidebar-scroll px-5 space-y-1 pb-2">
          {user && history.length > 0 ? (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className={`${sidebarCollapsed ? "w-full flex items-center justify-center p-2 rounded-lg hover:bg-white/10 dark:hover:bg-white/10 transition-all duration-200 group relative text-xs font-medium text-gray-600 dark:text-slate-400 truncate" : "w-full text-left p-3 rounded-xl hover:bg-violet-50 dark:hover:bg-white/5 transition-all duration-200 group"}`}
                title={sidebarCollapsed ? item.topic : undefined}
              >
                {sidebarCollapsed ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm0 2c-1.657 0-3 1.343-3 3v2h6v-2c0-1.657-1.343-3-3-3zm0 6h.01M9 20h6a2 2 0 002-2V8a2 2 0 00-2-2H9a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 hidden group-hover:flex items-center gap-2 whitespace-nowrap bg-gray-900 dark:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg max-w-xs">
                      {item.topic}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors leading-snug">
                      {item.topic}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-full px-2 py-0.5">
                        {item.platform}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">
                        {new Date(item.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </>
                )}
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center px-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
                <svg
                  className="w-5 h-5 text-gray-400 dark:text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              {!sidebarCollapsed && (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {user ? "No hooks yet — generate your first!" : "Sign in to see your history"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className={`transition-all duration-300 ${sidebarCollapsed ? "p-3 space-y-2" : "p-5 pt-0 space-y-3"}`}>
          {/* Divider */}
          <div className={`h-px ${sidebarCollapsed ? "bg-white/5" : "bg-gray-100 dark:bg-white/5"}`} />

          {/* Referral invite */}
          {user && !sidebarCollapsed && (
            <button
              onClick={() => setShowReferralModal(true)}
              className="w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl border border-dashed border-violet-300 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all duration-200 animate-fade-in"
            >
              <span className="text-sm">🎁</span>
              <span className="text-xs font-semibold">Invite a creator → Earn 20 credits</span>
            </button>
          )}

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`${
              sidebarCollapsed
                ? "w-full flex items-center justify-center py-1.5 px-1 rounded-lg hover:bg-white/10 dark:hover:bg-white/10 transition-all duration-200 group relative"
                : "w-full flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200 group"
            }`}
          >
            <span
              className={`text-base transition-transform duration-500 ${darkMode ? "rotate-[360deg]" : "rotate-0"}`}
            >
              {darkMode ? "🌙" : "☀️"}
            </span>
            {!sidebarCollapsed && (
              <>
                <span className="text-sm font-medium text-gray-600 dark:text-slate-400">
                  {darkMode ? "Dark Mode" : "Light Mode"}
                </span>
                {/* Animated toggle switch */}
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                    darkMode ? "bg-violet-600" : "bg-gray-200 dark:bg-slate-700"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                      darkMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
              </>
            )}
            {sidebarCollapsed && (
              <div className="absolute left-full ml-2 hidden group-hover:flex items-center gap-2 whitespace-nowrap bg-gray-900 dark:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg">
                {darkMode ? "Dark Mode" : "Light Mode"}
              </div>
            )}
          </button>

          {/* User section */}
          {mounted && user ? (
            <div className={`${sidebarCollapsed ? "flex items-center justify-center p-2" : "flex items-center gap-2.5 pt-0.5"}`}>
              <div className={`${sidebarCollapsed ? "w-8 h-8" : "w-8 h-8"} rounded-full bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center text-white text-xs font-bold shrink-0 group relative`}>
                {user.email?.[0]?.toUpperCase() ?? "U"}
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-2 hidden group-hover:flex items-center gap-2 whitespace-nowrap bg-gray-900 dark:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg flex-col items-start">
                    <span className="font-medium">{user.email}</span>
                    <span className="text-[10px] text-slate-300 capitalize">{plan} plan</span>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">
                      {user.email}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">
                      {plan} plan
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs font-semibold text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200 shrink-0"
                    title="Logout"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </button>
                </>
              )}
              {sidebarCollapsed && mounted && user && (
                <button
                  onClick={handleLogout}
                  className="absolute left-full ml-2 hidden group-hover:flex items-center justify-center whitespace-nowrap bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg"
                  title="Logout"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              )}
            </div>
          ) : mounted ? (
            <button
              onClick={openLoginModal}
              className={`${
                sidebarCollapsed
                  ? "w-full flex items-center justify-center py-2 px-0 rounded-lg group relative hover:bg-white/10 dark:hover:bg-white/10 transition-all duration-200"
                  : "w-full py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:scale-[1.02] hover:border-violet-300 dark:hover:border-violet-500/40 transition-all duration-300"
              }`}
            >
              {sidebarCollapsed ? (
                <>
                  <svg className="w-4 h-4 text-gray-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3v-1m0-4V7a3 3 0 013-3h4a3 3 0 013 3v4m-3-4h.01" />
                  </svg>
                  <div className="absolute left-full ml-2 hidden group-hover:flex items-center gap-2 whitespace-nowrap bg-gray-900 dark:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg">
                    Sign In
                  </div>
                </>
              ) : (
                "Sign In →"
              )}
            </button>
          ) : null}
        </div>
      </aside>

      {/* ════════════════════ MAIN CONTENT ════════════════════ */}
      <div ref={mainRef} className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* ── Top Bar ── */}
        <div className="sticky top-0 z-20 glass border-b border-gray-200/60 dark:border-white/5">
          <div className="px-5 md:px-10 py-3.5 flex items-center justify-between gap-4">
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Left: Page title (desktop) */}
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                AI Hook Generator
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                Create viral hooks in seconds
              </p>
            </div>

            {/* Right: Upgrade CTA + Plan badge + Usage */}
            <div className="flex items-center gap-3 ml-auto">
              {plan === "free" && (
                <button
                  onClick={() => router.push("/pricing")}
                  className="px-4 py-1.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-700 hover:to-pink-600 shadow-lg shadow-violet-300/30 dark:shadow-violet-900/40 hover:scale-105 active:scale-95 transition-all duration-200 smooth-transition whitespace-nowrap"
                >
                  ✨ Upgrade
                </button>
              )}
              <span
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-all duration-300 ${plan === "pro"
                  ? "bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow shadow-violet-300/30"
                  : "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20"
                  }`}
              >
                {plan === "pro" ? "✦ Pro" : "Free"}
              </span>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider hidden sm:inline">Credits</span>
                <div className="w-28 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500 transition-all duration-500"
                    style={{ width: `${creditProgressPct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                  {creditsRemaining}/{creditsTotal}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-5 md:p-10">
          <div className="max-w-3xl mx-auto">

            {/* Page heading */}
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight mb-2">
                Create Hooks That{" "}
                <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Stop the Scroll
                </span>
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md">
                AI-powered hooks for Shorts, Reels & TikTok — engineered to
                capture attention in the first 3 seconds.
              </p>
            </div>

            {/* ── Hook of the Day ── */}
            {hookOfTheDay && (
              <div className="mb-8 glass rounded-2xl p-6 border border-orange-200/60 dark:border-orange-500/20 shadow-lg shadow-orange-100/40 dark:shadow-orange-900/10 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🔥</span>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">
                    Hook of the Day
                  </span>
                </div>
                <p className="text-base font-semibold text-gray-800 dark:text-slate-200 leading-relaxed mb-4">
                  &ldquo;{hookOfTheDay}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => mainRef.current?.scrollTo({ top: 400, behavior: "smooth" })}
                  className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                >
                  Generate your own hooks →
                </button>
              </div>
            )}

            {/* ── Credits Warning Banner ── */}
            {mounted && !hasEnoughCredits && user && (
              <div className="mb-8 rounded-2xl p-6 bg-gradient-to-br from-violet-600 via-purple-500 to-pink-500 shadow-xl shadow-purple-300/30 dark:shadow-purple-900/40 hover:scale-[1.01] transition-all duration-300 smooth-transition border border-transparent">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-bold text-lg mb-1">
                      Not enough credits 🚀
                    </p>
                    <p className="text-purple-100 text-sm leading-relaxed">
                      You need 3 credits to generate hooks. Upgrade to Pro for 300 credits monthly.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/pricing")}
                    className="shrink-0 bg-white text-violet-700 font-bold text-sm px-5 py-2.5 rounded-xl shadow hover:scale-105 hover:shadow-md transition-all duration-200 whitespace-nowrap"
                  >
                    ✦ Upgrade
                  </button>
                </div>
              </div>
            )}

            {/* ── Generator Card ── */}
            <div className="glass rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-black/40 p-6 md:p-8 transition-all duration-300 hover:shadow-2xl">
              <form onSubmit={handleGenerate} className="space-y-5">
                {/* Topic */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 pl-0.5">
                    Video Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. How I made $10k in 30 days..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={!hasEnoughCredits}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/60 dark:focus:ring-violet-500/60 focus:border-violet-300 dark:focus:border-violet-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                  />
                </div>

                {/* Niche + Tone Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNicheToneModal(true);
                      setNicheToneTab("niche");
                    }}
                    disabled={!hasEnoughCredits}
                    className="relative group px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-gray-700 dark:text-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-400/60 dark:focus:ring-violet-500/60 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm hover:border-violet-300 dark:hover:border-violet-500/30 smooth-transition"
                  >
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      Niche
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white font-semibold">
                      {niche}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNicheToneModal(true);
                      setNicheToneTab("tone");
                    }}
                    disabled={!hasEnoughCredits}
                    className="relative group px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-gray-700 dark:text-slate-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-400/60 dark:focus:ring-violet-500/60 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm hover:border-violet-300 dark:hover:border-violet-500/30 smooth-transition"
                  >
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      Tone
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white font-semibold">
                      {tone}
                    </span>
                  </button>
                </div>

                {/* Platform */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 pl-0.5">
                    Platform
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["Youtube", "Instagram", "TikTok", "Twitter", "LinkedIn"].map(
                      (p) => {
                        const isActive = platform === p;

                        // Base styles for all buttons
                        const baseStyle = "px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95";

                        // Inactive state
                        const inactiveStyle = isActive 
                          ? "" 
                          : "bg-white/60 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-white/10 dark:border-white/20 hover:border-white/30 dark:hover:border-white/30";

                        // Platform-specific active styles
                        const platformActiveStyles: Record<string, string> = {
                          Youtube: "bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/30 scale-105",
                          Instagram: "bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-lg shadow-pink-500/40 scale-105",
                          TikTok: "bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-600 text-white border-cyan-400 shadow-lg shadow-cyan-400/30 scale-105",
                          Twitter: darkMode
                            ? "bg-white text-black border-white shadow-lg shadow-white/20 scale-105"
                            : "bg-black text-white border-black shadow-lg shadow-black/30 scale-105",
                          LinkedIn: "bg-[#0A66C2] text-white border-[#0A66C2] shadow-lg shadow-blue-600/30 scale-105",
                        };

                        const activeStyle = isActive ? platformActiveStyles[p] || "" : "";

                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              if (!hasEnoughCredits) return;
                              // If switching platforms and hooks exist, clear hooks
                              if (hooks.length > 0 && p !== generatedPlatform) {
                                setHooks([]);
                                setGeneratedPlatform(null);
                              }
                              setPlatform(p);
                            }}
                            disabled={!hasEnoughCredits}
                            className={`${baseStyle} ${inactiveStyle} ${activeStyle}`.trim()}
                          >
                            <span className="inline-flex items-center gap-2">
                              {/* Icons */}
                              {p === "Youtube" && (
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.8ZM9.7 15.4V8.6L15.9 12l-6.2 3.4Z" />
                                </svg>
                              )}
                              {p === "Instagram" && (
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm-5 4.3A3.7 3.7 0 1 1 8.3 12 3.7 3.7 0 0 1 12 8.3Zm0 2A1.7 1.7 0 1 0 13.7 12 1.7 1.7 0 0 0 12 10.3ZM18.2 6.8a.9.9 0 1 1-.9.9.9.9 0 0 1 .9-.9Z" />
                                </svg>
                              )}
                              {p === "TikTok" && (
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M14 3v10.1a3.9 3.9 0 1 1-3.1-3.8V7.1A6.9 6.9 0 1 0 16 13V7.2c1.2.9 2.7 1.5 4 1.6V6.1c-2.1-.2-3.9-1.5-4.7-3.1H14Z" />
                                </svg>
                              )}
                              {p === "Twitter" && (
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.7L5.4 22H2.3l7.8-8.9L1 2h6.8l4.7 6.1L18.9 2Zm-1.2 18h1.7L6.2 3.9H4.4L17.7 20Z" />
                                </svg>
                              )}
                              {p === "LinkedIn" && (
                                <svg
                                  className="w-4 h-4"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M6.9 6.6a2 2 0 1 1 0-4.1 2 2 0 0 1 0 4.1ZM5 21.5h3.8V8.7H5v12.8Zm6.2-12.8H15v1.8h.1c.5-1 1.9-2.1 3.9-2.1 4.2 0 5 2.7 5 6.2v6.9h-3.8v-6.1c0-1.5 0-3.5-2.2-3.5s-2.5 1.6-2.5 3.4v6.2h-3.8V8.7Z" />
                                </svg>
                              )}
                              <span>{p === "Twitter" ? "X" : p}</span>
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>


                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={loading || !topic.trim() || !hasEnoughCredits}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-lg shadow-violet-300/40 dark:shadow-violet-900/30 disabled:opacity-50 disabled:cursor-not-allowed smooth-transition hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8z"
                        />
                      </svg>
                      Forging viral hooks...
                    </span>
                  ) : (
                    "✦ Generate Hooks (3 credits)"
                  )}
                </button>
              </form>
            </div>

            {/* ── Generated Hooks ── */}
            {hooks.length > 0 && (
              <div className="mt-8 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                    Generated Hooks
                  </p>
                  <span className="text-xs text-gray-400 dark:text-slate-500">
                    {hooks.length} hooks for {platform}
                  </span>
                </div>
                {hooks.map((hook, index) => {
                  const viralScore = getViralScore(hook);
                  return (
                  <div
                    key={index}
                    className="group relative p-5 rounded-xl glass border border-gray-200 dark:border-white/10 hover:shadow-lg dark:hover:shadow-black/40 hover:border-violet-100 dark:hover:border-violet-500/30 smooth-transition"
                  >
                    {/* Viral Score */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-orange-500 dark:text-orange-400">
                        🔥 Viral Score: {viralScore}
                      </span>
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
                          style={{ width: `${viralScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="mt-0.5 text-xs font-bold text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/30 rounded-lg px-2 py-0.5 shrink-0 tabular-nums">
                          #{index + 1}
                        </span>
                        <p className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed">
                          {hook}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(hook, index)}
                          className={`text-xs font-semibold border px-3 py-1.5 rounded-lg transition-all duration-300 ${copiedIndex === index
                            ? "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 scale-95"
                            : "text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 border-gray-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                            }`}
                        >
                          {copiedIndex === index ? "✓ Copied" : "Copy"}
                        </button>
                        {/* Share button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowShareMenu(showShareMenu === index ? null : index)}
                            className="text-xs font-semibold border px-3 py-1.5 rounded-lg text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 border-gray-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all duration-300"
                          >
                            Share
                          </button>
                          {showShareMenu === index && (
                            <div className="absolute right-full mr-2 top-0 z-20 w-40 rounded-xl glass border border-gray-200 dark:border-white/10 shadow-xl p-1.5 animate-scale-in">
                              <button onClick={() => handleShare(hook, "x")} className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-white/10 transition-colors">
                                Share on X
                              </button>
                              <button onClick={() => handleShare(hook, "linkedin")} className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-white/10 transition-colors">
                                Share on LinkedIn
                              </button>
                              <button onClick={() => handleShare(hook, "copy")} className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-white/10 transition-colors">
                                Copy share text
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}

                {/* Regenerate Button */}
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerateLoading || creditsRemaining < 1}
                  className="w-full py-3 rounded-xl border-2 border-violet-600/40 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 font-bold text-sm hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-50 disabled:cursor-not-allowed smooth-transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  {regenerateLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Forging new hooks...
                    </span>
                  ) : (
                    "↻ Regenerate Hooks (1 credit)"
                  )}
                </button>
              </div>
            )}

            {/* Footer */}
            <p className="mt-12 text-xs text-center text-gray-400 dark:text-slate-600">
              Built for serious short-form creators.&nbsp;·&nbsp;HookForge v2
            </p>
          </div>
        </div>
      </div>

      {/* ════════════════════ NICHE/TONE MODAL ════════════════════ */}
      {showNicheToneModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNicheToneModal(false);
          }}
        >
          <div className="glass rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 p-8 w-full max-w-md animate-modal-slide">
            {/* Close X */}
            <button
              onClick={() => setShowNicheToneModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-6">
              {nicheToneTab === "niche" ? "Select Niche" : "Select Tone"}
            </h2>

            {/* Niche Options */}
            {nicheToneTab === "niche" && (
              <div className="grid grid-cols-2 gap-2">
                {["Motivation", "Self Improvement", "Finance", "Tech", "Fitness", "Education", "Storytelling"].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setNiche(option);
                      setShowNicheToneModal(false);
                    }}
                    className={`p-4 rounded-xl border-2 font-semibold transition-all duration-200 ${
                      niche === option
                        ? "border-violet-600 bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300"
                        : "border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-500/30"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* Tone Options */}
            {nicheToneTab === "tone" && (
              <div className="grid grid-cols-2 gap-2">
                {["Bold", "Curious", "Controversial", "Emotional", "Authority", "Relatable"].map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setTone(option);
                      setShowNicheToneModal(false);
                    }}
                    className={`p-4 rounded-xl border-2 font-semibold transition-all duration-200 ${
                      tone === option
                        ? "border-violet-600 bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300"
                        : "border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 text-gray-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-500/30"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* Tab switcher */}
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setNicheToneTab("niche")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  nicheToneTab === "niche"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-300/40 dark:shadow-violet-900/30"
                    : "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10"
                }`}
              >
                Niche
              </button>
              <button
                onClick={() => setNicheToneTab("tone")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  nicheToneTab === "tone"
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-300/40 dark:shadow-violet-900/30"
                    : "bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10"
                }`}
              >
                Tone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ REFERRAL MODAL ════════════════════ */}
      {showReferralModal && user && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReferralModal(false);
          }}
        >
          <div className="glass rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 p-8 w-full max-w-md animate-modal-slide">
            <button
              onClick={() => setShowReferralModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎁</span>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">
                Invite a Creator
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Share your link and earn <span className="font-bold text-violet-600 dark:text-violet-400">20 credits</span> when they sign up!
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
              <input
                type="text"
                readOnly
                value={`https://tryhookforge.com/?ref=${user.id}`}
                className="flex-1 bg-transparent text-xs text-gray-700 dark:text-slate-300 font-mono truncate outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://tryhookforge.com/?ref=${user.id}`);
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
