/**
 * NewsAPI Fetcher
 * Free tier: 100 requests/day
 * https://newsapi.org/
 */
import axios from 'axios';
import { Article, ContentSource, ContentCategory, FetchResult } from '../types';
import { loadConfig } from '../config';
import { createLogger } from '../utils/logger';
import { withRetry } from '../utils/retry';

const logger = createLogger('NewsAPI');
const BASE_URL = 'https://newsapi.org/v2';

// AI-related search queries
const QUERIES = [
  '"artificial intelligence" OR "AI model" OR "LLM"',
  '"Claude" OR "GPT" OR "Gemini" OR "Llama" OR "AI agent"',
];

export async function fetchNewsAPI(): Promise<FetchResult<Article>> {
  const config = loadConfig();
  const articles: Article[] = [];
  const errors: string[] = [];

  // Skip if not properly configured
  if (config.news.newsapi_key === 'YOUR_NEWSAPI_KEY') {
    logger.warn('⚠️ NewsAPI key not configured, skipping');
    return { data: [], errors: ['NewsAPI key not configured'], source: ContentSource.NEWSAPI };
  }

  logger.info('📡 Fetching NewsAPI...');

  // Calculate date for last 24 hours
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 1);
  const fromString = fromDate.toISOString().split('T')[0];

  for (const query of QUERIES) {
    try {
      const result = await withRetry(
        async () => fetchQuery(query, fromString, config.news.newsapi_key),
        { maxAttempts: 3, initialDelay: 1000 }
      );

      if (result.articles) {
        const queryArticles: Article[] = result.articles
          .map(parseArticle)
          .filter((a: Article | null): a is Article => a !== null);
        articles.push(...queryArticles);
        logger.info(`✅ NewsAPI query "${query}": ${queryArticles.length} articles`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ NewsAPI query failed: ${query}`, { error: errorMsg });
      errors.push(`Query "${query}": ${errorMsg}`);
    }
  }

  // Remove duplicates by URL
  const uniqueArticles = removeDuplicates(articles);

  // Limit to max_articles
  const limited = uniqueArticles.slice(0, config.news.max_articles);

  logger.info(`📊 NewsAPI total: ${limited.length} unique articles`);

  return {
    data: limited,
    errors,
    source: ContentSource.NEWSAPI,
  };
}

async function fetchQuery(query: string, from: string, apiKey: string) {
  const response = await axios.get(`${BASE_URL}/everything`, {
    params: {
      q: query,
      from,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: 20,
      apiKey,
    },
    timeout: 30000,
  });

  return response.data;
}

function parseArticle(item: any): Article | null {
  if (!item.url || !item.title) return null;

  return {
    id: `newsapi-${item.url}`,
    title: item.title,
    url: item.url,
    source: ContentSource.NEWSAPI,
    sourceName: item.source?.name || 'NewsAPI',
    publishedAt: new Date(item.publishedAt),
    category: ContentCategory.OTHER,
    relevanceScore: 0,
    description: item.description || undefined,
    excerpt: item.description?.substring(0, 300) || undefined,
    author: item.author || undefined,
  };
}

function removeDuplicates(articles: Article[]): Article[] {
  const seen = new Set<string>();
  return articles.filter(article => {
    const url = article.url.toLowerCase().trim();
    if (seen.has(url)) {
      return false;
    }
    seen.add(url);
    return true;
  });
}
