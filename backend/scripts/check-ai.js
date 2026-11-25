/* eslint-disable no-console */
// Quick test of the AI key: `npm run ai:check`. Sends one tiny prompt and prints the reply.
require('dotenv').config();
const llm = require('../src/utils/llm');

(async () => {
  if (!llm.isEnabled()) {
    console.log('AI is OFF: set GROQ_API_KEY in backend/.env (and AI_ENABLED=true). The app will use template replies.');
    process.exit(1);
  }
  try {
    const model = await llm.getModel();
    console.log(`Provider: ${llm.provider}  Model: ${model}`);
    const reply = await llm.chat({
      messages: [{ role: 'user', content: 'Reply with one short motivating sentence for someone heading to the gym.' }],
      maxTokens: 60,
    });
    console.log(`Reply: ${reply}`);
    const json = await llm.chat({
      messages: [{ role: 'user', content: 'Return JSON only: {"ok": true, "exercise": "<one exercise name>"}' }],
      json: true,
      maxTokens: 60,
    });
    console.log('JSON mode:', json);
    console.log('\n✅ AI key works.');
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ AI call failed (${err.status || ''}): ${err.message}`);
    if (err.status === 401 || err.status === 400) console.error('Check the key is copied fully, with no quotes or spaces.');
    if (err.status === 403 || err.status === 429) console.error('The account may have no credits yet: you hit the free-tier rate limit (wait a minute) or the account needs credits.');
    if (err.status === 404) console.error('Model not found: clear GROQ_MODEL / XAI_MODEL or set a model your account lists.');
    process.exit(1);
  }
})();
