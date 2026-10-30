import type { VercelRequest, VercelResponse } from "@vercel/node";

const allowedOrigins = new Set([
  "https://character-cai.vercel.app",
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin) && !origin.endsWith(".vercel.app")) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AI chat is not configured yet. Add GROQ_API_KEY in Vercel settings." });
  }

  let body: any;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  const character = body?.character;
  const history = body?.messages;

  if (!character || typeof character.name !== "string" || !Array.isArray(history)) {
    return res.status(400).json({ error: "Character and messages are required." });
  }
  if (history.length > 20) {
    return res.status(400).json({ error: "Please send no more than 20 recent messages." });
  }

  const messages = history
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const systemPrompt = [
    `You are ${character.name}, a fictional AI character.`,
    `Role: ${String(character.role || "A friendly companion").slice(0, 500)}`,
    `Short description: ${String(character.desc || "Warm, engaging, and imaginative.").slice(0, 1200)}`,
    `Personality, tone, behavior, likes and dislikes: ${String(character.personality || "Warm, engaging, and imaginative.").slice(0, 4000)}`,
    `Scenario / current setting: ${String(character.scenario || "A setting shaped naturally by the conversation.").slice(0, 2000)}`,
    `Backstory and important history: ${String(character.backstory || "No additional backstory provided.").slice(0, 2500)}`,
    `Opening greeting: ${String(character.greeting || "").slice(0, 1500)}`,
    "Use the scenario as the active scene and the backstory as continuity context. Follow the character rules and example dialogue included in the personality field; treat example dialogue as style guidance, not as text to repeat.",
    `Topics/tags: ${Array.isArray(character.tags) ? character.tags.join(", ").slice(0, 300) : "general"}`,
    "ROLEPLAY RULES: Treat the character profile above as the source of truth. Stay consistently in this character's personality, voice, worldview, emotional style, and role throughout the whole conversation.",
    "Make the reply feel specific to THIS character, not like a generic assistant. Reflect their role and tags in their word choice, humor, confidence, warmth, mystery, formality, and reactions. For fantasy/anime/roleplay characters, lean into the fictional world and immersive storytelling when it fits.",
    "Use the character's description and the conversation history to guide their relationship with the user. Remember details from earlier messages and respond to what the user actually said. Let the character's mood and relationship develop naturally over time.",
    "Write natural conversational replies. Use dialogue and occasional small action beats when appropriate, but do not overdo narration. Match the user's language when practical. Keep replies concise unless the scene or user calls for more detail.",
    "Never control the user's actions, thoughts, or dialogue. Do not break character to say you are an AI or give generic assistant disclaimers unless directly necessary for safety. Do not claim to be a real human. If the profile is brief, infer a coherent style from the name, role, description, and tags without contradicting them."
  ].join("\n");

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.85,
        max_tokens: 500,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const data = await upstream.json().catch(() => ({}));
      console.error("Groq API error:", upstream.status, data?.error?.message || "Unknown error");
      if (upstream.status === 429) return res.status(429).json({ error: "The free AI usage limit has been reached for now. Please try again later." });
      if (upstream.status === 401 || upstream.status === 403) return res.status(502).json({ error: "Groq rejected the API key or model access. Check GROQ_API_KEY in Vercel." });
      if (upstream.status === 404) return res.status(502).json({ error: "The configured AI model was not found. Please check the model ID." });
      return res.status(502).json({ error: "The AI service could not answer right now. Please try again." });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let emitted = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload);
          const delta = event?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) { res.write(delta); emitted = true; }
        } catch { /* Ignore incomplete or non-JSON SSE frames. */ }
      }
    }
    if (!emitted) {
      if (!res.headersSent) return res.status(502).json({ error: "The AI returned an empty reply. Please try again." });
    }
    return res.end();
  } catch (error) {
    console.error("Chat API request failed:", error);
    return res.status(502).json({ error: "Could not reach the AI service. Please try again." });
  }
}
