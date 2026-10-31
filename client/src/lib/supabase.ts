const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SESSION_KEY = "mycharacter:supabase-session";
const PRODUCTION_SITE_URL = "https://character-cai.vercel.app";

export type AppSession = { access_token: string; refresh_token: string; user: { id: string; email?: string } };

export function getSession(): AppSession | null {
  try { const value = localStorage.getItem(SESSION_KEY); return value ? JSON.parse(value) as AppSession : null; } catch { return null; }
}
function saveSession(session: AppSession | null) { try { if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); } catch {} }

async function authRequest(path: string, body: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Account service is not configured yet.");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = String(data?.msg || data?.message || data?.error_description || data?.error || "");
    const normalized = raw.toLowerCase();
    if (normalized.includes("email not confirmed")) throw new Error("Your email is not confirmed yet. Check your inbox and confirm your account first.");
    if (normalized.includes("invalid login credentials")) throw new Error("Email or password is incorrect.");
    if (normalized.includes("user already registered")) throw new Error("An account with this email already exists. Sign in instead.");
    if (normalized.includes("password should be at least")) throw new Error(raw);
    throw new Error(raw || "Could not authenticate.");
  }
  return data;
}

/**
 * Use the canonical production URL on the production domain. This avoids
 * accidentally sending a production OAuth flow back to localhost when the
 * Supabase project's fallback Site URL is misconfigured. Local development
 * continues to return to its own origin.
 */
function getOAuthRedirectUrl(): string {
  const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isProductionDomain = window.location.hostname === "character-cai.vercel.app";
  const base = isProductionDomain ? PRODUCTION_SITE_URL : window.location.origin;
  const path = isLocalDevelopment ? window.location.pathname : (window.location.pathname || "/");
  return new URL(path, base).toString();
}

export function signInWithGoogle(): void {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Account service is not configured yet.");
  const url = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", getOAuthRedirectUrl());
  window.location.assign(url.toString());
}

export async function completeOAuthRedirect(): Promise<AppSession|null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const oauthError = hash.get("error_description") || query.get("error_description") || hash.get("error") || query.get("error");
  if (oauthError) throw new Error(decodeURIComponent(oauthError.replace(/\\+/g, " ")));
  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${access_token}` } });
  const user = await response.json().catch(() => null);
  if (!response.ok || !user?.id) throw new Error("Could not complete Google sign in.");
  const session = { access_token, refresh_token, user: { id: user.id, email: user.email } } as AppSession;
  saveSession(session);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return session;
}

export async function signIn(email: string, password: string): Promise<AppSession> {
  const data = await authRequest("token?grant_type=password", { email: email.trim(), password });
  if (!data.access_token || !data.user?.id) throw new Error("No session was returned.");
  const session = data as AppSession;
  saveSession(session);
  return session;
}

export async function signUp(email: string, password: string): Promise<{ session: AppSession | null; needsEmailConfirmation: boolean }> {
  const data = await authRequest("signup", { email: email.trim(), password });
  if (data.access_token && data.user?.id) {
    const session = data as AppSession;
    saveSession(session);
    return { session, needsEmailConfirmation: false };
  }
  return { session: null, needsEmailConfirmation: true };
}

export async function signOut() { const session = getSession(); if (session && SUPABASE_URL && SUPABASE_KEY) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` } }).catch(() => undefined); saveSession(null); }
export async function saveProfile(session: AppSession) { if (!SUPABASE_URL || !SUPABASE_KEY) return; await fetch(`${SUPABASE_URL}/rest/v1/profiles`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: session.user.id, username: session.user.email?.split("@")[0] || null, updated_at: new Date().toISOString() }) }); }

export type CharacterRecord = { id: string; creator_id: string | null; name: string; role: string; description: string; greeting: string; personality: string | null; scenario: string | null; backstory: string | null; image_url: string; tags: string[]; is_public: boolean; visibility?: "public"|"private"|"unlisted"; chat_count?: number; like_count?: number; creator_username?: string | null; creator_display_name?: string | null; created_at?: string };
export type ChatMessage = { id?: string; sender: "user" | "character"; content: string; created_at?: string };

async function restRequest(path: string, session: AppSession, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Database service is not configured yet.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const text = await response.text(); const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.hint || "Could not save data to the database."); return data;
}
export async function createCharacterRecord(session: AppSession, character: { name: string; role: string; description: string; greeting: string; personality: string; scenario: string; backstory: string; image_url: string; tags: string[]; is_public: boolean; visibility?: "public"|"private"|"unlisted" }): Promise<CharacterRecord> { const rows = await restRequest("characters?select=id,creator_id,name,role,description,greeting,personality,scenario,backstory,image_url,tags,is_public,visibility", session, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...character, creator_id: session.user.id }) }); if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("The database did not return the created character."); return rows[0] as CharacterRecord; }
export async function listPublicCharacterRecords(session: AppSession): Promise<CharacterRecord[]> { const rows = await restRequest("character_discovery?select=*&order=created_at.desc", session); return Array.isArray(rows) ? rows as CharacterRecord[] : []; }
export async function listSavedCharacterIds(session: AppSession): Promise<string[]> { const rows = await restRequest("saved_characters?select=character_id&user_id=eq." + encodeURIComponent(session.user.id), session); return Array.isArray(rows) ? rows.map((row: { character_id: string }) => row.character_id) : []; }
export async function setCharacterSaved(session: AppSession, characterId: string, saved: boolean) { if (saved) await restRequest("saved_characters", session, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ user_id: session.user.id, character_id: characterId }) }); else await restRequest("saved_characters?user_id=eq." + encodeURIComponent(session.user.id) + "&character_id=eq." + encodeURIComponent(characterId), session, { method: "DELETE" }); }
export async function getOrCreateChat(session: AppSession, characterId: string, title: string): Promise<string> { const existing = await restRequest("chats?select=id&user_id=eq." + encodeURIComponent(session.user.id) + "&character_id=eq." + encodeURIComponent(characterId) + "&order=updated_at.desc&limit=1", session); if (Array.isArray(existing) && existing[0]?.id) return existing[0].id as string; const rows = await restRequest("chats?select=id", session, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ user_id: session.user.id, character_id: characterId, title }) }); if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("Could not create the conversation."); return rows[0].id as string; }
export async function loadChatMessages(session: AppSession, chatId: string): Promise<ChatMessage[]> { const rows = await restRequest("messages?select=id,sender,content,created_at&chat_id=eq." + encodeURIComponent(chatId) + "&order=created_at.asc", session); return Array.isArray(rows) ? rows as ChatMessage[] : []; }
export async function saveChatMessage(session: AppSession, chatId: string, message: ChatMessage) { await restRequest("messages", session, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ chat_id: chatId, sender: message.sender, content: message.content }) }); }

