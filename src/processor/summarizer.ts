import Groq from 'groq-sdk';
import { ContentItem } from '../types';
import { loadConfig } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('Summarizer');

/**
 * Summarizes the content items using Google's Gemini AI
 * Aims for 3-4 concise phases each
 */
export async function summarizeItems(items: ContentItem[]): Promise<ContentItem[]> {
  const config = loadConfig();
  const apiKey = config.news.groq_api_key; 

  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
    logger.warn('⚠️ No Groq API key found, skipping AI summarization');
    return items;
  }

  const groq = new Groq({ apiKey });

  logger.info(`✨ Summarizing ${items.length} items...`);

  // We process them one-by-one to avoid rate limits on free tier, 
  // or in small chunks.
  const summarizedItems = [...items];

  for (let i = 0; i < summarizedItems.length; i++) {
    const item = summarizedItems[i];
    
    // Skip if we already have a long description (though user specifically wants 3-4 phrases)
    // Actually, user wants a fresh summary for all 9 news
    
    try {
      const prompt = `
        You are an AI news agent expert. Summarize the following news item in exactly 3 to 4 concise, high-impact bullet points.
        Focus on the significance for the AI industry and key technical details.
        
        Title: ${item.title}
        Source: ${item.sourceName}
        Description: ${item.description || 'No description available'}
        Category: ${item.category}
        
        Write only the bullet points.
      `;

      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
      });
      const summary = completion.choices[0]?.message?.content?.trim();
      
      if (summary) {
        summarizedItems[i].summary = summary;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      logger.error(`❌ Failed to summarize item: ${item.title}`, { error: errorMsg });
      summarizedItems[i].summary = item.description || '';
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return summarizedItems;
}
