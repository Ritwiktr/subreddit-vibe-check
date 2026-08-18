import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SubredditVibeCheck/1.0 by SeasonNo9747";

const FETCH_TIMEOUT_MS = 15000;

export interface RedditPost {
  title: string;
  score: number;
  url: string;
  author: string;
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

function parseRssXml(xml: string): RedditPost[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const posts: RedditPost[] = [];

  $("entry").each((_, element) => {
    const title = $(element).find("title").first().text().trim();
    const url = $(element).find("link").first().attr("href") ?? "";
    const authorRaw = $(element).find("author name").first().text().trim();

    if (!title || !url || title === "Blocked") return;

    posts.push({
      title,
      score: 0,
      url,
      author: authorRaw.replace(/^\/u\//, "") || "unknown",
    });
  });

  return posts;
}

async function fetchViaRss(subreddit: string): Promise<RedditPost[]> {
  const response = await fetchWithTimeout(
    `https://www.reddit.com/r/${subreddit}/hot/.rss?limit=100`,
    {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/atom+xml,text/xml,*/*",
      },
      cache: "no-store",
    }
  );

  if (response.status === 404) {
    throw new Error("Subreddit not found.");
  }

  if (!response.ok) {
    throw new Error(`RSS ${response.status}`);
  }

  const posts = parseRssXml(await response.text());
  if (!posts.length) throw new Error("No RSS posts");
  return posts.slice(0, 50);
}

async function fetchOldRedditPage(url: string): Promise<{
  posts: RedditPost[];
  nextUrl?: string;
}> {
  const response = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("Subreddit not found.");
  }

  if (!response.ok) {
    throw new Error(`HTML ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const posts: RedditPost[] = [];

  $("div.thing.link").each((_, element) => {
    const node = $(element);
    const title = node.find("a.title").text().trim();
    const permalink = node.attr("data-permalink");

    if (!title || !permalink) return;

    posts.push({
      title,
      score: Number(node.attr("data-score") ?? 0),
      url: `https://www.reddit.com${permalink}`,
      author: node.attr("data-author") ?? "unknown",
    });
  });

  return {
    posts,
    nextUrl: $(".next-button a").attr("href"),
  };
}

async function fetchViaOldReddit(subreddit: string): Promise<RedditPost[]> {
  const firstPage = await fetchOldRedditPage(`https://old.reddit.com/r/${subreddit}/hot/`);

  if (!firstPage.posts.length) {
    throw new Error("No HTML posts");
  }

  if (!firstPage.nextUrl || firstPage.posts.length >= 50) {
    return firstPage.posts.slice(0, 50);
  }

  const secondPage = await fetchOldRedditPage(firstPage.nextUrl);
  return [...firstPage.posts, ...secondPage.posts].slice(0, 50);
}

export async function fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
  try {
    return await Promise.any([fetchViaRss(subreddit), fetchViaOldReddit(subreddit)]);
  } catch {
    throw new Error("Failed to fetch subreddit data.");
  }
}
