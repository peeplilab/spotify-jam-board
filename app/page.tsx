"use client";

import { FormEvent, useEffect, useState } from "react";

type JamItem = {
  id: string;
  url: string;
  note: string;
  createdAt: string;
  nowPlaying?: TrackSnapshot | null;
  spotifyConnected?: boolean;
};

type TrackSnapshot = {
  name: string;
  artists: string[];
  album: string;
  image: string;
  externalUrl: string;
};

type NowPlayingState = {
  connected: boolean;
  playing: boolean;
  item?: TrackSnapshot;
};

const STORAGE_KEY = "spotify-jam-board-items";

function buildId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [jams, setJams] = useState<JamItem[]>([]);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [nowPlaying, setNowPlaying] = useState<NowPlayingState | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as JamItem[];
        if (Array.isArray(parsed)) {
          setJams(parsed);
        } else {
          setJams([]);
        }
      } catch {
        setJams([]);
      }
    } else {
      setJams([]);
    }

    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jams));
  }, [jams, hasHydrated]);

  useEffect(() => {
    const loadSpotifyStatus = async () => {
      try {
        const sessionResponse = await fetch("/api/spotify/session");
        if (sessionResponse.ok) {
          const sessionData = (await sessionResponse.json()) as { connected: boolean };
          setSpotifyConnected(Boolean(sessionData.connected));
        } else {
          setSpotifyConnected(false);
        }
      } catch {
        setSpotifyConnected(false);
      }

      try {
        const response = await fetch("/api/spotify/currently-playing");
        if (!response.ok) {
          setNowPlaying({ connected: false, playing: false });
          return;
        }
        const data = (await response.json()) as NowPlayingState;
        setNowPlaying(data);
      } catch {
        setNowPlaying({ connected: false, playing: false });
      }
    };

    loadSpotifyStatus();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedLink = link.trim();
    const trimmedNote = note.trim();

    if (!trimmedLink) {
      setError("Paste a Spotify link first.");
      return;
    }

    const url = new URL(trimmedLink);
    const hostname = url.hostname.toLowerCase();
    const isSpotifyLink =
      hostname === "spotify.com" ||
      hostname.endsWith(".spotify.com") ||
      hostname === "spotify.link" ||
      hostname.endsWith(".spotify.link") ||
      hostname === "open.spotify.com" ||
      hostname.endsWith(".open.spotify.com") ||
      trimmedLink.startsWith("spotify:");

    if (!isSpotifyLink) {
      setError("This looks like a non-Spotify link. Paste a Spotify URL.");
      return;
    }

    const nextJam: JamItem = {
      id: buildId(),
      url: trimmedLink,
      note: trimmedNote,
      createdAt: new Date().toISOString(),
      nowPlaying:
        nowPlaying?.connected && nowPlaying.playing && nowPlaying.item
          ? nowPlaying.item
          : null,
      spotifyConnected: Boolean(spotifyConnected || nowPlaying?.connected),
    };

    setJams((current) => [nextJam, ...current]);
    setLink("");
    setNote("");
    setError("");
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Spotify jam board</p>
          <h1>Share the vibe.</h1>
          <p className="subtitle">
            Paste a Spotify jam link and it shows up for everyone on the board.
          </p>
        </div>

        <form className="share-form" onSubmit={handleSubmit}>
          <div className="connect-row">
            <a className="connect-button" href="/api/auth/spotify">
              {spotifyConnected ? "Reconnect Spotify" : "Connect Spotify"}
            </a>
          </div>

          <p className="now-playing-label">
            Spotify status: {spotifyConnected ? "connected" : "not connected"}
          </p>

          <label htmlFor="jam-link">Spotify link</label>
          <input
            id="jam-link"
            type="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://open.spotify.com/track/..."
          />

          <label htmlFor="jam-note">Optional note</label>
          <textarea
            id="jam-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Late-night drive, chill mix, workout set..."
          />

          {error ? <p className="error">{error}</p> : null}

          <button type="submit">Share jam</button>
        </form>
      </section>

      <section className="jam-feed">
        <div className="feed-header">
          <h2>Live board</h2>
          <span>{jams.length} shared</span>
        </div>

        <div className="jam-list">
          {jams.length === 0 ? (
            <div className="empty-state">
              <p>No jams shared yet.</p>
              <span>Paste the first Spotify link to start the board.</span>
            </div>
          ) : (
            jams.map((jam) => (
              <a
                key={jam.id}
                href={jam.url}
                className="jam-card jam-card-with-now-playing"
                target="_blank"
                rel="noreferrer"
              >
                <div className="now-playing-inline">
                  {jam.nowPlaying ? (
                    <>
                      {jam.nowPlaying.image ? (
                        <img src={jam.nowPlaying.image} alt={jam.nowPlaying.name} />
                      ) : null}
                      <div>
                        <p className="now-playing-label">Now playing</p>
                        <h3>{jam.nowPlaying.name}</h3>
                        <p>{jam.nowPlaying.artists.join(", ")}</p>
                      </div>
                    </>
                  ) : (
                    <div className="muted">
                      <p className="now-playing-label">Now playing</p>
                      <h3>
                        {jam.spotifyConnected
                          ? "Nothing is playing right now."
                          : "Sign in with Spotify to share what you&apos;re playing."}
                      </h3>
                    </div>
                  )}
                </div>

                <div className="jam-card-details">
                  <div className="jam-pill">Spotify</div>
                  {jam.note ? <h3>{jam.note}</h3> : null}
                  <p>{jam.url}</p>
                  <div className="jam-meta">
                    <span>{new Date(jam.createdAt).toLocaleDateString()}</span>
                    <span>Open in Spotify →</span>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
