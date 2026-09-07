import { NextResponse } from "next/server";
import { getSpotifySession } from "@/lib/spotify";

export async function GET() {
  const session = await getSpotifySession();

  return NextResponse.json({
    connected: Boolean(session.accessToken),
    hasRefreshToken: Boolean(session.refreshToken),
    expiresAt: session.expiresAt,
  });
}
