import { NextResponse } from "next/server";

import { fetchSubredditPosts } from "@/lib/reddit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subreddit = searchParams.get("subreddit")?.trim().replace(/^r\//, "");

  if (!subreddit) {
    return NextResponse.json({ error: "Subreddit is required." }, { status: 400 });
  }

  if (!/^[A-Za-z0-9_]+$/.test(subreddit)) {
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
