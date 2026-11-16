// Set environment variables before loading any file
process.env.PORT = '5000';
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/lockin_test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.ACCESS_TOKEN_SECRET = 'test_access_token_secret_string_12345';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_token_secret_string_12345';

const BASE = '../src';

try {
  console.log('--- Phase 4 Syntax Verification ---\n');

  console.log('1. Loading Socket Auth Middleware...');
  const socketAuth = require(`${BASE}/socket/auth`);
  console.log('   ✓ socket/auth.js loaded');

  console.log('2. Loading Socket Entrypoint...');
  const { initializeSocket } = require(`${BASE}/socket`);
  console.log('   ✓ socket/index.js loaded');

  console.log('3. Loading Chat Service...');
  const chatService = require(`${BASE}/services/chat.service`);
  console.log('   ✓ services/chat.service.js loaded');

  console.log('4. Loading Chat Controller...');
  const chatController = require(`${BASE}/controllers/chat.controller`);
  console.log('   ✓ controllers/chat.controller.js loaded');

  console.log('5. Loading Chat Routes...');
  const chatRoutes = require(`${BASE}/routes/chat.routes`);
  console.log('   ✓ routes/chat.routes.js loaded');

  console.log('6. Loading complete app.js (routes validation)...');
  const app = require(`${BASE}/app`);
  console.log('   ✓ app.js routes mounted successfully');

  console.log('\n=========================================');
  console.log('🎉 PHASE 4 SYNTAX VERIFICATION SUCCESSFUL!');
  console.log('All socket & chat modules compile and load correctly.');
  console.log('=========================================');
} catch (error) {
  console.error('\n❌ VERIFICATION FAILED:');
  console.error(error);
  process.exit(1);
}
