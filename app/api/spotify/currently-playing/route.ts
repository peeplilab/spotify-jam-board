import { NextResponse } from "next/server";
import { getValidSpotifyAccessToken } from "@/lib/spotify";

export async function GET() {
  try {
    const accessToken = await getValidSpotifyAccessToken();

    if (!accessToken) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 204) {
      return NextResponse.json({ connected: true, playing: false });
    }

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ connected: false, error: text }, { status: response.status });
    }

    const data = await response.json();

    if (!data?.item) {
      return NextResponse.json({ connected: true, playing: false });
    }

    return NextResponse.json({
      connected: true,
      playing: true,
      item: {
        name: data.item.name,
        artists: data.item.artists?.map((artist: { name: string }) => artist.name) ?? [],
        album: data.item.album?.name ?? "",
        image: data.item.album?.images?.[0]?.url ?? "",
        externalUrl: data.item.external_urls?.spotify ?? "",
      },
    });
  } catch (error) {
    console.error("Spotify currently playing fetch failed", error);
    return NextResponse.json({ connected: false, error: "Spotify unavailable" }, { status: 500 });
  }
}
