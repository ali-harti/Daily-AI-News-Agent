/**
 * RSS Feed Fetcher
 * Fetches from 10 major AI news sources
 */
import Parser from 'rss-parser';
import { Article, ContentSource, ContentCategory, FetchResult } from '../types';
import { createLogger } from '../utils/logger';
import { withRetry, randomDelay } from '../utils/retry';

const logger = createLogger('RSS');

// RSS Feed URLs
const RSS_FEEDS = [
  // Tier 1 — Institutional
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch AI' },
  { url: 'https://feeds.feedburner.com/venturebeat/SZYF', name: 'VentureBeat' },
  { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', name: 'MIT Tech Review' },
  { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge' },
  
  // Tier 2 — Best Newsletters
  { url: 'https://importai.substack.com/feed', name: 'Import AI' },
  
  // Tier 3 — Direct Source
  { url: 'https://openai.com/blog/rss.xml', name: 'OpenAI Blog' },
  { url: 'http://export.arxiv.org/rss/cs.AI', name: 'arXiv cs.AI' },
];

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
    ],
  },
  timeout: 30000,
});

export async function fetchRSSFeeds(): Promise<FetchResult<Article>> {
  const articles: Article[] = [];
  const errors: string[] = [];

  logger.info('📡 Fetching RSS feeds...');

  for (const feed of RSS_FEEDS) {
    try {
      const result = await withRetry(
        async () => parser.parseURL(feed.url),
        { maxAttempts: 3, initialDelay: 2000 }
      );

      if (!result.items || result.items.length === 0) {
        logger.warn(`⚠️ No items in feed: ${feed.name}`);
        continue;
      }

      const feedArticles = result.items
        .filter(item => isWithinLast24Hours(item.pubDate || item.isoDate))
        .map(item => parseArticle(item, feed.name))
        .filter((a): a is Article => a !== null);

      articles.push(...feedArticles);
      logger.info(`✅ ${feed.name}: ${feedArticles.length} articles`);

      // Rate limiting between feeds
      await randomDelay(500, 1500);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Failed to fetch ${feed.name}`, { error: errorMsg });
      errors.push(`${feed.name}: ${errorMsg}`);
    }
  }

  logger.info(`📊 RSS total: ${articles.length} articles from ${RSS_FEEDS.length} feeds`);

  return {
    data: articles,
    errors,
    source: ContentSource.RSS,
  };
}

function parseArticle(item: Parser.Item, sourceName: string): Article | null {
  const pubDate = item.pubDate || item.isoDate;
  if (!pubDate) return null;

  const url = item.link || item.guid;
  if (!url) return null;

  return {
    id: `rss-${item.guid || url}`,
    title: item.title || 'Untitled',
    url: url,
    source: ContentSource.RSS,
    sourceName,
    publishedAt: new Date(pubDate),
    category: ContentCategory.OTHER,
    relevanceScore: 0,
    description: item.contentSnippet || item.content || undefined,
    excerpt: item.contentSnippet?.substring(0, 300) || undefined,
    author: (item as any).creator || (item as any).author || undefined,
  };
}

function isWithinLast24Hours(dateString?: string): boolean {
  if (!dateString) return false;

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours <= 24;
  } catch {
    return false;
  }
}

// Export for testing
export { RSS_FEEDS };
