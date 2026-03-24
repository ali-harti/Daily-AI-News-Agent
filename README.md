# 🧠 Elite AI Daily News Agent

An autonomous intelligence agent built for AI founders, agency owners, and operators. This agent monitors the absolute highest-signal AI sources across the internet, synthesizes the noise into a single operational briefing using Groq (Llama-3-70B), and delivers it straight to your Telegram every single day.

## 🚀 Key Features

*   **Zero Noise Guarantee**: Strictly filters out clickbait and low-credibility sources. Only Top-Tier platforms allowed (Reuters, MIT Tech Review, TechCrunch, arXiv, OpenAI Blog).
*   **Groq Llama-3 Synthesis**: Leverages the blazing speed and logic of Groq's `llama-3.3-70b-versatile` model to extract actionable business opportunities from raw news.
*   **Founder-Mode Briefings**: Outputs structured data matching the needs of operators (Emerging Trends, Undervalued Tools, SaaS Opportunities) instead of generic journalistic summaries.
*   **100% Free Cloud Automation**: Fully deployed via GitHub Actions to run on an invisible server every morning at 8:00 AM UTC autonomously.
*   **Multi-Channel Extraction**: Capable of reading RSS feeds, NewsAPI, YouTube transcribing (trusted creators only), and Twitter/Nitter streams.

## ⚙️ Architecture

1.  **Ingestion Engine**: Configured to poll strictly vetted feeds and channels over headless protocols and public APIs.
2.  **Scoring & Filtration System**: Implements a rigorous relevance scoring module to penalize clickbait language (e.g., "🤯", "AGI is here") and boost verified structural data.
3.  **LLM Brain**: Groq-powered contextual evaluator that restricts output tokens to the most essential ~800 words of tactical business intelligence.
4.  **Delivery Layer**: Formats the JSON artifacts into Telegram-native HTML payloads for immediate mobile consumption.

## 🛠️ Local Setup

If you want to run or test the agent locally on your own machine:

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configuration setup**
    Create a local `config.json` inside your root directory. Add your keys to the config:
    ```javascript
    {
      "news": { "groq_api_key": "YOUR_GROQ_KEY", "newsapi_key": "YOUR_NEWSAPI" },
      "youtube": { "api_key": "YOUR_YOUTUBE_API" },
      "telegram": { "bot_token": "YOUR_BOT", "chat_id": "YOUR_ID" }
    }
    ```
    *Note: `config.json` is safely ignored in `.gitignore` so your private keys are never pushed.*

3.  **Run the Pipeline**
    ```bash
    npm run fetch-now
    ```

## ☁️ Cloud Deployment (GitHub Actions)

This repository is pre-configured to automatically run every day via GitHub Actions.

1.  Push this codebase to a **Private GitHub Repository**.
2.  Navigate to your repository **Settings > Secrets and variables > Actions**.
3.  Add the following **Repository Secrets**:
    *   `GROQ_API_KEY`
    *   `NEWSAPI_KEY`
    *   `YOUTUBE_API_KEY`
    *   `TELEGRAM_BOT_TOKEN`
    *   `TELEGRAM_CHAT_ID`

Once the secrets are loaded, go to the **Actions** tab to manually trigger your first cloud briefing, or simply wait for the daily scheduled CRON expression to execute.

---
*Built for the AI Vanguard.*
