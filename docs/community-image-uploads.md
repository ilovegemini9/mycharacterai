# CharacterPlay community image uploads

This feature lets signed-in members upload a profile photo and a character image, and replace a character image later from that character's profile page.

## Required server environment variables

Configure these in Vercel for Preview and Production:

- `OPENAI_API_KEY`: used by the image moderation endpoint.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key used only after moderation succeeds to write the approved image to Storage.

The app already uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Do not prefix the service role key with `VITE_`, and never expose it to client-side code.

If either server-only key is missing, image uploads fail closed: the app will not accept or publish an image without a successful safety check.

## Supabase Storage setup

Run [community-image-storage.sql](../supabase/community-image-storage.sql) once in the Supabase SQL Editor. It creates a public-read bucket named `community-images`, limited to JPG, PNG, and WebP images up to 5 MB.

Do not create authenticated INSERT, UPDATE, or DELETE policies for this bucket. All writes must pass through the server moderation endpoint, which verifies the user's Supabase session and uploads with the server-only service role key. Public bucket access is for displaying approved images only.

## Moderation behavior

`POST /api/moderate-image` verifies the access token with Supabase, checks the image using OpenAI's `omni-moderation-latest`, and only then stores it. Pornographic or sexually explicit content (including sexual content involving minors) is rejected. Other flagged content is rejected too. If moderation or storage is unavailable, the upload is rejected rather than published.

Character image edits use `PATCH /api/update-character-image`. The endpoint verifies the signed-in user and updates only a character row whose `creator_id` matches that user. It also requires the new image URL to be under that user's approved character-image folder.

Automated moderation is not perfect. Keep the existing report workflow available and review user reports; do not describe this as a guarantee that every possible nude or borderline image will be detected.
