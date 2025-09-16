require('dotenv').config();
const TelegramBot = require('./bot');

// Validate required environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'GEMINI_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Log startup info
console.log('🚀 Starting Gemini Telegram Chatbot');
console.log(`📱 Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`🧠 Default Model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}`);
console.log(`💾 Database: ${process.env.DATABASE_PATH || './data/chatbot.db'}`);
console.log(`🔒 Rate Limit: ${process.env.RATE_LIMIT_POINTS || 10} requests per ${process.env.RATE_LIMIT_DURATION || 60} seconds`);
console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);

if (process.env.WEBHOOK_URL) {
  console.log(`🔗 Webhook Mode: ${process.env.WEBHOOK_URL}`);
} else {
  console.log('📡 Polling Mode');
}

console.log('---');

// Create and start bot
const bot = new TelegramBot();

bot.start().catch(error => {
  console.error('💥 Failed to start bot:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Cleanup cache periodically (every 30 minutes)
const conversationService = require('./services/conversation');
setInterval(() => {
  conversationService.cleanupCache();
  console.log('🧹 Cache cleanup completed');
}, 30 * 60 * 1000);