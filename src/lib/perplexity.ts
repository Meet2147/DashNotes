import OpenAI from 'openai';

export const FAST_MODEL = 'llama-3.1-8b-instruct';
export const CHAT_MODEL = 'llama-3.1-sonar-small-128k-online';

export function getPerplexity() {
  return new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY ?? 'placeholder',
    baseURL: 'https://api.perplexity.ai',
  });
}
