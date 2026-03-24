/**
 * AI Daily News Agent - Social Edition
 * Main entry point with CLI and scheduler
 */
import { Command } from 'commander';
import cron from 'node-cron';
import { loadConfig, validateRequiredSecrets } from './config';
import { createLogger } from './utils/logger';
import { JsonDatabase, saveDigest } from './storage/json-db';
import { fetchRSSFeeds } from './fetchers/rss';
import { fetchNewsAPI } from './fetchers/newsapi';
import { fetchYouTube } from './fetchers/youtube';
import { fetchTwitter } from './fetchers/twitter';
import { fetchLinkedIn } from './fetchers/linkedin';
import { fetchInstagram } from './fetchers/instagram';
import { filterByRelevance } from './processor/relevance';
import { autoCategorize } from './processor/categorizer';
import { summarizeItems } from './processor/summarizer';
import { generateEliteBriefing } from './processor/briefing';
import { sendTelegramDigest } from './senders/telegram';
import {
  ContentItem,
  DailyDigest,
  ContentCategory,
  ContentSource,
} from './types';

const logger = createLogger('Main');
const program = new Command();

program
  .name('ai-news-agent')
  .description('AI Daily News Agent - Social Edition')
  .version('1.0.0');

program
  .command('start')
  .description('Start the scheduler')
  .action(() => {
    const config = loadConfig();
    const cronTime = `${config.schedule.send_time.split(':')[1]} ${config.schedule.send_time.split(':')[0]} * * *`;
    
    logger.info(`🕒 Scheduler started (${config.schedule.timezone}). Running at ${config.schedule.send_time} daily.`, {
      cron: cronTime,
    });

    cron.schedule(cronTime, async () => {
      logger.info('🔔 Scheduled task started');
      try {
        await runPipeline();
      } catch (error) {
        logger.error('❌ Pipeline failed:', { error });
      }
    }, {
      timezone: config.schedule.timezone,
    });
  });

program
  .command('fetch-now')
  .description('Run fetch pipeline immediately')
  .action(async () => {
    logger.info('🚀 Manual run started');
    try {
      await runPipeline();
    } catch (error) {
      logger.error('❌ Pipeline failed:', { error });
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Verify config and connection (no send)')
  .action(async () => {
    logger.info('🧪 Running connectivity test...');
    const config = loadConfig();
    const errors = validateRequiredSecrets(config);

    if (errors.length > 0) {
      logger.warn('⚠️ Found configuration issues:', { errors });
    } else {
      logger.info('✅ Configuration looks good');
    }

    // Try a simple NewsAPI call as test
    try {
      const newsApiResult = await fetchNewsAPI();
      logger.info(`📡 NewsAPI test: ${newsApiResult.data.length} articles, ${newsApiResult.errors.length} errors`);
    } catch (err) {
      logger.error('❌ NewsAPI test failed', { error: err });
    }
  });

async function runPipeline() {
  const config = loadConfig();
  const db = new JsonDatabase(config.storage.data_dir, config.storage.retention_days);
  
  // 1. Fetch from all sources in parallel
  logger.info('📡 Starting fetch phase...');
  const [rss, news, yt, twitter, linkedin, instagram] = await Promise.all([
    fetchRSSFeeds(),
    fetchNewsAPI(),
    fetchYouTube(),
    fetchTwitter(),
    fetchLinkedIn(),
    fetchInstagram(),
  ]);

  // Combine and log errors
  const allRawItems: ContentItem[] = [
    ...rss.data,
    ...news.data,
    ...yt.data,
    ...twitter.data,
    ...linkedin.data,
    ...instagram.data,
  ];

  const allErrors = [
    ...rss.errors,
    ...news.errors,
    ...yt.errors,
    ...twitter.errors,
    ...linkedin.errors,
    ...instagram.errors,
  ];

  if (allErrors.length > 0) {
    logger.warn(`⚠️ Fetching encountered ${allErrors.length} errors`, { allErrors });
  }

  // 2. Filter duplicates
  const filtered = allRawItems.filter(item => !db.isDuplicate(item.url));
  logger.info(`✨ Deduplication: ${allRawItems.length} -> ${filtered.length} new items`);

  if (filtered.length === 0) {
    logger.info('😴 No new items found today. Skipping digest.');
    return;
  }

  // 3. Score and filter by relevance
  const relevant = filterByRelevance(filtered);
  logger.info(`🎯 Relevance filter: ${filtered.length} -> ${relevant.length} relevant items`);

  if (relevant.length < 1) {
    logger.info(`⚠️ No relevant items found, waiting for more threshold. Pipeline stopped.`);
    return;
  }

  // 4. Categorize remaining items
  const categorized = autoCategorize(relevant);

  // 4.5. Elite AI Intelligence Briefing (using the elite prompt)
  const fullBriefing = await generateEliteBriefing(relevant.slice(0, 10));
  
  // Also keep item summaries as fallback or archive data
  const topForSummary = categorized.slice(0, 10);
  const others = categorized.slice(10);
  const summarized = await summarizeItems(topForSummary);
  const finalItems = [...summarized, ...others];

  // 5. Generate digest
  const today = new Date().toISOString().split('T')[0];
  const digest: DailyDigest = {
    date: today,
    summary: {
      total: finalItems.length,
      articles: finalItems.filter(i => i.source === ContentSource.RSS || i.source === ContentSource.NEWSAPI).length,
      videos: finalItems.filter(i => i.source === ContentSource.YOUTUBE).length,
      tweets: finalItems.filter(i => i.source === ContentSource.TWITTER).length,
      linkedin: finalItems.filter(i => i.source === ContentSource.LINKEDIN).length,
      instagram: finalItems.filter(i => i.source === ContentSource.INSTAGRAM).length,
    },
    topStories: finalItems.slice(0, 5),
    byCategory: {} as DailyDigest['byCategory'],
    fullBriefing,
  };

  // Group by category
  Object.values(ContentCategory).forEach(cat => {
    digest.byCategory[cat] = finalItems.filter(i => i.category === cat);
  });

  // 6. Send digest
  logger.info('✉️ Sending Telegram digest...');
  const success = await sendTelegramDigest(digest);

  if (success) {
    // 7. Persist only if sent successfully
    logger.info('💾 Persisting state and archiving digest...');
    db.addBatch(categorized);
    db.persist();
    saveDigest(digest, config.storage.data_dir);
    logger.info('🏁 Pipeline completed successfully!');
  } else {
    logger.error('❌ Pipeline failed at the sending phase');
  }
}

// Global error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', { reason, promise });
});

program.parse(process.argv);
