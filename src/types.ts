/**
 * Core types and interfaces for AI News Agent
 */

export enum ContentCategory {
  BREAKING = 'BREAKING',
  TOOLS = 'TOOLS',
  RESEARCH = 'RESEARCH',
  BUSINESS = 'BUSINESS',
  VIDEOS = 'VIDEOS',
  SOCIAL = 'SOCIAL',
  TUTORIALS = 'TUTORIALS',
  OTHER = 'OTHER'
}

export enum ContentSource {
  RSS = 'RSS',
  NEWSAPI = 'NEWSAPI',
  YOUTUBE = 'YOUTUBE',
  TWITTER = 'TWITTER',
  LINKEDIN = 'LINKEDIN',
  INSTAGRAM = 'INSTAGRAM'
}

export interface BaseContent {
  id: string;
  title: string;
  url: string;
  source: ContentSource;
  sourceName: string;
  publishedAt: Date;
  category: ContentCategory;
  relevanceScore: number;
  description?: string;
  imageUrl?: string;
  summary?: string;
}

export interface Article extends BaseContent {
  author?: string;
  content?: string;
  excerpt?: string;
}

export interface Video extends BaseContent {
  channelName: string;
  channelId?: string;
  duration?: string;
  viewCount: number;
  likeCount?: number;
  thumbnailUrl?: string;
}

export interface Tweet extends BaseContent {
  authorName: string;
  handle: string;
  text: string;
  likes: number;
  retweets: number;
  replies?: number;
  mentionedUrls?: string[];
}

export interface LinkedInPost extends BaseContent {
  companyName: string;
  content: string;
  likes: number;
  comments?: number;
}

export interface InstagramPost extends BaseContent {
  caption: string;
  likes: number;
  mediaType?: 'image' | 'video' | 'carousel';
}

export type ContentItem = Article | Video | Tweet | LinkedInPost | InstagramPost;

export interface DailyDigest {
  date: string;
  summary: {
    total: number;
    articles: number;
    videos: number;
    tweets: number;
    linkedin: number;
    instagram: number;
  };
  topStories: ContentItem[];
  byCategory: Record<ContentCategory, ContentItem[]>;
  fullBriefing?: string;
}

export interface FetchResult<T> {
  data: T[];
  errors: string[];
  source: ContentSource;
}

export interface Config {
  schedule: {
    send_time: string;
    timezone: string;
  };
  news: {
    newsapi_key: string;
    max_articles: number;
    max_videos: number;
    max_tweets: number;
    max_linkedin: number;
    max_instagram: number;
    min_relevance_score: number;
    groq_api_key?: string;
  };
  youtube: {
    enabled: boolean;
    api_key: string;
    max_results_per_search: number;
    channels: string[];
  };
  twitter: {
    enabled: boolean;
    use_nitter: boolean;
    nitter_instances: string[];
    accounts: string[];
    hashtags: string[];
    min_likes: number;
  };
  linkedin: {
    enabled: boolean;
    companies: string[];
  };
  instagram: {
    enabled: boolean;
    accounts: string[];
  };
  telegram: {
    enabled: boolean;
    bot_token: string;
    chat_id: string;
  };
  storage: {
    data_dir: string;
    retention_days: number;
  };
}

export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}
