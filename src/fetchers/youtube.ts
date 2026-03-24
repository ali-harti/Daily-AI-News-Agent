/**
 * YouTube Data API v3 Fetcher
 * Free quota: 10,000 units/day
 * https://console.cloud.google.com
 */
import axios from 'axios';
import { Video, ContentSource, ContentCategory, FetchResult } from '../types';
import { loadConfig } from '../config';
import { createLogger } from '../utils/logger';
import { withRetry } from '../utils/retry';

const logger = createLogger('YouTube');
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Search keywords for AI-related content
const SEARCH_QUERIES = [
  'AI news today',
  'new AI model released',
  'AI tutorial 2025',
  'LLM breakthrough',
];

export async function fetchYouTube(): Promise<FetchResult<Video>> {
  const config = loadConfig();
  const videos: Video[] = [];
  const errors: string[] = [];

  if (!config.youtube.enabled || config.youtube.api_key === 'YOUR_YOUTUBE_API_KEY') {
    logger.warn('⚠️ YouTube disabled or API key not configured, skipping');
    return { data: [], errors: ['YouTube not configured'], source: ContentSource.YOUTUBE };
  }

  logger.info('📡 Fetching YouTube videos...');

  const apiKey = config.youtube.api_key;

  // Fetch from monitored channels
  if (config.youtube.channels.length > 0) {
    for (const channelId of config.youtube.channels) {
      try {
        const channelVideos = await withRetry(
          async () => fetchChannelVideos(channelId, apiKey, Math.max(config.youtube.max_results_per_search, 5)),
          { maxAttempts: 3, initialDelay: 1000 }
        );
        videos.push(...channelVideos);
        logger.info(`✅ YouTube channel ${channelId}: ${channelVideos.length} videos`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ Failed to fetch YouTube channel: ${channelId}`, { error: errorMsg });
        errors.push(`Channel ${channelId}: ${errorMsg}`);
      }
    }
  }

  // Fetch from keyword searches
  if (config.youtube.max_results_per_search > 0) {
    for (const query of SEARCH_QUERIES) {
      try {
        const searchVideos = await withRetry(
          async () => fetchSearchVideos(query, apiKey, config.youtube.max_results_per_search),
          { maxAttempts: 3, initialDelay: 1000 }
        );
        videos.push(...searchVideos);
        logger.info(`✅ YouTube search "${query}": ${searchVideos.length} videos`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`❌ YouTube search failed: ${query}`, { error: errorMsg });
        errors.push(`Search "${query}": ${errorMsg}`);
      }
    }
  }

  // Remove duplicates and filter to last 24h
  const uniqueVideos = removeDuplicates(videos);
  const recentVideos = uniqueVideos.filter(v => isWithinLast24Hours(v.publishedAt));
  const limited = recentVideos.slice(0, config.news.max_videos);

  logger.info(`📊 YouTube total: ${limited.length} unique videos`);

  return {
    data: limited,
    errors,
    source: ContentSource.YOUTUBE,
  };
}

async function fetchChannelVideos(channelId: string, apiKey: string, maxResults: number): Promise<Video[]> {
  // Get uploads playlist ID
  const channelResponse = await axios.get(`${BASE_URL}/channels`, {
    params: {
      part: 'contentDetails',
      id: channelId,
      key: apiKey,
    },
    timeout: 30000,
  });

  const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    return [];
  }

  // Get videos from uploads playlist
  const playlistResponse = await axios.get(`${BASE_URL}/playlistItems`, {
    params: {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults,
      key: apiKey,
    },
    timeout: 30000,
  });

  const items = playlistResponse.data.items || [];
  const videoIds = items.map((item: any) => item.contentDetails?.videoId).filter(Boolean);

  if (videoIds.length === 0) {
    return [];
  }

  // Get video details (duration, stats)
  const videoResponse = await axios.get(`${BASE_URL}/videos`, {
    params: {
      part: 'snippet,contentDetails,statistics',
      id: videoIds.join(','),
      key: apiKey,
    },
    timeout: 30000,
  });

  return (videoResponse.data.items || [])
    .map(parseVideo)
    .filter((v: Video | null): v is Video => v !== null);
}

async function fetchSearchVideos(query: string, apiKey: string, maxResults: number): Promise<Video[]> {
  // Calculate publishedAfter (24 hours ago)
  const publishedAfter = new Date();
  publishedAfter.setDate(publishedAfter.getDate() - 1);

  const searchResponse = await axios.get(`${BASE_URL}/search`, {
    params: {
      part: 'snippet',
      q: query,
      type: 'video',
      order: 'date',
      publishedAfter: publishedAfter.toISOString(),
      maxResults,
      key: apiKey,
    },
    timeout: 30000,
  });

  const items = searchResponse.data.items || [];
  const videoIds = items.map((item: any) => item.id?.videoId).filter(Boolean);

  if (videoIds.length === 0) {
    return [];
  }

  // Get full video details
  const videoResponse = await axios.get(`${BASE_URL}/videos`, {
    params: {
      part: 'snippet,contentDetails,statistics',
      id: videoIds.join(','),
      key: apiKey,
    },
    timeout: 30000,
  });

  return (videoResponse.data.items || [])
    .map(parseVideo)
    .filter((v: Video | null): v is Video => v !== null);
}

function parseVideo(item: any): Video | null {
  if (!item.id) return null;

  const snippet = item.snippet || {};
  const statistics = item.statistics || {};
  const contentDetails = item.contentDetails || {};

  return {
    id: `yt-${item.id}`,
    title: snippet.title || 'Untitled',
    url: `https://www.youtube.com/watch?v=${item.id}`,
    source: ContentSource.YOUTUBE,
    sourceName: 'YouTube',
    publishedAt: new Date(snippet.publishedAt || Date.now()),
    category: ContentCategory.VIDEOS,
    relevanceScore: 0,
    channelName: snippet.channelTitle || 'Unknown',
    channelId: snippet.channelId,
    duration: formatDuration(contentDetails.duration),
    viewCount: parseInt(statistics.viewCount || '0', 10),
    likeCount: statistics.likeCount ? parseInt(statistics.likeCount, 10) : undefined,
    thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
    description: snippet.description?.substring(0, 300),
  };
}

function formatDuration(isoDuration: string | undefined): string | undefined {
  if (!isoDuration) return undefined;

  // Parse PT1H2M3S format
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function isWithinLast24Hours(date: Date): boolean {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= 24;
}

function removeDuplicates(videos: Video[]): Video[] {
  const seen = new Set<string>();
  return videos.filter(video => {
    const id = video.id;
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}
