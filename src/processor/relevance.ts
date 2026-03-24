/**
 * Content Relevance Scorer
 * Scores content items based on keywords, recency, and performance metrics
 */
import { ContentItem, ContentCategory } from '../types';
import { loadConfig } from '../config';

const AI_KEYWORDS = [
  { term: 'openai', weight: 1.5 },
  { term: 'anthropic', weight: 1.5 },
  { term: 'claude', weight: 1.5 },
  { term: 'gpt-4o', weight: 1.5 },
  { term: 'gemini', weight: 1.5 },
  { term: 'llama', weight: 1.5 },
  { term: 'llm', weight: 1.2 },
  { term: 'foundation model', weight: 1.5 },
  { term: 'generative ai', weight: 1.0 },
  { term: 'transformer', weight: 1.2 },
  { term: 'open-source', weight: 1.0 },
  { term: 'gpu', weight: 0.8 },
  { term: 'nvidia', weight: 1.2 },
  { term: 'h100', weight: 1.8 },
  { term: 'benchmarks', weight: 1.0 },
  { term: 'agentic', weight: 2.0 },
  { term: 'paper', weight: 1.5 },
  { term: 'research', weight: 1.5 },
  { term: 'architecture', weight: 1.2 },
];

const CLICKBAIT_KEYWORDS = [
  'revealed',
  'shocking',
  'unbelievable',
  'omg',
  'mind-blowing',
  'gpt-5', // GPT-5 doesn't exist yet, usually clickbait
  'gpt-6',
  'is here',
  'finally',
  'exposed',
  'destroy',
  'game over',
  'huge news',
  'urgent',
  '!!',
  '🤯',
  '🚀',
  '🔥'
];

export function calculateRelevance(item: ContentItem): number {
  const content = (item as any).content || '';
  const text = `${item.title} ${item.description || ''} ${content}`.toLowerCase();
  let score = 0;

  // 1. Keyword-based matching
  for (const { term, weight } of AI_KEYWORDS) {
    if (text.includes(term.toLowerCase())) {
      score += weight;
    }
  }

  // 2. Clickbait penalty
  let clickbaitCount = 0;
  for (const term of CLICKBAIT_KEYWORDS) {
    if (text.includes(term.toLowerCase())) {
      clickbaitCount++;
    }
  }
  
  if (clickbaitCount > 0) {
    score -= clickbaitCount * 0.5;
  }

  // 3. Reliable source boost
  if (item.source === 'NEWSAPI' || item.source === 'RSS') {
    score += 1.5;
  }

  // 4. Platform-specific checks
  if (item.source === 'YOUTUBE') {
    const video = item as any;
    // Penalize shorts or very short titles
    if (item.title.toLowerCase().includes('#shorts') || item.title.length < 20) {
      score -= 2.0;
    }

    // Boost highly viewed videos (only if not clickbaity)
    if (video.viewCount > 100000) score += 1.0;
  }

  // 5. Recency boost
  const hoursOld = (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60);
  if (hoursOld < 6) score += 1.0;
  else if (hoursOld < 12) score += 0.5;

  // 6. Category checks
  if (item.category === ContentCategory.BREAKING) score *= 1.2;

  return score;
}

export function filterByRelevance(items: ContentItem[]): ContentItem[] {
  const config = loadConfig();
  const threshold = config.news.min_relevance_score || 0.5;

  return items
    .map(item => ({
      ...item,
      relevanceScore: calculateRelevance(item)
    }))
    .filter(item => item.relevanceScore >= threshold)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
