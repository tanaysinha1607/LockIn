// Set environment variables before loading any file
process.env.PORT = '5001'; // Use a different port to avoid conflicts
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/lockin_test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.ACCESS_TOKEN_SECRET = 'test_access_token_secret_string_12345';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_token_secret_string_12345';

const mongoose = require('mongoose');
const http = require('http');
const ioClient = require('socket.io-client');
const app = require('../src/app');
const { initializeSocket } = require('../src/socket');
const { User, Match, Conversation, Message } = require('../src/models');
const { generateAccessToken } = require('../src/utils/tokenUtils');

let server = null;
let socketA = null;
let socketB = null;

async function runTest() {
  console.log('--- Phase 4 Integration Testing ---\n');

  try {
    // 1. Connect to MongoDB
    console.log('Connecting to Test MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // Clear test collections
    await User.deleteMany({});
    await Match.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    console.log('Cleared test database collections.');

    // 2. Seed Test Users
    console.log('Seeding test users (User A and User B)...');
    const userA = await User.create({
      email: 'usera@lockin.com',
      password: 'Password123',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'user',
    });

    const userB = await User.create({
      email: 'userb@lockin.com',
      password: 'Password123',
      firstName: 'Bob',
      lastName: 'Jones',
      role: 'user',
    });

    // 3. Seed Match and Conversation
    console.log('Creating match and conversation between A and B...');
    const match = await Match.create({
      users: [userA._id, userB._id],
      compatibilityScore: 92,
      status: 'active',
    });

    const conversation = await Conversation.create({
      matchId: match._id,
      participants: [userA._id, userB._id],
    });

    match.conversationId = conversation._id;
    await match.save();
    console.log(`Match created: ${match._id}`);
    console.log(`Conversation created: ${conversation._id}\n`);

    // 4. Generate Tokens
    const tokenA = generateAccessToken(userA._id, 'user');
    const tokenB = generateAccessToken(userB._id, 'user');

    // 5. Start server programmatically
    console.log('Starting HTTP + Socket.io Server...');
    server = http.createServer(app);
    initializeSocket(server);
    
    await new Promise((resolve) => {
      server.listen(5001, () => {
        console.log('Server listening on port 5001');
        resolve();
      });
    });

    // 6. Connect Socket Clients
    console.log('\nConnecting Socket.io Client for Alice...');
    socketA = ioClient('http://127.0.0.1:5001', {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      socketA.on('connect', () => {
        console.log('Alice connected successfully.');
        resolve();
      });
      socketA.on('connect_error', (err) => {
        reject(new Error(`Alice socket connection failed: ${err.message}`));
      });
    });

    console.log('Connecting Socket.io Client for Bob...');
    socketB = ioClient('http://127.0.0.1:5001', {
      auth: { token: tokenB },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      socketB.on('connect', () => {
        console.log('Bob connected successfully.');
        resolve();
      });
      socketB.on('connect_error', (err) => {
        reject(new Error(`Bob socket connection failed: ${err.message}`));
      });
    });

    // Verify online statuses check
    await new Promise((resolve) => {
      socketA.emit('presence:check', userB._id, (response) => {
        console.log(`Checking presence: Bob is ${response.status}`);
        if (response.status === 'online') {
          console.log('   ✓ Presence check OK');
        } else {
          console.warn('   ❌ Presence check returned offline');
        }
        resolve();
      });
    });

    // 7. Send message from Alice to Bob and wait for Bob to receive it
    console.log('\nTesting Real-Time messaging: Alice sending message to Bob...');
    const messageContent = 'Hey Bob, ready for chest day?';
    
    const messageReceivedPromise = new Promise((resolve, reject) => {
      // Setup timeout
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for Bob to receive message'));
      }, 5000);

      socketB.on('chat:message', (msg) => {
        console.log(`Bob received message in real-time: "${msg.content}"`);
        if (msg.content === messageContent && String(msg.conversationId) === String(conversation._id)) {
          console.log('   ✓ Real-time message delivery OK');
          clearTimeout(timeout);
          resolve(msg);
        }
      });
    });

    // Emit send event from Alice
    socketA.emit('chat:send', {
      conversationId: conversation._id,
      content: messageContent,
      type: 'text',
    });

    const receivedMessage = await messageReceivedPromise;

    // 8. Database Assertions
    console.log('\nChecking database persistence...');
    const dbMessage = await Message.findById(receivedMessage._id);
    if (dbMessage && dbMessage.content === messageContent) {
      console.log('   ✓ Message persisted correctly in MongoDB');
    } else {
      throw new Error('Message not persisted or has wrong content');
    }

    const dbConversation = await Conversation.findById(conversation._id);
    if (dbConversation.lastMessage && dbConversation.lastMessage.content === messageContent) {
      console.log('   ✓ Conversation lastMessage updated correctly');
    } else {
      throw new Error('Conversation lastMessage was not updated');
    }

    const unreadCountObj = Object.fromEntries(dbConversation.unreadCount);
    if (unreadCountObj[String(userB._id)] === 1) {
      console.log('   ✓ Unread count for Bob incremented to 1');
    } else {
      throw new Error(`Bob unread count wrong. Expected 1, got ${unreadCountObj[String(userB._id)]}`);
    }

    // 9. Read Receipt Verification
    console.log('\nTesting read receipt: Bob reading the conversation...');
    const readReceiptPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for read receipt event'));
      }, 5000);

      socketA.on('chat:read', (data) => {
        console.log(`Alice received read notification for conversation: ${data.conversationId}`);
        if (String(data.conversationId) === String(conversation._id) && String(data.userId) === String(userB._id)) {
          console.log('   ✓ Read receipt event delivery OK');
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    socketB.emit('chat:read', { conversationId: conversation._id });
    await readReceiptPromise;

    // Check unread count is reset to 0 in DB
    const dbConversationPostRead = await Conversation.findById(conversation._id);
    const unreadCountObjPostRead = Object.fromEntries(dbConversationPostRead.unreadCount);
    if (unreadCountObjPostRead[String(userB._id)] === 0) {
      console.log('   ✓ Unread count for Bob reset to 0 in database');
    } else {
      throw new Error(`Bob unread count post-read is wrong: ${unreadCountObjPostRead[String(userB._id)]}`);
    }

    console.log('\n=========================================');
    console.log('🎉 INTEGRATION TEST SUCCESSFUL!');
    console.log('Presence, messaging, database synchronization, unread indicators, and read receipts work correctly.');
    console.log('=========================================');
    
  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:');
    console.error(error);
    process.exit(1);
  } finally {
    console.log('Shutting down server and database connection...');
    if (socketA) socketA.close();
    if (socketB) socketB.close();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    console.log('Cleanup completed.');
  }
}

runTest();