export type CharacterComment = { id:string; character_id:string; user_id:string; content:string; created_at:string };
export async function listCharacterComments(characterId:string):Promise<CharacterComment[]> {
 if(!SUPABASE_URL||!SUPABASE_KEY) return [];
 const response=await fetch(`${SUPABASE_URL}/rest/v1/character_comments?select=id,character_id,user_id,content,created_at&character_id=eq.${encodeURIComponent(characterId)}&order=created_at.desc&limit=50`,{headers:{apikey:SUPABASE_KEY}});
 if(!response.ok) throw new Error("Could not load comments."); return await response.json() as CharacterComment[];
}
export async function addCharacterComment(session:AppSession,characterId:string,content:string){await restRequest("character_comments",session,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({character_id:characterId,user_id:session.user.id,content})});}
export async function toggleCharacterLike(session:AppSession,characterId:string,liked:boolean){if(liked)await restRequest("character_likes?user_id=eq."+encodeURIComponent(session.user.id)+"&character_id=eq."+encodeURIComponent(characterId),session,{method:"DELETE"});else await restRequest("character_likes",session,{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({user_id:session.user.id,character_id:characterId})});}
export async function followCreator(session:AppSession,creatorId:string,following:boolean){if(following)await restRequest("creator_follows?follower_id=eq."+encodeURIComponent(session.user.id)+"&creator_id=eq."+encodeURIComponent(creatorId),session,{method:"DELETE"});else await restRequest("creator_follows",session,{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({follower_id:session.user.id,creator_id:creatorId})});}
export async function reportCharacter(session:AppSession,characterId:string,reason:string){await restRequest("character_reports",session,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({character_id:characterId,reporter_id:session.user.id,reason})});}
export async function blockCreator(session:AppSession,creatorId:string){await restRequest("creator_blocks",session,{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({blocker_id:session.user.id,creator_id:creatorId})});}

export type UserPreferences = { theme?: "dark" | "light" | "system"; language?: string; content_filters?: string[]; [key: string]: unknown };
export type CharacterMemory = { id: string; user_id: string; character_id: string; content: string; created_at: string; updated_at: string };
export async function loadUserPreferences(session: AppSession): Promise<UserPreferences> {
 const rows = await restRequest("user_preferences?select=preferences&user_id=eq."+encodeURIComponent(session.user.id)+"&limit=1", session);
 return Array.isArray(rows) && rows[0]?.preferences && typeof rows[0].preferences === "object" ? rows[0].preferences as UserPreferences : {};
}
export async function saveUserPreferences(session: AppSession, preferences: UserPreferences): Promise<void> {
 await restRequest("user_preferences", session, { method:"POST", headers:{Prefer:"resolution=merge-duplicates,return=minimal"}, body:JSON.stringify({user_id:session.user.id,preferences,updated_at:new Date().toISOString()}) });
}
export async function listCharacterMemories(session: AppSession, characterId: string): Promise<CharacterMemory[]> {
 const rows = await restRequest("character_memories?select=id,user_id,character_id,content,created_at,updated_at&user_id=eq."+encodeURIComponent(session.user.id)+"&character_id=eq."+encodeURIComponent(characterId)+"&order=updated_at.desc&limit=100", session);
 return Array.isArray(rows) ? rows as CharacterMemory[] : [];
}
export async function addCharacterMemory(session: AppSession, characterId: string, content: string): Promise<void> {
 await restRequest("character_memories", session, { method:"POST", headers:{Prefer:"return=minimal"}, body:JSON.stringify({user_id:session.user.id,character_id:characterId,content:content.trim()}) });
}
export async function deleteCharacterMemory(session: AppSession, memoryId: string): Promise<void> {
 await restRequest("character_memories?id=eq."+encodeURIComponent(memoryId)+"&user_id=eq."+encodeURIComponent(session.user.id), session, { method:"DELETE" });
}
export async function reportMessage(session: AppSession, messageId: string, reason: string): Promise<void> {
 await restRequest("message_reports", session, { method:"POST", headers:{Prefer:"return=minimal"}, body:JSON.stringify({message_id:messageId,reporter_id:session.user.id,reason:reason.trim()}) });
}
