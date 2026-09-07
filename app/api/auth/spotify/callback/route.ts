import { NextRequest, NextResponse } from "next/server";
import { exchangeSpotifyCode, setSpotifySession } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  console.log("Spotify callback received", { code: code ? "YES" : "NO", error });

  if (error) {
    console.error("Spotify auth error:", error);
    return NextResponse.redirect(new URL("/?spotify_error=1", request.url));
  }

  if (!code) {
    console.error("No auth code received");
    return NextResponse.redirect(new URL("/?spotify_error=2", request.url));
  }

  try {
    console.log("Exchanging code for token...");
    const token = await exchangeSpotifyCode(code);
    console.log("Token received:", { access_token: token.access_token ? "YES" : "NO", refresh_token: token.refresh_token ? "YES" : "NO" });
    const response = NextResponse.redirect(new URL("/", request.url));
    await setSpotifySession(response, token);
    console.log("Session set, redirecting to home");
    return response;
  } catch (error) {
    console.error("Spotify callback failed", error);
    return NextResponse.redirect(new URL("/?spotify_error=3", request.url));
  }
}
