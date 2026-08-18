"use client";

import { useMemo, useState } from "react";

import { isSubredditNotFoundError } from "@/lib/errors";
import { fetchSubredditPostsClient } from "@/lib/reddit-client";
import { analyzePosts, summarizeSentiment } from "@/lib/sentiment";
import { isValidSubreddit, normalizeSubreddit } from "@/lib/subreddit";
import type { AnalyzedPost, SentimentLabel } from "@/lib/types";

const PRESETS = ["javascript", "webdev", "news", "technology", "programming"];

const vibeConfig: Record<
  SentimentLabel,
  { label: string; color: string; bg: string; ring: string; emoji: string }
> = {
  positive: {
    label: "Positive",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    ring: "ring-emerald-500/30",
    emoji: "✨",
  },
  neutral: {
    label: "Neutral",
    color: "text-zinc-300",
    bg: "bg-zinc-500/15",
    ring: "ring-zinc-500/30",
    emoji: "😐",
  },
  negative: {
    label: "Negative",
    color: "text-rose-400",
    bg: "bg-rose-500/15",
    ring: "ring-rose-500/30",
    emoji: "🔥",
  },
};

export default function Dashboard() {
  const [subreddit, setSubreddit] = useState("javascript");
  const [activeSubreddit, setActiveSubreddit] = useState<string | null>(null);
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
      setActiveSubreddit(cleaned);
      setHasSearched(true);
    } catch (err) {
      setPosts([]);
      setActiveSubreddit(null);

      if (isSubredditNotFoundError(err)) {
        setError(`Subreddit r/${cleaned} is not available.`);
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Could not reach Reddit right now. Please try again in a moment."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-32 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <header className="relative space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          Reddit Sentiment Dashboard
        </div>

        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            The Subreddit
            <span className="block bg-gradient-to-r from-orange-400 via-orange-500 to-amber-300 bg-clip-text text-transparent">
              Vibe Check
            </span>
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
            Fetch hot posts from any public subreddit and run client-side sentiment
            analysis on their titles. Fast, visual, and built for quick community
            pulse checks.
          </p>
        </div>
      </header>

      <section className="glass-card relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />

        <form
          className="flex flex-col gap-4 lg:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAnalyze();
          }}
        >
          <div className="flex flex-1 items-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-inner">
            <span className="border-r border-white/10 px-4 py-4 font-mono text-zinc-500">
              r/
            </span>
            <input
              value={subreddit}
              onChange={(event) => setSubreddit(event.target.value)}
              placeholder="javascript"
              className="w-full bg-transparent px-4 py-4 text-lg text-white outline-none placeholder:text-zinc-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-orange-950/40 transition hover:scale-[1.01] hover:from-orange-400 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <LoadingSpinner />
                  Analyzing...
                </>
              ) : (
                <>Check the vibe</>
              )}
            </span>
            <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition group-hover:translate-x-[100%] duration-700" />
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const isActive = activeSubreddit === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => void handleAnalyze(preset)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-orange-400/40 bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-200"
                }`}
              >
                r/{preset}
              </button>
            );
          })}
        </div>

        {error && (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              error.includes("not available")
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {error}
          </div>
        )}
      </section>

      {loading && !summary && <LoadingSkeleton />}

      {summary && activeSubreddit && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Overall vibe"
              value={summary.overallVibe}
              subtitle={`r/${activeSubreddit}`}
              highlight
              vibe={summary.overallVibe}
            />
            <SummaryCard
              title="Positive"
              value={`${summary.positive}%`}
              subtitle="Happy titles"
              vibe="positive"
            />
            <SummaryCard
              title="Neutral"
              value={`${summary.neutral}%`}
              subtitle="Balanced tone"
              vibe="neutral"
            />
            <SummaryCard
              title="Negative"
              value={`${summary.negative}%`}
              subtitle="Critical tone"
              vibe="negative"
            />
          </section>

          <section className="glass-card grid gap-8 rounded-3xl p-6 sm:p-8 lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col items-center justify-center gap-4">
              <SentimentDonut
                positive={summary.positive}
                neutral={summary.neutral}
                negative={summary.negative}
              />
              <div className="text-center">
                <p className="text-sm text-zinc-500">Average title score</p>
                <p className="text-3xl font-bold text-white">{summary.averageScore}</p>
                <p className="mt-1 text-sm text-zinc-500">{posts.length} posts analyzed</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Sentiment breakdown</h2>
                <p className="text-sm text-zinc-500">
                  Distribution of emotional tone across hot post titles
                </p>
              </div>
              <Bar label="Positive" value={summary.positive} color="bg-emerald-500" />
              <Bar label="Neutral" value={summary.neutral} color="bg-zinc-400" />
              <Bar label="Negative" value={summary.negative} color="bg-rose-500" />
            </div>
          </section>
        </>
      )}

      {hasSearched && posts.length > 0 && (
        <section className="glass-card overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-white">Post titles analyzed</h2>
              <p className="text-sm text-zinc-500">
                Click any title to open the Reddit thread
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
              {posts.length} posts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-zinc-500">
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
                  <tr
                    key={`${post.url}-${index}`}
                    className="border-t border-white/5 transition hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4 font-mono text-zinc-600">{index + 1}</td>
                    <td className="max-w-xl px-6 py-4">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-zinc-100 transition hover:text-orange-300"
                      >
                        {post.title}
                      </a>
                      <p className="mt-1 text-xs text-zinc-500">u/{post.author}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ${vibeConfig[post.label].bg} ${vibeConfig[post.label].color} ${vibeConfig[post.label].ring}`}
                      >
                        <span>{vibeConfig[post.label].emoji}</span>
                        <span className="capitalize">{post.label}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-300">{post.sentimentScore}</td>
                    <td className="px-6 py-4 text-zinc-400">
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

function LoadingSpinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}

function LoadingSkeleton() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="glass-card animate-shimmer h-32 rounded-3xl" />
      ))}
    </section>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  vibe,
  highlight = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  vibe?: SentimentLabel;
  highlight?: boolean;
}) {
  const config = vibe ? vibeConfig[vibe] : null;

  return (
    <div
      className={`glass-card rounded-3xl p-5 ${
        highlight ? "ring-1 ring-orange-500/30" : ""
      }`}
    >
      <p className="text-sm text-zinc-500">{title}</p>
      <p
        className={`mt-2 text-3xl font-bold capitalize ${
          config ? config.color : "text-white"
        }`}
      >
        {config?.emoji} {value}
      </p>
      <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
    </div>
  );
}

function SentimentDonut({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const gradient = `conic-gradient(
    #22c55e 0 ${positive}%,
    #a1a1aa ${positive}% ${positive + neutral}%,
    #f43f5e ${positive + neutral}% 100%
  )`;

  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-xl"
        style={{ background: gradient }}
      />
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full p-[10px]"
        style={{ background: gradient }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-zinc-950 text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Vibe mix</p>
          <p className="text-2xl font-bold text-white">{positive}%</p>
          <p className="text-xs text-emerald-400">positive</p>
        </div>
      </div>
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
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono text-zinc-500">{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
