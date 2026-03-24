/**
 * Telegram Message Sender
 * Formats and sends daily news digests to a Telegram channel/chat
 */
import axios from 'axios';
import { DailyDigest, ContentCategory } from '../types';
import { loadConfig } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('Telegram');

export async function sendTelegramDigest(digest: DailyDigest): Promise<boolean> {
  const config = loadConfig();
  if (!config.telegram.enabled) {
    logger.warn('⚠️ Telegram disabled, skipping');
    return false;
  }

  const token = config.telegram.bot_token;
  const chatId = config.telegram.chat_id;

  if (token === 'YOUR_BOT_TOKEN' || chatId === 'YOUR_CHAT_ID') {
    logger.error('❌ Telegram bot token or chat ID not configured');
    return false;
  }

  const message = digest.fullBriefing 
    ? digest.fullBriefing 
    : formatDigest(digest);
    
  const chunks = splitMessage(message);

  let success = true;
  for (const chunk of chunks) {
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('❌ Failed to send Telegram chunk', { error: errorMsg });
      success = false;
    }
  }

  return success;
}

function formatDigest(digest: DailyDigest): string {
  const dateStr = new Date(digest.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  let message = `🚀 <b>AI DAILY NEWS AGENT</b> 🤖\n`;
  message += `📅 <i>${dateStr}</i>\n\n`;
  message += `📊 <b>Today's Summary:</b>\n`;
  message += `   • Total items: ${digest.summary.total}\n`;
  message += `   • Articles: ${digest.summary.articles}\n`;
  message += `   • Videos: ${digest.summary.videos}\n`;
  message += `   • Social posts: ${digest.summary.tweets + digest.summary.linkedin}\n\n`;

  // Top Stories Section
  if (digest.topStories.length > 0) {
    message += `🔥 <b>TOP STORIES:</b>\n`;
    digest.topStories.slice(0, 3).forEach((item, index) => {
      message += `${index + 1}. <a href="${item.url}"><b>${escapeHtml(item.title)}</b></a>\n`;
      if (item.summary) {
        message += `${escapeHtml(item.summary)}\n`;
      }
      message += `\n`;
    });
  }

  // Categories Section
  const categoryOrder = [
    ContentCategory.BREAKING,
    ContentCategory.RESEARCH,
    ContentCategory.TOOLS,
    ContentCategory.TUTORIALS,
    ContentCategory.BUSINESS,
    ContentCategory.VIDEOS,
    ContentCategory.SOCIAL,
  ];

  for (const category of categoryOrder) {
    const items = digest.byCategory[category];
    if (items && items.length > 0) {
      message += `⚡ <b>${category}:</b>\n`;
      items.slice(0, 5).forEach(item => {
        message += `• <a href="${item.url}"><b>${escapeHtml(item.title)}</b></a>\n`;
        if (item.summary) {
          message += `<i>${escapeHtml(item.summary)}</i>\n`;
        }
        message += `\n`;
      });
    }
  }

  message += `\n<i>Powered by AI News Agent (Social Edition)</i>`;
  return message;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Telegram has 4096 character limit per message
function splitMessage(message: string, limit: number = 4000): string[] {
  if (message.length <= limit) return [message];

  const chunks: string[] = [];
  let currentChunk = '';
  const lines = message.split('\n');

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > limit) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    currentChunk += (currentChunk ? '\n' : '') + line;
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}
