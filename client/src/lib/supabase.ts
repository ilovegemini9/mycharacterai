const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SESSION_KEY = "mycharacter:supabase-session";

export type AppSession = { access_token: string; refresh_token: string; user: { id: string; email?: string } };

export function getSession(): AppSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as AppSession : null;
  } catch { return null; }
}

function saveSession(session: AppSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

async function authRequest(path: string, body: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Account service is not configured yet.");
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || "Could not authenticate.");
  return data;
}

export async function signIn(email: string, password: string): Promise<AppSession> {
  const data = await authRequest("token?grant_type=password", { email, password });
  if (!data.access_token || !data.user?.id) throw new Error("No session was returned.");
  const session = data as AppSession;
  saveSession(session);
  return session;
}

export async function signUp(email: string, password: string): Promise<{ session: AppSession | null; needsEmailConfirmation: boolean }> {
  const data = await authRequest("signup", { email, password });
  if (data.access_token && data.user?.id) {
    const session = data as AppSession;
    saveSession(session);
    return { session, needsEmailConfirmation: false };
  }
  return { session: null, needsEmailConfirmation: true };
}

export async function signOut() {
  const session = getSession();
  if (session && SUPABASE_URL && SUPABASE_KEY) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
    }).catch(() => undefined);
  }
  saveSession(null);
}

export async function saveProfile(session: AppSession) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ id: session.user.id, username: session.user.email?.split("@")[0] || null, updated_at: new Date().toISOString() }),
  });
}


export type CharacterRecord = {
  id: string;
  creator_id: string | null;
  name: string;
  role: string;
  description: string;
  greeting: string;
  image_url: string;
  tags: string[];
  is_public: boolean;
};

async function restRequest(path: string, session: AppSession, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Database service is not configured yet.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || "Could not save data to the database.");
  }
  return data;
}

export async function createCharacterRecord(
  session: AppSession,
  character: { name: string; role: string; description: string; greeting: string; image_url: string; tags: string[] },
): Promise<CharacterRecord> {
  const rows = await restRequest("characters?select=id,creator_id,name,role,description,greeting,image_url,tags,is_public", session, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...character, creator_id: session.user.id, is_public: true }),
  });
  if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("The database did not return the created character.");
  return rows[0] as CharacterRecord;
}

export async function listPublicCharacterRecords(session: AppSession): Promise<CharacterRecord[]> {
  const rows = await restRequest("characters?select=id,creator_id,name,role,description,greeting,image_url,tags,is_public&is_public=eq.true&order=created_at.desc", session);
  return Array.isArray(rows) ? rows as CharacterRecord[] : [];
}
