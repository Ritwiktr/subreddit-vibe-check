import Sentiment from "sentiment";

import type { AnalyzedPost, RedditPost, SentimentLabel, SentimentSummary } from "./types";

const analyzer = new Sentiment();

export function getSentimentLabel(score: number): SentimentLabel {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export function analyzePosts(posts: RedditPost[]): AnalyzedPost[] {
  return posts.map((post) => {
    const result = analyzer.analyze(post.title);
    return {
      ...post,
      sentimentScore: result.score,
      comparative: result.comparative,
      label: getSentimentLabel(result.score),
    };
  });
}

export function summarizeSentiment(posts: AnalyzedPost[]): SentimentSummary {
  const counts = { positive: 0, neutral: 0, negative: 0 };

  for (const post of posts) {
    counts[post.label] += 1;
  }

  const total = posts.length || 1;
  const averageScore =
    posts.reduce((sum, post) => sum + post.sentimentScore, 0) / total;

  let overallVibe: SentimentLabel = "neutral";
  if (counts.positive > counts.negative && counts.positive > counts.neutral) {
    overallVibe = "positive";
  } else if (counts.negative > counts.positive && counts.negative > counts.neutral) {
    overallVibe = "negative";
  }

  return {
    positive: Math.round((counts.positive / total) * 100),
    neutral: Math.round((counts.neutral / total) * 100),
    negative: Math.round((counts.negative / total) * 100),
    averageScore: Number(averageScore.toFixed(2)),
    overallVibe,
  };
}
