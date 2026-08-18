import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SubredditVibeCheck/1.0 by SeasonNo9747";

export interface RedditPost {
  title: string;
  score: number;
  url: string;
  author: string;
}

interface RedditListing {
  data: {
    after: string | null;
    children: Array<{
      data: {
        title: string;
        score: number;
        permalink: string;
        author: string;
      };
    }>;
  };
}

function getOAuthConfig() {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    return null;
  }

  return { clientId, clientSecret, username, password };
}

async function getAccessToken(config: NonNullable<ReturnType<typeof getOAuthConfig>>) {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    "base64"
  );

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: config.username,
      password: config.password,
    }),
  });

  if (!response.ok) {
    throw new Error("Reddit authentication failed. Check your API credentials.");
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function fetchWithOAuth(
  subreddit: string,
  token: string,
  after?: string
): Promise<RedditListing> {
  const params = new URLSearchParams({ limit: "25" });
  if (after) params.set("after", after);

  const response = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/hot?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
      },
      next: { revalidate: 60 },
    }
  );

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Subreddit not found. Check the name and try again."
        : `Reddit returned ${response.status}. Try again later.`
    );
  }

  return (await response.json()) as RedditListing;
}

async function fetchOldRedditPage(url: string): Promise<{
  posts: RedditPost[];
  nextUrl?: string;
}> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 60 },
  });

  if (response.status === 404) {
    throw new Error("Subreddit not found. Check the name and try again.");
  }

  if (!response.ok) {
    throw new Error(`Reddit returned ${response.status}. Try again later.`);
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

  if (firstPage.posts.length === 0) {
    throw new Error("Subreddit not found or has no hot posts.");
  }

  if (!firstPage.nextUrl || firstPage.posts.length >= 50) {
    return firstPage.posts.slice(0, 50);
  }

  const secondPage = await fetchOldRedditPage(firstPage.nextUrl);
  return [...firstPage.posts, ...secondPage.posts].slice(0, 50);
}

function listingToPosts(listing: RedditListing): RedditPost[] {
  return listing.data.children.map(({ data }) => ({
    title: data.title,
    score: data.score,
    url: `https://www.reddit.com${data.permalink}`,
    author: data.author,
  }));
}

async function fetchViaOAuth(subreddit: string): Promise<RedditPost[]> {
  const oauthConfig = getOAuthConfig();
  if (!oauthConfig) return fetchViaOldReddit(subreddit);

  const token = await getAccessToken(oauthConfig);
  const firstPage = await fetchWithOAuth(subreddit, token);
  const secondPage = firstPage.data.after
    ? await fetchWithOAuth(subreddit, token, firstPage.data.after)
    : null;

  return [
    ...listingToPosts(firstPage),
    ...(secondPage ? listingToPosts(secondPage) : []),
  ].slice(0, 50);
}

export async function fetchSubredditPosts(subreddit: string): Promise<RedditPost[]> {
  try {
    return await fetchViaOAuth(subreddit);
  } catch {
    return fetchViaOldReddit(subreddit);
  }
}
