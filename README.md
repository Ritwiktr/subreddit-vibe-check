# The Subreddit Vibe Check

A dashboard that fetches the top 50 **Hot** posts from any public subreddit and runs **client-side sentiment analysis** on their titles.

## Features

- Subreddit search with quick presets
- Fetches 50 hot posts via Reddit's public JSON API (paginated)
- Client-side sentiment analysis using the [`sentiment`](https://www.npmjs.com/package/sentiment) library
- Overall vibe summary with positive / neutral / negative breakdown
- Sortable-style post table with sentiment scores and Reddit links

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **sentiment** for NLP analysis

## How It Works

1. The browser calls `/api/reddit?subreddit=...`
2. A Next.js API route fetches Reddit data server-side (avoids CORS)
3. Post titles are analyzed in the browser with the `sentiment` package
4. Results are displayed on the dashboard

## Reddit API Setup (required)

Reddit often blocks unauthenticated `.json` requests. Set up a Reddit app:

1. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) while logged in
2. Click **"create another app..."** (or "create app")
3. Fill in:
   - **name:** Subreddit Vibe Check
   - **type:** script
   - **redirect uri:** `http://localhost:3000` (required but unused for script apps)
4. Click **Create app**
5. Copy the **client ID** (string under the app name) and **secret**
6. Create `.env.local` from the example:

```bash
cp .env.example .env.local
```

7. Fill in your credentials:

```env
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_secret
REDDIT_USERNAME=SeasonNo9747
REDDIT_PASSWORD=your_reddit_password
```

Restart the dev server after saving `.env.local`.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Deploy easily to [Vercel](https://vercel.com):

1. Push this repo to GitHub
2. Import the project in Vercel
3. Deploy

## Reddit API

Uses the public endpoint:

```
https://www.reddit.com/r/{subreddit}/hot.json
```

No OAuth required for read-only public data.
