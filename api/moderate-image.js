const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const config = {
  api: { bodyParser: { sizeLimit: "7mb" } }
};

function respond(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respond(res, 405, { approved: false, message: "Method not allowed." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const moderationKey = process.env.OPENAI_API_KEY;
  const storageServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supabaseUrl || !supabaseKey || !accessToken) {
    return respond(res, 401, { approved: false, message: "Sign in before uploading an image." });
  }

  if (!moderationKey || !storageServiceKey) {
    return respond(res, 503, { approved: false, message: "Image safety checks are temporarily unavailable. Please try again later." });
  }

  const { image, mimeType, purpose } = req.body || {};
  if (typeof image !== "string" || !ALLOWED_TYPES.has(mimeType) || !["profile", "character"].includes(purpose)) {
    return respond(res, 400, { approved: false, message: "Choose a valid JPG, PNG, or WebP image." });
  }

  const estimatedBytes = Math.floor(image.length * 3 / 4);
  if (!image.length || estimatedBytes > MAX_IMAGE_BYTES || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    return respond(res, 413, { approved: false, message: "Image must be smaller than 5 MB." });
  }

  try {
    const userResponse = await fetch(new URL("/auth/v1/user", supabaseUrl), {
      headers: { apikey: supabaseKey, Authorization: "Bearer " + accessToken }
    });
    if (!userResponse.ok) return respond(res, 401, { approved: false, message: "Your session has expired. Sign in again." });
    const user = await userResponse.json();

    const moderationResponse = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: "Bearer " + moderationKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: [{ type: "image_url", image_url: { url: "data:" + mimeType + ";base64," + image } }]
      })
    });
    const moderation = await moderationResponse.json().catch(() => ({}));
    if (!moderationResponse.ok) {
      console.error("Image moderation provider returned status", moderationResponse.status);
      return respond(res, 503, { approved: false, message: "Image safety checks are temporarily unavailable. Please try again later." });
    }

    const result = moderation.results?.[0];
    if (!result || typeof result.flagged !== "boolean") {
      return respond(res, 503, { approved: false, message: "The image could not be verified. Please try again." });
    }

    const categories = result.categories || {};
    const sexual = Boolean(categories.sexual || categories["sexual/minors"]);
    if (sexual) {
      return respond(res, 422, { approved: false, message: "This image is not allowed. Pornographic, nude, or sexually explicit images are prohibited." });
    }
    if (result.flagged) {
      return respond(res, 422, { approved: false, message: "This image did not pass the platform safety check." });
    }

    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
    const objectPath = user.id + "/" + purpose + "/" + Date.now() + "-" + crypto.randomUUID() + "." + extension;
    const uploadResponse = await fetch(new URL("/storage/v1/object/community-images/" + objectPath, supabaseUrl), {
      method: "POST",
      headers: {
        apikey: storageServiceKey,
        Authorization: "Bearer " + storageServiceKey,
        "Content-Type": mimeType,
        "x-upsert": "false",
        "cache-control": "3600"
      },
      body: Buffer.from(image, "base64")
    });
    if (!uploadResponse.ok) {
      console.error("Approved image storage upload failed:", uploadResponse.status);
      return respond(res, 502, { approved: false, message: "The image passed safety checks but could not be saved. Please try again." });
    }

    const imageUrl = new URL("/storage/v1/object/public/community-images/" + objectPath.split("/").map(encodeURIComponent).join("/"), supabaseUrl).toString();
    return respond(res, 200, { approved: true, imageUrl });
  } catch (error) {
    console.error("Image moderation request failed:", error instanceof Error ? error.message : "Unknown error");
    return respond(res, 503, { approved: false, message: "Image safety checks are temporarily unavailable. Please try again later." });
  }
}
