const { OpenAI } = require('openai');
const config = require('../config/environment');
const { logger } = require('./logger');

/*
 * One place that talks to the language model. Groq and xAI's Grok are both OpenAI-compatible,
 * so the official `openai` package works with a different base URL.
 *
 *   GROQ_API_KEY set    -> Groq (free tier, Llama models)
 *   else XAI_API_KEY    -> Grok (https://api.x.ai/v1)
 *   else OPENAI_API_KEY -> OpenAI
 *   neither / AI_ENABLED=false -> disabled; callers use their template fallbacks
 */

const XAI_BASE_URL = 'https://api.x.ai/v1';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const provider = config.ai.groqApiKey
  ? 'groq'
  : config.ai.xaiApiKey
    ? 'xai'
    : config.ai.openaiApiKey
      ? 'openai'
      : null;

const client =
  provider === 'groq'
    ? new OpenAI({ apiKey: config.ai.groqApiKey, baseURL: GROQ_BASE_URL })
    : provider === 'xai'
    ? new OpenAI({ apiKey: config.ai.xaiApiKey, baseURL: XAI_BASE_URL })
    : provider === 'openai'
      ? new OpenAI({ apiKey: config.ai.openaiApiKey })
      : null;

let resolvedModel = null;

/**
 * Model to use. Set XAI_MODEL / OPENAI_MODEL to pin one; otherwise for Grok we ask the API
 * which models this key can use and prefer a cheap, fast one (xAI renames models often,
 * so hard-coding a name breaks).
 */
const getModel = async () => {
  if (resolvedModel) return resolvedModel;
  if (provider === 'openai') {
    resolvedModel = config.ai.openaiModel || 'gpt-4o';
    return resolvedModel;
  }
  if (provider === 'groq') {
    if (config.ai.groqModel) {
      resolvedModel = config.ai.groqModel;
      return resolvedModel;
    }
    // Groq retires models from time to time: use the default if this key still has it,
    // otherwise the closest general-purpose chat model
    try {
      const ids = ((await client.models.list()).data || []).map((m) => m.id);
      const chatIds = ids.filter((id) => !/whisper|guard|tts|vision|playai|orpheus|compound/i.test(id));
      resolvedModel =
        (chatIds.includes(GROQ_DEFAULT_MODEL) && GROQ_DEFAULT_MODEL) ||
        chatIds.find((id) => /versatile/i.test(id)) ||
        chatIds.find((id) => /llama/i.test(id)) ||
        chatIds.find((id) => /instant/i.test(id)) ||
        chatIds[0] ||
        GROQ_DEFAULT_MODEL;
      logger.info(`AI: using Groq model "${resolvedModel}" (set GROQ_MODEL to choose another)`);
    } catch (err) {
      resolvedModel = GROQ_DEFAULT_MODEL;
      logger.warn(`AI: could not list Groq models (${err.message}); trying "${resolvedModel}"`);
    }
    return resolvedModel;
  }
  if (config.ai.xaiModel) {
    resolvedModel = config.ai.xaiModel;
    return resolvedModel;
  }
  try {
    const list = await client.models.list();
    const ids = (list.data || []).map((m) => m.id).filter((id) => /^grok/i.test(id));
    const chatIds = ids.filter((id) => !/image|vision|imagine|video/i.test(id));
    const pick =
      chatIds.find((id) => /mini/i.test(id)) ||
      chatIds.find((id) => /fast/i.test(id) && /non-reasoning/i.test(id)) ||
      chatIds.find((id) => /fast/i.test(id)) ||
      chatIds.find((id) => !/code/i.test(id)) ||
      chatIds[0];
    if (!pick) throw new Error('no Grok chat models available to this key');
    resolvedModel = pick;
    logger.info(`AI: using xAI model "${pick}" (set XAI_MODEL to choose another). Available: ${ids.join(', ')}`);
  } catch (err) {
    resolvedModel = 'grok-3-mini';
    logger.warn(`AI: could not list xAI models (${err.message}); trying "${resolvedModel}"`);
  }
  return resolvedModel;
};

const isEnabled = () => Boolean(config.ai.enabled && client);

// Models sometimes wrap JSON in ```json fences even when asked not to
const stripFences = (text) =>
  String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

/**
 * Chat completion -> reply text. With json: true, asks for a JSON object and returns it parsed.
 */
const chat = async ({ messages, json = false, maxTokens, temperature = 0.7 }) => {
  if (!isEnabled()) throw new Error('AI is not configured');
  const model = await getModel();
  const base = { model, messages, temperature, ...(maxTokens && { max_tokens: maxTokens }) };

  let completion;
  try {
    completion = await client.chat.completions.create(json ? { ...base, response_format: { type: 'json_object' } } : base);
  } catch (err) {
    // Some models reject response_format; the prompt already demands JSON, so retry without it
    if (json && err.status === 400) {
      completion = await client.chat.completions.create(base);
    } else {
      throw err;
    }
  }

  const text = completion.choices?.[0]?.message?.content || '';
  return json ? JSON.parse(stripFences(text)) : text.trim();
};

const describe = () => (provider ? `${provider}:${resolvedModel || 'auto'}` : 'disabled');

module.exports = { chat, isEnabled, getModel, describe, provider };
