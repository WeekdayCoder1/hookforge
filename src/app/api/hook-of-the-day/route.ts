import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Hard timeout for the entire route — never block the page more than 5s
export const maxDuration = 5;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false } }
);

export async function GET() {
  try {
    // ── 1. Check if we already have a hook for today ──────────────────────
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).toISOString();
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    ).toISOString();

    const { data: existingHook, error: fetchError } = await supabase
      .from("daily_hooks")
      .select("*")
      .gte("created_at", startOfDay)
      .lt("created_at", endOfDay)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Return cached hook immediately if it exists
    if (!fetchError && existingHook) {
      return NextResponse.json({ hook: existingHook.hook, id: existingHook.id });
    }

    // ── 2. Generate a new hook with a 4s timeout ──────────────────────────
    const prompt = `You are a viral short-form content strategist.
Generate 1 powerful, scroll-stopping hook for content creators.
Rules:
- Maximum 15 words
- Pattern interrupt style
- No emojis
- Make it feel dangerous, controversial or irresistible
- Universally applicable to any niche
Return only the hook text. No explanations, no numbering.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    let hook = "";
    try {
      const aiResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.85,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);

      if (!aiResponse.ok) {
        throw new Error(`OpenRouter error: ${aiResponse.status}`);
      }

      const data = await aiResponse.json();
      hook = (data.choices?.[0]?.message?.content || "").trim();
    } catch {
      clearTimeout(timeout);
      // Fail gracefully — page still loads, just no hook of the day shown
      return NextResponse.json({ hook: null }, { status: 200 });
    }

    if (!hook) {
      return NextResponse.json({ hook: null }, { status: 200 });
    }

    // ── 3. Save to DB (non-blocking, best effort) ─────────────────────────
    try {
      const { data: saved } = await supabase
        .from("daily_hooks")
        .insert({ hook, created_at: new Date().toISOString() })
        .select()
        .single();

      return NextResponse.json({ hook: saved?.hook ?? hook, id: saved?.id });
    } catch {
      // Return the hook even if DB save fails
      return NextResponse.json({ hook });
    }
  } catch (error) {
    console.error("[hook-of-the-day] Unexpected error:", error);
    // Always return 200 so the page doesn't hang on a failed fetch
    return NextResponse.json({ hook: null }, { status: 200 });
  }
}