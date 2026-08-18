"use client";

import { useMemo, useState } from "react";

import { analyzePosts, summarizeSentiment } from "@/lib/sentiment";
import { fetchSubredditPostsClient } from "@/lib/reddit-client";
import { isValidSubreddit, normalizeSubreddit } from "@/lib/subreddit";
import type { AnalyzedPost } from "@/lib/types";

const PRESETS = ["javascript", "webdev", "news", "technology", "programming"];

const labelStyles = {
  positive: "bg-emerald-100 text-emerald-800 border-emerald-200",
  neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
  negative: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function Dashboard() {
  const [subreddit, setSubreddit] = useState("javascript");
  const [posts, setPosts] = useState<AnalyzedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const summary = useMemo(
    () => (posts.length ? summarizeSentiment(posts) : null),
    [posts]
  );

  async function handleAnalyze(targetSubreddit = subreddit) {
    const cleaned = normalizeSubreddit(targetSubreddit);
    if (!cleaned) {
      setError("Enter a subreddit name.");
      return;
    }

    if (!isValidSubreddit(cleaned)) {
      setError("Invalid subreddit name. Use letters, numbers, and underscores only.");
      return;
    }

    setLoading(true);
    setError(null);
    setSubreddit(cleaned);

    try {
      const fetchedPosts = await fetchSubredditPostsClient(cleaned);
      const analyzed = analyzePosts(fetchedPosts);
      setPosts(analyzed);
      setHasSearched(true);
    } catch (err) {
      setPosts([]);
      setError(err instanceof Error ? err.message : "Failed to analyze subreddit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-600">
          Reddit Sentiment Dashboard
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          The Subreddit Vibe Check
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600">
          Fetch the top 50 hot posts from any public subreddit and run client-side
          sentiment analysis on their titles.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <form
          className="flex flex-col gap-4 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAnalyze();
          }}
        >
          <div className="flex flex-1 items-center overflow-hidden rounded-xl border border-zinc-300 bg-zinc-50">
            <span className="px-4 text-zinc-500">r/</span>
            <input
              value={subreddit}
              onChange={(event) => setSubreddit(event.target.value)}
              placeholder="javascript"
              className="w-full bg-transparent py-3 pr-4 text-zinc-900 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Analyzing..." : "Check the vibe"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => void handleAnalyze(preset)}
              className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 transition hover:border-orange-300 hover:text-orange-700"
            >
              r/{preset}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}
      </section>

      {summary && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Overall vibe"
            value={summary.overallVibe}
            accent={labelStyles[summary.overallVibe]}
          />
          <SummaryCard title="Positive" value={`${summary.positive}%`} accent="text-emerald-700" />
          <SummaryCard title="Neutral" value={`${summary.neutral}%`} accent="text-zinc-700" />
          <SummaryCard title="Negative" value={`${summary.negative}%`} accent="text-rose-700" />
        </section>
      )}

      {summary && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">Sentiment breakdown</h2>
              <p className="text-sm text-zinc-500">
                Average title score: {summary.averageScore} across {posts.length} posts
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Bar label="Positive" value={summary.positive} color="bg-emerald-500" />
            <Bar label="Neutral" value={summary.neutral} color="bg-zinc-400" />
            <Bar label="Negative" value={summary.negative} color="bg-rose-500" />
          </div>
        </section>
      )}

      {hasSearched && posts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="text-xl font-semibold text-zinc-900">Post titles analyzed</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-medium">#</th>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Sentiment</th>
                  <th className="px-6 py-3 font-medium">Score</th>
                  <th className="px-6 py-3 font-medium">Upvotes</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post, index) => (
                  <tr key={`${post.url}-${index}`} className="border-t border-zinc-100">
                    <td className="px-6 py-4 text-zinc-400">{index + 1}</td>
                    <td className="max-w-xl px-6 py-4">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-zinc-900 hover:text-orange-600"
                      >
                        {post.title}
                      </a>
                      <p className="mt-1 text-xs text-zinc-400">u/{post.author}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${labelStyles[post.label]}`}
                      >
                        {post.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-700">{post.sentimentScore}</td>
                    <td className="px-6 py-4 text-zinc-600">
                      {post.score > 0 ? post.score.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className={`mt-2 text-3xl font-bold capitalize ${accent}`}>{value}</p>
    </div>
  );
}

function Bar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-zinc-600">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
