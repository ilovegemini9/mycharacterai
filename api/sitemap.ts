import type { VercelRequest, VercelResponse } from "@vercel/node";

const SITE_URL = "https://characterplay.online";
const PAGE_SIZE = 1000;
const STARTER_CHARACTER_IMAGES: Record<string, string> = {
  "starter-akira": "https://api.dicebear.com/9.x/adventurer/svg?seed=Akira-Hayashi&backgroundColor=b6e3f4",
  "starter-yuna": "https://api.dicebear.com/9.x/adventurer/svg?seed=Yuna-Kisaragi&backgroundColor=ffdfbf",
  "starter-ren": "https://api.dicebear.com/9.x/adventurer/svg?seed=Ren-Takahashi&backgroundColor=c0aede",
  "starter-kaede": "https://api.dicebear.com/9.x/adventurer/svg?seed=Kaede-Mori&backgroundColor=d1d4f9",
  "starter-haru": "https://api.dicebear.com/9.x/adventurer/svg?seed=Haru-Sato&backgroundColor=ffd5dc",
  "starter-sora": "https://api.dicebear.com/9.x/adventurer/svg?seed=Sora-Amamiya&backgroundColor=c4f1d0",
  "starter-mika": "https://api.dicebear.com/9.x/adventurer/svg?seed=Mika-Fujimoto&backgroundColor=ffe4a8",
  "starter-daichi": "https://api.dicebear.com/9.x/adventurer/svg?seed=Daichi-Kuroda&backgroundColor=c9d7c1"
};

type PublicCharacter = {
  id: string;
  image_url?: string | null;
};

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function publicImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
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
    const characters: PublicCharacter[] = Object.entries(STARTER_CHARACTER_IMAGES).map(([id, image_url]) => ({ id, image_url }));
    let offset = 0;

    while (true) {
      const url = new URL("/rest/v1/character_discovery", supabaseUrl);
      url.searchParams.set("select", "id,image_url");
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

    const uniqueCharacters = Array.from(new Map(characters.map((character) => [character.id, character])).values());
    const urls = [
      `  <url><loc>${SITE_URL}/</loc></url>`,
      ...uniqueCharacters.map((character) => {
        const loc = `${SITE_URL}/character/${encodeURIComponent(character.id)}`;
        const image = publicImageUrl(character.image_url);
        const imageTag = image
          ? `<image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>`
          : "";
        return `  <url><loc>${xmlEscape(loc)}</loc>${imageTag}</url>`;
      }),
    ];

    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`,
    );
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    return res.status(500).send("Sitemap temporarily unavailable.");
  }
}
