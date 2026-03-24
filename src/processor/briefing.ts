import Groq from 'groq-sdk';
import { ContentItem } from '../types';
import { loadConfig } from '../config';
import { createLogger } from '../utils/logger';

const logger = createLogger('Briefing');

/**
 * Generates an Elite AI Intelligence Briefing using Gemini
 * Based on the collective set of news items
 */
export async function generateEliteBriefing(items: ContentItem[]): Promise<string> {
  const config = loadConfig();
  const apiKey = config.news.groq_api_key; 

  if (!apiKey || apiKey === 'YOUR_GROQ_API_KEY') {
    logger.warn('⚠️ No Groq API key found, cannot generate elite briefing');
    return 'Detailed briefing not available. Please add Groq API key.';
  }

  const groq = new Groq({ apiKey });

  // Prepare the context from news items (truncate descriptions heavily to prevent 413 Request Too Large)
  const newsContext = items.map(item => {
    const desc = item.description ? item.description.substring(0, 250) + '...' : 'No description';
    return `Source: ${item.sourceName}\nTitle: ${item.title}\nDescription: ${desc}\nURL: ${item.url}\n---`;
  }).join('\n');

  const prompt = `
    You are an elite AI intelligence analyst and strategic advisor.
    Your mission is to deliver a DAILY AI BRIEFING that is:
    - High-signal (no fluff, no repetition, no generic summaries)
    - Fact-based (only reliable, verified sources)
    - Actionable (focused on business, opportunities, and execution)

    You do NOT behave like a journalist.
    You think and write like a top AI founder and operator.
    The reader is a young entrepreneur building an AI automation agency, focused on SaaS and digital products.

    Use the following news items collected from approved sources to generate the DAILY AI BRIEFING.
    
    NEWS ITEMS:
    ${newsContext}

    FORMATTING RULES (STRICTLY ENFORCED):
    - DO NOT repeat my instructions (e.g., do not output "For each: Headline...").
    - DO NOT use markdown headers like ### or **. 
    - Use ONLY Telegram-supported HTML tags: <b>, <i>, and <a href="...">.

    FOLLOW THIS EXACT STRUCTURE FOR THE OUTPUT:

    <b>🚨 TOP AI NEWS</b>
    1. <b>[Headline]</b> - [Summary 1-2 sentences]. <i>Why it matters:</i> [Actionable reason]. <a href="[URL]">Source</a>
    (max 5 items)

    <b>⚡ KEY INSIGHTS</b>
    • [Insight 1 on emerging trends]
    • [Insight 2 on market shifts]
    • [Insight 3 for entrepreneurs]

    <b>💡 OPPORTUNITIES (CRITICAL)</b>
    • <b>[Title]</b>: [Description]. <i>Why now:</i> [Link to news]. <i>How to execute:</i> [First steps]
    (2-4 high-value opportunities)

    <b>🧠 NEW TOOLS / MODELS / FEATURES</b>
    • <b>[Name]</b>: [What it does]. <i>For:</i> [Target user]

    <b>📊 SIGNAL VS NOISE</b>
    • <b>Overhyped:</b> [Thing] - [Why]
    • <b>Undervalued:</b> [Thing] - [Why]

    <b>🧩 STRATEGIC TAKEAWAY</b>
    [2-3 sentences on where the real leverage is right now]

    <b>🎯 ACTION STEP</b>
    [ONE clear action executable in under 30 minutes to move forward]

    <b>🔥 UNDERRATED OPPORTUNITY OF THE DAY</b>
    [ONE unique, non-obvious idea with high business potential]

    HARD CONSTRAINTS:
    - 500-800 words range.
    - No filler or fuzzy/vague talk. Be direct and concise.
    - The output must be ready to send to Telegram as-is.
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
    });
    return completion.choices[0]?.message?.content || 'Briefing generated but empty.';
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`❌ Briefing generation failed: ${errorMsg}`);
    return `An error occurred while generating the elite briefing: ${errorMsg.substring(0, 100)}`;
  }
}
