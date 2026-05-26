import OpenAI from 'openai';

export const FAST_MODEL = 'sonar';        // fast, good for JSON tasks
export const CHAT_MODEL = 'sonar-pro';    // more capable, web-aware, for Feynman chat

export function getPerplexity() {
  return new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY ?? 'placeholder',
    baseURL: 'https://api.perplexity.ai',
  });
}
