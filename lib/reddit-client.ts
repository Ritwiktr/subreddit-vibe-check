import type { RedditPost } from "./types";

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

function listingToPosts(listing: RedditListing): RedditPost[] {
  return listing.data.children.map(({ data }) => ({
    title: data.title,
    score: data.score,
    url: `https://www.reddit.com${data.permalink}`,
    author: data.author,
  }));
}

async function fetchViaApiRoute(subreddit: string): Promise<RedditPost[] | null> {
  const response = await fetch(`/api/reddit?subreddit=${encodeURIComponent(subreddit)}`);
  if (!response.ok) return null;

  const data = (await response.json()) as { posts?: RedditPost[] };
  return data.posts?.length ? data.posts : null;
}

async function fetchViaProxy(subreddit: string, after?: string): Promise<RedditListing> {
  const redditUrl = new URL(`https://www.reddit.com/r/${subreddit}/hot.json`);
  redditUrl.searchParams.set("limit", "25");
  if (after) redditUrl.searchParams.set("after", after);

  const target = redditUrl.toString();
  const proxyUrls = [
    `https://corsproxy.io/?url=${encodeURIComponent(target)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  ];

  for (const proxyUrl of proxyUrls) {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) continue;

      const listing = (await response.json()) as RedditListing;
      if (listing?.data?.children?.length) return listing;
    } catch {
      continue;
    }
  }

  throw new Error("Could not reach Reddit. Please try again in a moment.");
}

export async function fetchSubredditPostsClient(subreddit: string): Promise<RedditPost[]> {
  const fromApi = await fetchViaApiRoute(subreddit);
  if (fromApi) return fromApi.slice(0, 50);

  const firstPage = await fetchViaProxy(subreddit);
  const posts = listingToPosts(firstPage);

  if (posts.length >= 50 || !firstPage.data.after) {
    return posts.slice(0, 50);
  }

  const secondPage = await fetchViaProxy(subreddit, firstPage.data.after);
  return [...posts, ...listingToPosts(secondPage)].slice(0, 50);
}
