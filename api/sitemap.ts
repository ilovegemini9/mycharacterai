import type { VercelRequest, VercelResponse } from "@vercel/node";

const SITE_URL = "https://characterplay.online";
const PAGE_SIZE = 1000;

type PublicCharacter = {
  id: string;
};

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).send("Sitemap temporarily unavailable: Supabase is not configured.");
  }

  try {
    const characters: PublicCharacter[] = [];
    let offset = 0;

    while (true) {
      const url = new URL("/rest/v1/character_discovery", supabaseUrl);
      url.searchParams.set("select", "id");
      url.searchParams.set("is_public", "eq.true");
      url.searchParams.set("visibility", "eq.public");
      url.searchParams.set("order", "created_at.desc");
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String(offset));

      const response = await fetch(url, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) {
        console.error("Sitemap character query failed:", response.status);
        return res.status(502).send("Sitemap temporarily unavailable.");
      }

      const page = (await response.json()) as PublicCharacter[];
      if (!Array.isArray(page)) {
        return res.status(502).send("Sitemap temporarily unavailable.");
      }

      characters.push(...page.filter((character) => typeof character.id === "string" && character.id.length > 0));
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const urls = [
      `  <url><loc>${SITE_URL}/</loc></url>`,
      ...characters.map((character) => {
        const loc = `${SITE_URL}/character/${encodeURIComponent(character.id)}`;
        return `  <url><loc>${xmlEscape(loc)}</loc></url>`;
      }),
    ];

    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    );
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    return res.status(500).send("Sitemap temporarily unavailable.");
  }
}
