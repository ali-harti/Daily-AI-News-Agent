/**
 * Nitter Twitter Scraper
 * Uses Nitter instances to fetch tweets for free
 * Nitter is an open-source Twitter alternative without rate limits
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Tweet, ContentSource, ContentCategory, FetchResult } from '../types';
import { loadConfig } from '../config';
import { createLogger } from '../utils/logger';
import { withRetry, randomDelay } from '../utils/retry';

const logger = createLogger('Twitter');

export async function fetchTwitter(): Promise<FetchResult<Tweet>> {
  const config = loadConfig();
  const tweets: Tweet[] = [];
  const errors: string[] = [];

  if (!config.twitter.enabled || !config.twitter.use_nitter) {
    logger.warn('⚠️ Twitter/Nitter disabled, skipping');
    return { data: [], errors: ['Twitter disabled'], source: ContentSource.TWITTER };
  }

  logger.info('📡 Fetching Twitter via Nitter...');

  const instances = config.twitter.nitter_instances;
  let currentInstanceIndex = 0;

  // Helper to get next working instance
  const getInstance = () => instances[currentInstanceIndex % instances.length];

  // Fetch from monitored accounts
  for (const account of config.twitter.accounts) {
    let success = false;
    let attempts = 0;

    while (!success && attempts < instances.length) {
      const instance = getInstance();
      try {
        const accountTweets = await withRetry(
          async () => fetchAccountTweets(account, instance, config.twitter.min_likes),
          { maxAttempts: 2, initialDelay: 1000 }
        );
        tweets.push(...accountTweets);
        logger.info(`✅ @${account}: ${accountTweets.length} tweets`);
        success = true;
      } catch (error) {
        attempts++;
        currentInstanceIndex++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn(`⚠️ Failed to fetch @${account} from ${instance}, trying next...`, { error: errorMsg });

        if (attempts >= instances.length) {
          errors.push(`@${account}: All instances failed`);
        }
      }
    }

    await randomDelay(2000, 4000);
  }

  // Fetch from hashtags (optional - may not work on all Nitter instances)
  for (const hashtag of config.twitter.hashtags.slice(0, 2)) { // Limit to avoid rate limits
    try {
      const instance = getInstance();
      const hashtagTweets = await withRetry(
        async () => fetchHashtagTweets(hashtag, instance, config.twitter.min_likes),
        { maxAttempts: 2, initialDelay: 1000 }
      );
      tweets.push(...hashtagTweets);
      logger.info(`✅ #${hashtag}: ${hashtagTweets.length} tweets`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`⚠️ Hashtag #${hashtag} fetch failed`, { error: errorMsg });
    }
    await randomDelay(2000, 4000);
  }

  // Remove duplicates and apply limit
  const uniqueTweets = removeDuplicates(tweets);
  const limited = uniqueTweets.slice(0, config.news.max_tweets);

  logger.info(`📊 Twitter total: ${limited.length} unique tweets`);

  return {
    data: limited,
    errors,
    source: ContentSource.TWITTER,
  };
}

async function fetchAccountTweets(
  account: string,
  instance: string,
  minLikes: number
): Promise<Tweet[]> {
  const url = `${instance}/${account}`;
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  const $ = cheerio.load(response.data);
  const tweets: Tweet[] = [];

  $('.timeline-item').each((_, element) => {
    try {
      const $item = $(element);

      // Extract tweet link
      const tweetLink = $item.find('.tweet-link').attr('href');
      if (!tweetLink) return;

      // Extract date
      const dateAttr = $item.find('.tweet-date a').attr('title');
      const publishedAt = parseDate(dateAttr);
      if (!publishedAt || !isWithinLast24Hours(publishedAt)) return;

      // Extract content
      const contentElement = $item.find('.tweet-content');
      const text = contentElement.text().trim();
      if (!text) return;

      // Extract engagement
      const statsText = $item.find('.tweet-stats').text();
      const likes = extractNumber(statsText, 'likes') || 0;
      const retweets = extractNumber(statsText, 'retweets') || 0;
      const replies = extractNumber(statsText, 'replies') || 0;

      if (likes < minLikes) return;

      // Extract author info
      const authorName = $item.find('.fullname').text().trim();
      const handle = $item.find('.username').text().trim().replace('@', '');

      tweets.push({
        id: `tw-${tweetLink.split('/').pop() || Date.now()}`,
        title: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        url: `${instance}${tweetLink}`,
        source: ContentSource.TWITTER,
        sourceName: 'Twitter/X',
        publishedAt,
        category: ContentCategory.SOCIAL,
        relevanceScore: 0,
        authorName,
        handle: handle || account,
        text,
        likes,
        retweets,
        replies,
        mentionedUrls: extractUrls(text),
      });
    } catch (err) {
      // Skip malformed items
    }
  });

  return tweets;
}

async function fetchHashtagTweets(
  hashtag: string,
  instance: string,
  minLikes: number
): Promise<Tweet[]> {
  const url = `${instance}/search?f=tweets&q=%23${hashtag}`;
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  const $ = cheerio.load(response.data);
  const tweets: Tweet[] = [];

  $('.timeline-item').each((_, element) => {
    try {
      const $item = $(element);

      const tweetLink = $item.find('.tweet-link').attr('href');
      if (!tweetLink) return;

      const dateAttr = $item.find('.tweet-date a').attr('title');
      const publishedAt = parseDate(dateAttr);
      if (!publishedAt || !isWithinLast24Hours(publishedAt)) return;

      const contentElement = $item.find('.tweet-content');
      const text = contentElement.text().trim();
      if (!text) return;

      const statsText = $item.find('.tweet-stats').text();
      const likes = extractNumber(statsText, 'likes') || 0;

      if (likes < minLikes) return;

      const authorName = $item.find('.fullname').text().trim();
      const handle = $item.find('.username').text().trim().replace('@', '');

      tweets.push({
        id: `tw-${tweetLink.split('/').pop() || Date.now()}`,
        title: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        url: `${instance}${tweetLink}`,
        source: ContentSource.TWITTER,
        sourceName: 'Twitter/X',
        publishedAt,
        category: ContentCategory.SOCIAL,
        relevanceScore: 0,
        authorName,
        handle,
        text,
        likes,
        retweets: extractNumber(statsText, 'retweets') || 0,
        replies: extractNumber(statsText, 'replies') || 0,
        mentionedUrls: extractUrls(text),
      });
    } catch (err) {
      // Skip malformed items
    }
  });

  return tweets;
}

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function isWithinLast24Hours(date: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= 24;
}

function extractNumber(text: string, label: string): number {
  const regex = new RegExp(`([\\d,]+)\\s*${label}`, 'i');
  const match = text.match(regex);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return 0;
}

function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

function removeDuplicates(tweets: Tweet[]): Tweet[] {
  const seen = new Set<string>();
  return tweets.filter(tweet => {
    const text = tweet.text.toLowerCase().trim();
    if (seen.has(text)) {
      return false;
    }
    seen.add(text);
    return true;
  });
}
