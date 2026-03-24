/**
 * Content Categorizer
 * Infers category of a content item based on text Analysis and source
 */
import { ContentItem, ContentCategory } from '../types';

const BREAKING_KEYWORDS = [
  'BREAKING',
  'released',
  'unveils',
  'announcing',
  'new model',
  'gpt-5',
  'claude 4',
  'llama 3.2',
  'openai o1',
  'google gemini 2.0',
  'deepseek-v3',
];

const TOOLS_KEYWORDS = [
  'api',
  'sdk',
  'platform',
  'release',
  'updates',
  'dev',
  'developer',
  'integration',
  'framework',
  'open-source',
  'github',
];

const RESEARCH_KEYWORDS = [
  'paper',
  'arxiv',
  'research',
  'benchmark',
  'technical report',
  'experiment',
  'performance',
  'dataset',
  'evals',
  'evaluation',
];

const BUSINESS_KEYWORDS = [
  'funding',
  'acquisition',
  'raise',
  'capital',
  'ipo',
  'partner',
  'investment',
  'series',
  'revenue',
  'lawsuit',
  'regulation',
  'policy',
];

const TUTORIALS_KEYWORDS = [
  'tutorial',
  'guide',
  'how to',
  'best practices',
  'finetuning',
  'rag',
  'walkthrough',
  'setup',
  'explained',
];

export function categorize(item: ContentItem): ContentCategory {
  const content = (item as any).content || '';
  const text = `${item.title} ${item.description || ''} ${content}`.toLowerCase();

  // 1. Source-based categorization (overridden if keywords are strong)
  if (item.source === 'YOUTUBE') return ContentCategory.VIDEOS;
  if (item.source === 'TWITTER' || item.source === 'LINKEDIN' || item.source === 'INSTAGRAM') {
    return ContentCategory.SOCIAL;
  }

  // 2. Keyword-based matching
  if (BREAKING_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return ContentCategory.BREAKING;
  if (TUTORIALS_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return ContentCategory.TUTORIALS;
  if (RESEARCH_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return ContentCategory.RESEARCH;
  if (BUSINESS_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return ContentCategory.BUSINESS;
  if (TOOLS_KEYWORDS.some(k => text.includes(k.toLowerCase()))) return ContentCategory.TOOLS;

  // Final fallback
  return ContentCategory.OTHER;
}

export function autoCategorize(items: ContentItem[]): ContentItem[] {
  return items.map(item => ({
    ...item,
    category: categorize(item)
  }));
}
