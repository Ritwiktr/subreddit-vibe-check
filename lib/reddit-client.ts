import { normalizeSubreddit } from "@/lib/subreddit";
import type { RedditPost } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SubredditVibeCheck/1.0";

const FETCH_TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 5 * 60 * 1000;

function parseRssXml(xml: string): RedditPost[] {
  if (xml.includes("<title>Blocked</title>")) {
    throw new Error("Reddit blocked the request.");
  }

  const posts: RedditPost[] = [];
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/g;

  for (const match of xml.matchAll(entryPattern)) {
    const entry = match[1];
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    const url = entry.match(/<link href="([^"]+)"/)?.[1];
    const authorRaw = entry.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim();

    if (!title || !url || title === "Blocked") continue;

    posts.push({
      title: decodeXmlEntities(title),
      score: 0,
      url,
      author: authorRaw?.replace(/^\/u\//, "") ?? "unknown",
    });
  }

  return posts;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function getRssUrl(subreddit: string) {
  return `https://www.reddit.com/r/${subreddit}/hot/.rss?limit=100`;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRssFromUrl(url: string): Promise<RedditPost[]> {
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/atom+xml,text/xml,*/*",
    },
  });

  if (response.status === 404) {
    throw new Error("Subreddit not found. Check the name and try again.");
  }

  if (!response.ok) {
    throw new Error(`Reddit returned ${response.status}.`);
  }

  const posts = parseRssXml(await response.text());
  if (!posts.length) {
    throw new Error("No posts found for this subreddit.");
  }

  return posts.slice(0, 50);
}

async function fetchRssViaProxy(url: string): Promise<RedditPost[]> {
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
  const response = await fetchWithTimeout(proxyUrl);

  if (!response.ok) {
    throw new Error(`Proxy returned ${response.status}.`);
  }

  const posts = parseRssXml(await response.text());
  if (!posts.length) {
    throw new Error("Proxy returned no posts.");
  }

  return posts.slice(0, 50);
}

async function fetchFromApiRoute(subreddit: string): Promise<RedditPost[]> {
  const response = await fetchWithTimeout(
    `/api/reddit?subreddit=${encodeURIComponent(subreddit)}`
  );

  if (!response.ok) {
    throw new Error("API route failed.");
  }

  const data = (await response.json()) as { posts?: RedditPost[] };
  if (!data.posts?.length) {
    throw new Error("API route returned no posts.");
  }

  return data.posts.slice(0, 50);
}

function getCachedPosts(subreddit: string): RedditPost[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(`vibe-cache:${subreddit}`);
    if (!raw) return null;

    const cached = JSON.parse(raw) as { posts: RedditPost[]; expires: number };
    if (Date.now() > cached.expires) {
      sessionStorage.removeItem(`vibe-cache:${subreddit}`);
      return null;
    }

    return cached.posts;
  } catch {
    return null;
  }
}

function setCachedPosts(subreddit: string, posts: RedditPost[]) {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      `vibe-cache:${subreddit}`,
      JSON.stringify({ posts, expires: Date.now() + CACHE_TTL_MS })
    );
  } catch {
    // Ignore storage quota errors.
  }
}

export async function fetchSubredditPostsClient(subreddit: string): Promise<RedditPost[]> {
  const cleaned = normalizeSubreddit(subreddit);
  const cached = getCachedPosts(cleaned);
  if (cached) return cached;

  const rssUrl = getRssUrl(cleaned);

  const strategies = [
    () => fetchRssFromUrl(rssUrl),
    () => fetchRssViaProxy(rssUrl),
    () => fetchFromApiRoute(cleaned),
  ];

  try {
    const posts = await Promise.any(strategies.map((strategy) => strategy()));
    setCachedPosts(cleaned, posts);
    return posts;
  } catch {
    throw new Error("Could not reach Reddit. Please try again in a moment.");
  }
}
