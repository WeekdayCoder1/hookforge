export async function POST(req: Request) {
    try {
        const { topic, niche, tone } = await req.json();

        const prompt = `
You are a viral short-form content strategist.

Generate 10 ultra scroll-stopping hooks.

Topic: ${topic}
Niche: ${niche}
Tone: ${tone}

Rules:
- Maximum 12 words per hook
- High curiosity
- Pattern interrupt style
- No emojis
- No generic phrases
- Make them feel dangerous, controversial or irresistible
- Optimized for YouTube Shorts & Instagram Reels

Return only hooks separated by new lines.
`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-3.5-turbo",
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });

        const data = await response.json();

        const text = data.choices?.[0]?.message?.content || "";

        const hooks = text.split("\n").filter((line: string) => line.trim() !== "").slice(0, 10);

        return Response.json({ hooks });

    } catch (error) {
        console.error(error);
        return new Response("Something went wrong", { status: 500 });
    }
}