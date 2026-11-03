function respond(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return respond(res, 405, { message: "Method not allowed." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supabaseUrl || !supabaseKey || !serviceKey || !accessToken) {
    return respond(res, 401, { message: "Sign in before editing a character." });
  }

  const { characterId, imageUrl } = req.body || {};
  if (typeof characterId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(characterId) || typeof imageUrl !== "string") {
    return respond(res, 400, { message: "Invalid character image update." });
  }

  try {
    const userResponse = await fetch(new URL("/auth/v1/user", supabaseUrl), {
      headers: { apikey: supabaseKey, Authorization: "Bearer " + accessToken }
    });
    if (!userResponse.ok) return respond(res, 401, { message: "Your session has expired. Sign in again." });
    const user = await userResponse.json();

    const expectedPrefix = new URL("/storage/v1/object/public/community-images/" + user.id + "/character/", supabaseUrl).toString();
    if (!imageUrl.startsWith(expectedPrefix)) {
      return respond(res, 400, { message: "Choose an image uploaded and approved for this account." });
    }

    const updateUrl = new URL("/rest/v1/characters", supabaseUrl);
    updateUrl.searchParams.set("id", "eq." + characterId);
    updateUrl.searchParams.set("creator_id", "eq." + user.id);
    updateUrl.searchParams.set("select", "id");
    const updateResponse = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ image_url: imageUrl })
    });
    const rows = await updateResponse.json().catch(() => null);
    if (!updateResponse.ok) {
      console.error("Character image update failed:", updateResponse.status);
      return respond(res, 502, { message: "Could not save the character image. Please try again." });
    }
    if (!Array.isArray(rows) || rows.length !== 1) {
      return respond(res, 404, { message: "Character not found or you do not own it." });
    }
    return respond(res, 200, { updated: true });
  } catch (error) {
    console.error("Character image update request failed:", error instanceof Error ? error.message : "Unknown error");
    return respond(res, 503, { message: "Character image service is temporarily unavailable." });
  }
}
