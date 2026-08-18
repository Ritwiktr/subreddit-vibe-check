export class SubredditNotFoundError extends Error {
  constructor(subreddit: string) {
    super(`Subreddit r/${subreddit} is not available.`);
    this.name = "SubredditNotFoundError";
  }
}

export class RedditNetworkError extends Error {
  constructor() {
    super("Could not reach Reddit right now. Please try again in a moment.");
    this.name = "RedditNetworkError";
  }
}

export function isSubredditNotFoundError(error: unknown): boolean {
  return error instanceof SubredditNotFoundError;
}
