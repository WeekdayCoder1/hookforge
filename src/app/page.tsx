"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("Motivation");
  const [tone, setTone] = useState("Bold");
  const [hooks, setHooks] = useState<string[]>([]);
  const [usage, setUsage] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    setIsMounted(true);

    const saved = localStorage.getItem("hookforge_usage");
    if (saved !== null) {
      setUsage(Number(saved));
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("hookforge_usage", usage.toString());
    }
  }, [usage, isMounted]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    console.log("BUTTON CLICKED");
    console.log("Usage: ", usage);
    if (usage >= 5) {
      alert("Free limit reached. Upgrade to Pro for unlimited hooks.");
      return;
    }

    try {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, niche, tone }),
      });

      const data = await response.json();

      if (data.hooks) {
        setHooks(data.hooks);
        setUsage(prev => prev + 1);
      } else {
        setHooks(["Something went wrong."]);
      }

    } catch {
      setHooks(["Error generating hooks."]);
    } finally {
      console.log("Loading false");
      setLoading(false); // ALWAYS runs
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f5] flex flex-col items-center justify-center p-6 font-sans">

      {/* Main Card */}
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl p-10 relative">

        {/* Usage Badge — top right */}
        {isMounted && (
          <div className="absolute top-6 right-8 text-right">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Free Plan — {usage}/5 Generations Used
            </p>
            <div className="w-36 h-1.5 bg-gray-200 rounded-full overflow-hidden ml-auto">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${(usage / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Heading */}
        <div className="mb-8 mt-2">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight leading-tight mb-2">
            AI Hook{" "}
            <span className="bg-gradient-to-r from-violet-600 to-purple-400 bg-clip-text text-transparent">
              Generator
            </span>
          </h1>
          <p className="text-base font-medium text-violet-500 mb-1">
            Create viral hooks for Shorts, Reels &amp; TikTok in seconds.
          </p>
          <p className="text-sm text-gray-400">
            Built for serious short-form creators who want higher retention and clicks.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleGenerate} className="space-y-4">

          {/* Topic Input */}
          <input
            type="text"
            placeholder="Enter your video topic..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition"
          />

          {/* Niche + Tone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 pl-1">Niche</label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition appearance-none"
              >
                <option value="Motivation">Motivation</option>
                <option value="Self Improvement">Self Improvement</option>
                <option value="Finance">Finance</option>
                <option value="Tech">Tech</option>
                <option value="Fitness">Fitness</option>
                <option value="Education">Education</option>
                <option value="Storytelling">Storytelling</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 pl-1">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition appearance-none"
              >
                <option value="Bold">Bold</option>
                <option value="Curious">Curious</option>
                <option value="Controversial">Controversial</option>
                <option value="Emotional">Emotional</option>
                <option value="Authority">Authority</option>
                <option value="Relatable">Relatable</option>
              </select>
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-semibold text-sm tracking-wide shadow-md shadow-violet-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating...
              </span>
            ) : (
              "✦ Generate Hooks"
            )}
          </button>
          <p className="text-xs text-center text-gray-400 mt-2">No login required. Free to try.</p>
        </form>

        {/* Hooks Output */}
        {hooks.length > 0 && (
          <div className="mt-8 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Generated Hooks</p>
            {hooks.map((hook, index) => (
              <div
                key={index}
                className="group flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-md hover:border-violet-100 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-xs font-bold text-violet-500 bg-violet-50 border border-violet-100 rounded-md px-2 py-0.5 shrink-0">
                    #{index + 1}
                  </span>
                  <p className="text-sm text-gray-800 leading-relaxed">{hook}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(hook, index)}
                  className={`shrink-0 text-xs font-semibold border px-3 py-1.5 rounded-lg transition-all duration-150 group-hover:bg-white ${copiedIndex === index
                    ? "text-emerald-600 border-emerald-300 bg-emerald-50"
                    : "text-gray-400 hover:text-violet-600 border-gray-200 hover:border-violet-300"
                    }`}
                >
                  {copiedIndex === index ? "Copied ✓" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-gray-400">
        Built for serious short-form creators. &nbsp;·&nbsp; HookForge
      </p>
    </div>
  );
}