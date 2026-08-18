import { RedditNetworkError, SubredditNotFoundError } from "@/lib/errors";
import { normalizeSubreddit } from "@/lib/subreddit";
import type { RedditPost } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SubredditVibeCheck/1.0";

const CACHE_TTL_MS = 5 * 60 * 1000;

function parseRssXml(xml: string, subreddit: string): RedditPost[] {
  if (xml.includes("<title>Blocked</title>") || xml.includes("whoa there, pardner")) {
    throw new RedditNetworkError();
  }

  const posts: RedditPost[] = [];
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/g;

  for (const match of xml.matchAll(entryPattern)) {
    const entry = match[1];
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
    const url = entry.match(/<link href="([^"]+)"/)?.[1];
    const authorRaw = entry.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim();

    if (!title || !url || !authorRaw?.startsWith("/u/")) continue;

    posts.push({
      title: decodeXmlEntities(title),
      score: 0,
      url,
      author: authorRaw.replace(/^\/u\//, ""),
    });
  }

  if (!posts.length && xml.includes("page not found")) {
    throw new SubredditNotFoundError(subreddit);
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

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(
  url: string,
  subreddit: string,
  options: RequestInit = {},
  timeoutMs = 20000
) {
  const response = await fetchWithTimeout(url, options, timeoutMs);

  if (response.status === 404) {
    throw new SubredditNotFoundError(subreddit);
  }

  const text = await response.text();

  if (text.startsWith("{")) {
    try {
      const json = JSON.parse(text) as { error?: string; contents?: string };
      if (json.error) throw new RedditNetworkError();
      if (json.contents) return json.contents;
    } catch (error) {
      if (error instanceof RedditNetworkError) throw error;
    }
  }

  return text;
}

async function fetchRssDirect(subreddit: string): Promise<RedditPost[]> {
  const url = getRssUrl(subreddit);
  const text = await fetchText(
    url,
    subreddit,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/atom+xml,text/xml,*/*",
      },
    }
  );

  const posts = parseRssXml(text, subreddit);
  if (!posts.length) throw new SubredditNotFoundError(subreddit);
  return posts.slice(0, 50);
}

async function fetchRssViaProxy(subreddit: string, proxyBase: string): Promise<RedditPost[]> {
  const target = getRssUrl(subreddit);
  const proxyUrl =
    proxyBase === "corsproxy"
      ? `https://corsproxy.io/?url=${encodeURIComponent(target)}`
      : `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;

  const text = await fetchText(proxyUrl, subreddit, {}, 25000);
  const posts = parseRssXml(text, subreddit);
  if (!posts.length) throw new SubredditNotFoundError(subreddit);
  return posts.slice(0, 50);
}

async function fetchFromApiRoute(subreddit: string): Promise<RedditPost[]> {
  const response = await fetchWithTimeout(
    `/api/reddit?subreddit=${encodeURIComponent(subreddit)}`,
    {},
    20000
  );

  const data = (await response.json()) as { posts?: RedditPost[]; error?: string };

  if (response.status === 404) {
    throw new SubredditNotFoundError(subreddit);
  }

  if (!response.ok) {
    if (data.error?.toLowerCase().includes("not found")) {
      throw new SubredditNotFoundError(subreddit);
    }
    throw new RedditNetworkError();
  }

  if (!data.posts?.length) {
    throw new SubredditNotFoundError(subreddit);
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

  const strategies: Array<() => Promise<RedditPost[]>> = [
    () => fetchRssViaProxy(cleaned, "corsproxy"),
    () => fetchFromApiRoute(cleaned),
    () => fetchRssDirect(cleaned),
    () => fetchRssViaProxy(cleaned, "allorigins"),
  ];

  let notFound = false;

  for (const strategy of strategies) {
    try {
      const posts = await strategy();
      setCachedPosts(cleaned, posts);
      return posts;
    } catch (error) {
      if (error instanceof SubredditNotFoundError) {
        notFound = true;
        continue;
      }
    }
  }

  if (notFound) {
    throw new SubredditNotFoundError(cleaned);
  }

  throw new RedditNetworkError();
}
