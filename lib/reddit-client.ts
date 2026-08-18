import type { RedditPost } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SubredditVibeCheck/1.0";

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

async function fetchRssFromUrl(url: string): Promise<RedditPost[]> {
  const response = await fetch(url, {
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

  const xml = await response.text();
  const posts = parseRssXml(xml);

  if (!posts.length) {
    throw new Error("No posts found for this subreddit.");
  }

  return posts.slice(0, 50);
}

async function fetchViaProxy(url: string): Promise<RedditPost[]> {
  const proxyUrls = [
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  for (const proxyUrl of proxyUrls) {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) continue;
      const posts = parseRssXml(await response.text());
      if (posts.length) return posts.slice(0, 50);
    } catch {
      continue;
    }
  }

  throw new Error("Could not reach Reddit.");
}

export async function fetchSubredditPostsClient(subreddit: string): Promise<RedditPost[]> {
  const rssUrl = getRssUrl(subreddit);
  const strategies = [
    () => fetchRssFromUrl(rssUrl),
    () => fetchViaProxy(rssUrl),
    async () => {
      const response = await fetch(`/api/reddit?subreddit=${encodeURIComponent(subreddit)}`);
      if (!response.ok) throw new Error("API route failed");
      const data = (await response.json()) as { posts?: RedditPost[] };
      if (!data.posts?.length) throw new Error("No posts from API");
      return data.posts.slice(0, 50);
    },
  ];

  let lastError = "Could not reach Reddit. Please try again in a moment.";

  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  throw new Error(lastError);
}
