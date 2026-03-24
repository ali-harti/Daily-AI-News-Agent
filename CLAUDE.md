# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Daily News Agent - Social Edition. A TypeScript-based news aggregation system that fetches AI news from multiple sources (RSS feeds, NewsAPI, YouTube, Twitter/X via Nitter, LinkedIn, Instagram) and sends daily digests via Telegram.

## Build Commands

- `npm run build` - Compile TypeScript to dist/
- `npm run dev` - Run directly with ts-node (no build needed)
- `npm run clean` - Remove dist/ directory

## Runtime Commands

- `npm start` - Build and start the scheduler
- `npm run fetch-now` - Build and run fetch pipeline immediately (manual execution)
- `npm run test` - Build and run connectivity test (checks config and NewsAPI)
- `npm run logs` - View today's logs (reads data/logs/YYYY-MM-DD.log)

## Architecture

### Pipeline Flow (src/index.ts:runPipeline)
1. **Fetch Phase** - Parallel fetching from all sources (RSS, NewsAPI, YouTube, Twitter, LinkedIn, Instagram)
2. **Deduplication** - Filter against previously sent items using URL hash (SHA-256)
3. **Relevance Scoring** - Keyword-based scoring against AI terms
4. **Categorization** - Auto-assign to categories (BREAKING, RESEARCH, TOOLS, etc.)
5. **AI Summarization** - Top 10 items processed via Google Gemini (gemini-1.5-flash) with 4-second delays between calls (rate limit compliance)
6. **Digest Generation** - Group by category, select top stories
7. **Send & Persist** - Send via Telegram, save to JSON DB if successful

### Source Code Structure

- **src/fetchers/** - Source-specific fetchers
  - rss.ts - 10 RSS feeds (TechCrunch, VentureBeat, HuggingFace, OpenAI, DeepMind, etc.)
  - newsapi.ts - NewsAPI (100 req/day free tier)
  - youtube.ts - YouTube Data API v3 (channels + keyword search)
  - twitter.ts - Nitter scraper (Twitter/X without auth)
  - linkedin.ts - Company page scraper
  - instagram.ts - Account scraper

- **src/processor/** - Content processing
  - relevance.ts - Keyword-based relevance scoring
  - categorizer.ts - Category assignment
  - summarizer.ts - Gemini AI summarization

- **src/senders/** - Output channels
  - telegram.ts - Telegram Bot API message formatting/sending

- **src/storage/** - Persistence
  - json-db.ts - JSON file-based deduplication DB with retention

- **src/utils/** - Utilities
  - logger.ts - Winston-based logging
  - retry.ts - Retry logic with exponential backoff

### Configuration (config.json)

Config uses Zod validation (src/config.ts). Supports environment variable overrides:
- `NEWSAPI_KEY` - overrides news.newsapi_key
- `YOUTUBE_API_KEY` - overrides youtube.api_key
- `TELEGRAM_BOT_TOKEN` - overrides telegram.bot_token
- `TELEGRAM_CHAT_ID` - overrides telegram.chat_id

Config file lookup order: config.local.json → config.json (in project root)

### Data Storage

- **data/sent-articles.json** - Deduplication database (SHA-256 hashed URLs with 30-day retention)
- **data/digests/** - Archived daily digests (YYYY-MM-DD.json)
- **data/logs/** - Winston daily rotating logs

### Key Types (src/types.ts)

Content types: Article, Video, Tweet, LinkedInPost, InstagramPost
Unified as ContentItem with base fields: id, title, url, source, sourceName, publishedAt, category, relevanceScore

### Rate Limiting & Retry

All external fetchers use src/utils/retry.ts with exponential backoff:
- Default: 3 attempts, initial 1-2 second delay
- YouTube API: 10,000 units/day quota
- NewsAPI: 100 requests/day free tier
- Gemini: 15 RPM free tier (enforced via 4-second delays)

### Scheduler

Uses node-cron with timezone support. Daily send time configured via schedule.send_time (HH:MM format) in config.json. Default: 20:00 Africa/Casablanca.

## Important Implementation Details

1. **Deduplication** - Uses SHA-256 hash of normalized URL. Only marks items as "sent" after successful Telegram delivery.

2. **Social Scraping** - Twitter uses Nitter instances (config.twitter.nitter_instances) which rotate on failure. LinkedIn/Instagram use Puppeteer with stealth plugin.

3. **Summarization** - Only processes top 10 items to manage API quota. Falls back to description on failure.

4. **Relevance Threshold** - Items below config.news.min_relevance_score (default 0.5) are filtered out.

5. **Pipeline Gate** - Requires minimum 5 relevant items before generating digest (src/index.ts:145).

## Testing

No formal test suite. Use `npm run test` for connectivity verification or `npm run fetch-now` for end-to-end manual testing (will actually send if Telegram configured).
