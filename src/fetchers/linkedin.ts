
/**
 * LinkedIn Company Posts Scraper
 * Uses Puppeteer to scrape public company posts
 * Note: LinkedIn may require login for full content access
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { LinkedInPost, ContentSource, ContentCategory, FetchResult } from '../types';
import { loadConfig } from '../config';
import { createLogger } from '../utils/logger';
import { withRetry, randomDelay, sleep } from '../utils/retry';

const logger = createLogger('LinkedIn');

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export async function fetchLinkedIn(): Promise<FetchResult<LinkedInPost>> {
  const config = loadConfig();
  const posts: LinkedInPost[] = [];
  const errors: string[] = [];

  if (!config.linkedin.enabled) {
    logger.warn('⚠️ LinkedIn disabled, skipping');
    return { data: [], errors: ['LinkedIn disabled'], source: ContentSource.LINKEDIN };
  }

  logger.info('📡 Fetching LinkedIn posts...');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
    });

    const page = await browser.newPage();

    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    for (const company of config.linkedin.companies) {
      try {
        const companyPosts = await withRetry(
          async () => scrapeCompanyPosts(page, company),
          { maxAttempts: 2, initialDelay: 3000 }
        );
        posts.push(...companyPosts);
        logger.info(`✅ LinkedIn ${company}: ${companyPosts.length} posts`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Failed to scrape LinkedIn ${company}`, { error: errorMsg });
        errors.push(`${company}: ${errorMsg}`);
      }

      await randomDelay(3000, 6000);
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('❌ LinkedIn browser initialization failed', { error: errorMsg });
    errors.push(`Browser init: ${errorMsg}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Remove duplicates and apply limit
  const uniquePosts = removeDuplicates(posts);
  const limited = uniquePosts.slice(0, config.news.max_linkedin);

  logger.info(`📊 LinkedIn total: ${limited.length} unique posts`);

  return {
    data: limited,
    errors,
    source: ContentSource.LINKEDIN,
  };
}

async function scrapeCompanyPosts(
  page: any,
  company: string
): Promise<LinkedInPost[]> {
  const url = `https://www.linkedin.com/company/${company}/posts`;
  const posts: LinkedInPost[] = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for posts to load
    await page.waitForSelector('.update-components-actor__container, .feed-shared-update-v2, .main-content', {
      timeout: 30000,
    });

    // Scroll to load more posts
    await scrollPage(page, 3);

    // Extract posts
    const postElements = await page.$$eval(
      '.feed-shared-update-v2, .update-components-text',
      (elements: Element[]) => {
        return elements.map((el: Element) => {
          // Try to find the closest post container
          const container = el.closest('.feed-shared-update-v2') || el;

          // Get text content
          const textEl = container.querySelector('.break-words, .feed-shared-text');
          const text = textEl?.textContent?.trim() || '';

          // Get author
          const authorEl = container.querySelector('.update-components-actor__name');
          const author = authorEl?.textContent?.trim() || '';

          // Get timestamp
          const timeEl = container.querySelector('time');
          const timestamp = timeEl?.getAttribute('datetime') || '';

          // Get engagement
          const engagementEl = container.querySelector('.social-details-social-counts__reactions-count');
          const likes = engagementEl?.textContent?.replace(/[^\d]/g, '') || '0';

          // Get post link
          const linkEl = container.querySelector('a[href*="/feed/update/"]');
          const link = linkEl?.getAttribute('href') || '';

          return { text, author, timestamp, likes, link };
        });
      }
    );

    for (const element of postElements) {
      try {
        const publishedAt = element.timestamp ? new Date(element.timestamp) : null;
        if (!publishedAt || !isWithinLast24Hours(publishedAt)) continue;
        if (!element.text) continue;

        const postUrl = element.link.startsWith('http')
          ? element.link
          : `https://www.linkedin.com${element.link}`;

        posts.push({
          id: `li-${Buffer.from(postUrl).toString('base64').substring(0, 20)}`,
          title: element.text.substring(0, 100) + (element.text.length > 100 ? '...' : ''),
          url: postUrl,
          source: ContentSource.LINKEDIN,
          sourceName: 'LinkedIn',
          publishedAt,
          category: ContentCategory.SOCIAL,
          relevanceScore: 0,
          companyName: element.author || company,
          content: element.text,
          likes: parseInt(element.likes, 10) || 0,
        });
      } catch (err) {
        // Skip malformed items
      }
    }

  } catch (error) {
    logger.warn(`⚠️ LinkedIn scrape failed for ${company}, may require login or be blocked`);
    
    // Diagnostic screenshot
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = `data/logs/debug/linkedin-${company}-${timestamp}.png`;
      await page.screenshot({ path: screenshotPath });
      logger.info(`📸 Diagnostic screenshot saved: ${screenshotPath}`);
    } catch (e) {
      // Ignore screenshot failure
    }
    
    throw error;
  }

  return posts;
}

async function scrollPage(page: any, times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await sleep(1500);
  }
}

function isWithinLast24Hours(date: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= 24;
}

function removeDuplicates(posts: LinkedInPost[]): LinkedInPost[] {
  const seen = new Set<string>();
  return posts.filter(post => {
    const url = post.url.toLowerCase().trim();
    if (seen.has(url)) {
      return false;
    }
    seen.add(url);
    return true;
  });
}
