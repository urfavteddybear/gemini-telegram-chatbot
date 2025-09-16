const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function setup() {
  console.log('🚀 Gemini Telegram Chatbot Setup');
  console.log('=====================================\n');

  // Check if .env already exists
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    console.log('⚠️  File .env sudah ada!');
    const overwrite = await askQuestion('Apakah Anda ingin menimpa file .env yang ada? (y/N): ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      console.log('Setup dibatalkan.');
      rl.close();
      return;
    }
  }

  console.log('Silakan masukkan konfigurasi bot Anda:\n');

  // Get Telegram Bot Token
  const telegramToken = await askQuestion('🤖 Telegram Bot Token (dari @BotFather): ');
  if (!telegramToken.trim()) {
    console.log('❌ Token Telegram bot diperlukan!');
    rl.close();
    return;
  }

  // Get Gemini API Key
  const geminiKey = await askQuestion('🧠 Gemini API Key (dari Google AI Studio): ');
  if (!geminiKey.trim()) {
    console.log('❌ Gemini API Key diperlukan!');
    rl.close();
    return;
  }

  // Get preferred model
  console.log('\n🤖 Model Gemini yang tersedia:');
  console.log('1. gemini-1.5-flash (Cepat, efisien)');
  console.log('2. gemini-1.5-pro (Canggih, lebih lambat)');
  console.log('3. gemini-1.0-pro (Stabil)');
  
  const modelChoice = await askQuestion('Pilih model default (1-3) [1]: ') || '1';
  const models = {
    '1': 'gemini-1.5-flash',
    '2': 'gemini-1.5-pro',
    '3': 'gemini-1.0-pro'
  };
  const selectedModel = models[modelChoice] || 'gemini-1.5-flash';

  // Get system prompt
  const systemPrompt = await askQuestion('📝 System Prompt [You are a helpful AI assistant]: ') || 
                      'You are a helpful AI assistant. Be concise, friendly, and informative in your responses.';

  // Get rate limiting settings
  const rateLimit = await askQuestion('🔒 Rate limit (pesan per menit) [10]: ') || '10';

  // Get max message length
  const maxLength = await askQuestion('📏 Panjang maksimal pesan [4000]: ') || '4000';

  // Ask about webhook
  const useWebhook = await askQuestion('🌐 Gunakan webhook untuk production? (y/N): ');
  let webhookUrl = '';
  let webhookSecret = '';
  let port = '3000';

  if (useWebhook.toLowerCase() === 'y' || useWebhook.toLowerCase() === 'yes') {
    webhookUrl = await askQuestion('🔗 URL Webhook (contoh: https://yourdomain.com): ');
    webhookSecret = await askQuestion('🔐 Webhook Secret [generate random]: ') || 
                   Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    port = await askQuestion('🚪 Port [3000]: ') || '3000';
  }

  // Ask about admin users
  const adminIds = await askQuestion('👑 Admin User IDs (pisahkan dengan koma, opsional): ') || '';

  // Create .env content
  const envContent = `# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=${telegramToken}

# Gemini API Configuration
GEMINI_API_KEY=${geminiKey}
GEMINI_MODEL=${selectedModel}

# System Prompt
SYSTEM_PROMPT=${systemPrompt}

# Database Configuration
DATABASE_PATH=./data/chatbot.db

# Security Configuration
RATE_LIMIT_POINTS=${rateLimit}
RATE_LIMIT_DURATION=60
MAX_MESSAGE_LENGTH=${maxLength}
MAX_CONTEXT_MESSAGES=20
ADMIN_USER_IDS=${adminIds}

# Server Configuration
PORT=${port}
WEBHOOK_URL=${webhookUrl}
WEBHOOK_SECRET=${webhookSecret}

# Environment
NODE_ENV=production
`;

  // Write .env file
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ File .env berhasil dibuat!');
  } catch (error) {
    console.log('\n❌ Gagal membuat file .env:', error.message);
    rl.close();
    return;
  }

  // Create data directory
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('✅ Direktori data berhasil dibuat!');
    } catch (error) {
      console.log('⚠️  Gagal membuat direktori data:', error.message);
    }
  }

  console.log('\n🎉 Setup selesai!');
  console.log('\nLangkah selanjutnya:');
  console.log('1. Jalankan: npm install');
  console.log('2. Jalankan: npm start');
  console.log('3. Chat dengan bot Anda di Telegram!');
  
  console.log('\nTips:');
  console.log('• Gunakan /help di bot untuk melihat semua perintah');
  console.log('• Edit .env untuk mengubah konfigurasi');
  console.log('• Gunakan npm run dev untuk development dengan auto-reload');
  
  if (webhookUrl) {
    console.log('\n🌐 Webhook Setup:');
    console.log(`• URL: ${webhookUrl}`);
    console.log(`• Port: ${port}`);
    console.log('• Pastikan server Anda dapat diakses dari internet');
    console.log('• Gunakan HTTPS untuk webhook production');
  }

  rl.close();
}

// Run setup
setup().catch(error => {
  console.error('❌ Setup error:', error);
  rl.close();
});