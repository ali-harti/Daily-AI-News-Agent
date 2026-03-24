/**
 * Configuration loader and validator
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import { Config } from './types';
import { createLogger } from './utils/logger';

const logger = createLogger('Config');

const configSchema = z.object({
  schedule: z.object({
    send_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format, expected HH:MM'),
    timezone: z.string(),
  }),
  news: z.object({
    newsapi_key: z.string(),
    max_articles: z.number().min(1).max(100),
    max_videos: z.number().min(1).max(50),
    max_tweets: z.number().min(1).max(50),
    max_linkedin: z.number().min(1).max(50),
    max_instagram: z.number().min(1).max(50),
    min_relevance_score: z.number().min(0).max(10),
    groq_api_key: z.string().optional(),
  }),
  youtube: z.object({
    enabled: z.boolean(),
    api_key: z.string(),
    max_results_per_search: z.number().min(0).max(50),
    channels: z.array(z.string()),
  }),
  twitter: z.object({
    enabled: z.boolean(),
    use_nitter: z.boolean(),
    nitter_instances: z.array(z.string()),
    accounts: z.array(z.string()),
    hashtags: z.array(z.string()),
    min_likes: z.number().min(0),
  }),
  linkedin: z.object({
    enabled: z.boolean(),
    companies: z.array(z.string()),
  }),
  instagram: z.object({
    enabled: z.boolean(),
    accounts: z.array(z.string()),
  }),
  telegram: z.object({
    enabled: z.boolean(),
    bot_token: z.string(),
    chat_id: z.string(),
  }),
  storage: z.object({
    data_dir: z.string(),
    retention_days: z.number().min(1),
  }),
});

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPaths = [
    resolve(process.cwd(), 'config.json'),
    resolve(process.cwd(), 'config.local.json'),
    resolve(__dirname, '../config.json'),
  ];

  let configPath: string | null = null;
  for (const path of configPaths) {
    if (existsSync(path)) {
      configPath = path;
      break;
    }
  }

  if (!configPath) {
    throw new Error(
      'Configuration file not found. Please create config.json from the template.'
    );
  }

  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const parsedConfig = JSON.parse(configContent);

    // Override with environment variables if present
    const envOverrides = getEnvOverrides();
    const mergedConfig = mergeDeep(parsedConfig, envOverrides);

    const validatedConfig = configSchema.parse(mergedConfig);
    cachedConfig = validatedConfig;

    logger.info('✅ Configuration loaded successfully', { path: configPath });
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
      logger.error('❌ Configuration validation failed:', { issues });
      throw new Error(`Invalid configuration:\n${issues}`);
    }
    throw error;
  }
}

function getEnvOverrides(): Partial<Config> {
  const overrides: any = {};

  if (process.env.NEWSAPI_KEY) {
    overrides.news ??= {};
    overrides.news.newsapi_key = process.env.NEWSAPI_KEY;
  }

  if (process.env.YOUTUBE_API_KEY) {
    overrides.youtube ??= {};
    overrides.youtube.api_key = process.env.YOUTUBE_API_KEY;
  }

  if (process.env.GROQ_API_KEY) {
    overrides.news ??= {};
    overrides.news.groq_api_key = process.env.GROQ_API_KEY;
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    overrides.telegram ??= {};
    overrides.telegram.bot_token = process.env.TELEGRAM_BOT_TOKEN;
  }

  if (process.env.TELEGRAM_CHAT_ID) {
    overrides.telegram ??= {};
    overrides.telegram.chat_id = process.env.TELEGRAM_CHAT_ID;
  }


  return overrides;
}

function mergeDeep(target: any, source: any): any {
  const output = Object.assign({}, target);

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }

  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function validateRequiredSecrets(config: Config): string[] {
  const errors: string[] = [];

  if (config.news.newsapi_key === 'YOUR_NEWSAPI_KEY') {
    errors.push('NewsAPI key is not configured. Get free key at: https://newsapi.org/register');
  }

  if (config.youtube.enabled && config.youtube.api_key === 'YOUR_YOUTUBE_API_KEY') {
    errors.push('YouTube API key is not configured. Get free key at: https://console.cloud.google.com');
  }

  if (config.telegram.enabled) {
    if (config.telegram.bot_token === 'YOUR_BOT_TOKEN') {
      errors.push('Telegram bot token is not configured. Create bot with @BotFather');
    }
    if (config.telegram.chat_id === 'YOUR_CHAT_ID') {
      errors.push('Telegram chat ID is not configured. Get it from @userinfobot');
    }
  }

  return errors;
}
