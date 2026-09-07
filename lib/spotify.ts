import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SPOTIFY_COOKIE_KEYS = {
  access: "spotify_access_token",
  refresh: "spotify_refresh_token",
  expiresAt: "spotify_expires_at",
} as const;

export function getSpotifyRedirectUri() {
  return (
    process.env.SPOTIFY_REDIRECT_URI ?? "http://127.0.0.1:3000/api/auth/spotify/callback"
  );
}

export function getSpotifyClientId() {
  return process.env.SPOTIFY_CLIENT_ID;
}

export function getSpotifyClientSecret() {
  return process.env.SPOTIFY_CLIENT_SECRET;
}

export function getSpotifyAuthUrl() {
  const clientId = getSpotifyClientId();
  const redirectUri = getSpotifyRedirectUri();

  if (!clientId) {
    throw new Error("SPOTIFY_CLIENT_ID is not set.");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: [
      "user-read-currently-playing",
      "user-read-playback-state",
    ].join(" "),
    redirect_uri: redirectUri,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(code: string) {
  const clientId = getSpotifyClientId();
  const clientSecret = getSpotifyClientSecret();
  const redirectUri = getSpotifyRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials are missing.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify token exchange failed: ${text}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  };
}

export async function refreshSpotifyToken(refreshToken: string) {
  const clientId = getSpotifyClientId();
  const clientSecret = getSpotifyClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials are missing.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify token refresh failed: ${text}`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
    refresh_token?: string;
  };
}

export async function setSpotifySession(response: NextResponse, token: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}) {
  const expiresAt = Date.now() + token.expires_in * 1000;

  response.cookies.set(SPOTIFY_COOKIE_KEYS.access, token.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  if (token.refresh_token) {
    response.cookies.set(SPOTIFY_COOKIE_KEYS.refresh, token.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  response.cookies.set(SPOTIFY_COOKIE_KEYS.expiresAt, String(expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSpotifySession(response: NextResponse) {
  response.cookies.set(SPOTIFY_COOKIE_KEYS.access, "", { path: "/", maxAge: 0 });
  response.cookies.set(SPOTIFY_COOKIE_KEYS.refresh, "", { path: "/", maxAge: 0 });
  response.cookies.set(SPOTIFY_COOKIE_KEYS.expiresAt, "", { path: "/", maxAge: 0 });
}

export async function getSpotifySession() {
  const store = await cookies();

  const accessToken = store.get(SPOTIFY_COOKIE_KEYS.access)?.value;
  const refreshToken = store.get(SPOTIFY_COOKIE_KEYS.refresh)?.value;
  const expiresAt = Number(store.get(SPOTIFY_COOKIE_KEYS.expiresAt)?.value ?? "0");

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

export async function getValidSpotifyAccessToken() {
  const { accessToken, refreshToken, expiresAt } = await getSpotifySession();

  if (!accessToken && !refreshToken) {
    return null;
  }

  if (accessToken && Date.now() < expiresAt) {
    return accessToken;
  }

  if (!refreshToken) {
    return null;
  }

  const refreshed = await refreshSpotifyToken(refreshToken);
  const cookieStore = await cookies();

  const nextExpiresAt = Date.now() + refreshed.expires_in * 1000;

  cookieStore.set(SPOTIFY_COOKIE_KEYS.access, refreshed.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  cookieStore.set(SPOTIFY_COOKIE_KEYS.refresh, refreshed.refresh_token ?? refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  cookieStore.set(SPOTIFY_COOKIE_KEYS.expiresAt, String(nextExpiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return refreshed.access_token;
}
