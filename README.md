# 🧠 Daily AI News Agent

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933.svg?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3-F55036.svg)](https://groq.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-Automated-2088FF.svg?logo=github-actions)](https://github.com/features/actions)

An autonomous intelligence agent built for AI founders, agency owners, and operators. This agent monitors the highest-signal AI sources across the internet, synthesizes the noise into a single operational briefing using Groq (Llama-3-70B), and delivers it straight to your Telegram every single day.

## ✨ Features

- **Zero Noise Guarantee**: Strictly filters out clickbait and low-credibility sources. Only Top-Tier platforms allowed (Reuters, MIT Tech Review, TechCrunch, arXiv, OpenAI Blog).
- **Groq Llama-3 Synthesis**: Leverages the blazing speed and logic of Groq's `llama-3.3-70b-versatile` model to extract actionable business opportunities from raw news.
- **Founder-Mode Briefings**: Outputs structured data matching the needs of operators (Emerging Trends, Undervalued Tools, SaaS Opportunities) instead of generic journalistic summaries.
- **100% Free Cloud Automation**: Fully deployed via GitHub Actions to run on an invisible server every morning at 8:00 AM UTC autonomously.
- **Multi-Channel Extraction**: Capable of reading RSS feeds, NewsAPI, YouTube transcribing (trusted creators only), and Twitter/Nitter streams.

## 🚀 Quick Start

### Prerequisites

Ensure you have **Node.js** and **npm** installed on your system.

### Local Installation

1. Clone the repository:
```bash
git clone https://github.com/ali-harti/Daily-AI-News-Agent.git
cd Daily-AI-News-Agent
```

2. Install dependencies:
```bash
npm install
```

3. Configure your API keys:
Create a local `config.json` inside your root directory. Add your keys:
```json
{
  "news": { "groq_api_key": "YOUR_GROQ_KEY", "newsapi_key": "YOUR_NEWSAPI" },
  "youtube": { "api_key": "YOUR_YOUTUBE_API" },
  "telegram": { "bot_token": "YOUR_BOT", "chat_id": "YOUR_ID" }
}
```

### Running the Agent

Trigger a manual briefing directly from your terminal:
```bash
npm run fetch-now
```

## ☁️ Cloud Deployment (GitHub Actions)

This repository is pre-configured to automatically run every day via GitHub Actions.

1. Push this codebase to a **Private GitHub Repository**.
2. Navigate to your repository **Settings > Secrets and variables > Actions**.
3. Add the following **Repository Secrets**:
   - `GROQ_API_KEY`
   - `NEWSAPI_KEY`
   - `YOUTUBE_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

Once the secrets are loaded, go to the **Actions** tab to manually trigger your first cloud briefing, or wait for the daily CRON schedule to execute.

## 🧠 Architecture

1. **Ingestion Engine**: Configured to poll strictly vetted feeds and channels over headless protocols and public APIs.
2. **Scoring & Filtration System**: Implements a rigorous relevance scoring module to penalize clickbait language.
3. **LLM Brain**: Groq-powered contextual evaluator that restricts output tokens to the most essential ~800 words of tactical business intelligence.
4. **Delivery Layer**: Formats the JSON artifacts into Telegram-native HTML payloads for immediate mobile consumption.

## 📂 Project Structure

```text
Daily-AI-News-Agent/
├── src/                      # TypeScript core logic and services
├── .github/workflows/        # Automated CRON scheduling for GitHub Actions
├── package.json              # Project dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # Project documentation
```

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).

**Developed by Ali Harti**
