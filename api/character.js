import fs from "node:fs/promises";
import path from "node:path";
import { renderCharacterPage } from "../scripts/character-html.mjs";

function notFound(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  return res.status(404).send("Character not found.");
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method not allowed.");
  }

  const rawId = req.query?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return notFound(res);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("Character profiles are temporarily unavailable.");
  }

  try {
    const url = new URL("/rest/v1/character_discovery", supabaseUrl);
    url.searchParams.set("select", "id,name,role,description,greeting,image_url,tags,is_public,visibility");
    url.searchParams.set("id", "eq." + id);
    url.searchParams.set("is_public", "eq.true");
    url.searchParams.set("visibility", "eq.public");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: "Bearer " + supabaseKey
      }
    });
    if (!response.ok) {
      console.error("Character lookup failed:", response.status);
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).send("Character profiles are temporarily unavailable.");
    }

    const records = await response.json();
    const record = Array.isArray(records)
      ? records.find((item) => item && item.id === id && item.is_public === true && item.visibility === "public")
      : null;
    if (!record) return notFound(res);

    const templatePath = path.join(process.cwd(), "dist", "public", "index.html");
    const template = await fs.readFile(templatePath, "utf8");
    const html = renderCharacterPage(template, {
      id: record.id,
      name: record.name,
      role: record.role || "AI character",
      desc: record.description || "",
      greeting: record.greeting || "",
      tags: Array.isArray(record.tags) ? record.tags : [],
      image: record.image_url || ""
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error("Character page rendering failed:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).send("Character profiles are temporarily unavailable.");
  }
}
