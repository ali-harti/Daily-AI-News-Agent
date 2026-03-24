/**
 * Instagram Public Scraper
 * Uses Puppeteer to scrape public profiles
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { InstagramPost, ContentSource, FetchResult } from '../types';
import { loadConfig } from '../config';
import { createLogger } from '../utils/logger';
import { withRetry, randomDelay } from '../utils/retry';

const logger = createLogger('Instagram');
puppeteer.use(StealthPlugin());

export async function fetchInstagram(): Promise<FetchResult<InstagramPost>> {
  const config = loadConfig();
  const posts: InstagramPost[] = [];
  const errors: string[] = [];

  if (!config.instagram.enabled) {
    logger.warn('⚠️ Instagram disabled, skipping');
    return { data: [], errors: ['Instagram disabled'], source: ContentSource.INSTAGRAM };
  }

  logger.info('📡 Fetching Instagram posts...');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    for (const account of config.instagram.accounts) {
      try {
        const accountPosts = await withRetry(
          async () => scrapeAccount(page, account),
          { maxAttempts: 2, initialDelay: 3000 }
        );
        posts.push(...accountPosts);
        logger.info(`✅ Instagram @${account}: ${accountPosts.length} posts`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Failed to scrape Instagram @${account}`, { error: errorMsg });
        errors.push(`@${account}: ${errorMsg}`);
      }
      await randomDelay(4000, 8000);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('❌ Instagram browser error', { error: errorMsg });
    errors.push(`Browser: ${errorMsg}`);
  } finally {
    if (browser) await browser.close();
  }

  return { data: posts, errors, source: ContentSource.INSTAGRAM };
}

async function scrapeAccount(page: any, account: string): Promise<InstagramPost[]> {
  const url = `https://www.instagram.com/${account}/`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // Basic implementation - in reality Instagram is very hard to scrape without login
  // This is a placeholder for public profile scraping logic
  return [];
}
