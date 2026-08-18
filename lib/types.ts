export interface RedditPost {
  title: string;
  score: number;
  url: string;
  author: string;
}

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface AnalyzedPost extends RedditPost {
  sentimentScore: number;
  comparative: number;
  label: SentimentLabel;
}

export interface SentimentSummary {
  positive: number;
  neutral: number;
  negative: number;
  averageScore: number;
  overallVibe: SentimentLabel;
}
