import { NextResponse } from "next/server";

import { fetchSubredditPosts } from "@/lib/reddit";
import { isValidSubreddit, normalizeSubreddit } from "@/lib/subreddit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subreddit = normalizeSubreddit(searchParams.get("subreddit") ?? "");

  if (!subreddit) {
    return NextResponse.json({ error: "Subreddit is required." }, { status: 400 });
  }

  if (!isValidSubreddit(subreddit)) {
    return NextResponse.json({ error: "Invalid subreddit name." }, { status: 400 });
  }

  try {
    const posts = await fetchSubredditPosts(subreddit);
    return NextResponse.json({ subreddit, posts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch subreddit data.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
