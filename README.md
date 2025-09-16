# 🤖 Gemini Telegram Chatbot

Chatbot Telegram yang powerful dan lightweight menggunakan Google Gemini AI dengan fitur memory per user, multiple model support, dan keamanan yang robust.

## ✨ Fitur Utama

- 🧠 **Memori Percakapan**: AI mengingat riwayat chat per user (hingga 20 pesan terakhir)
- 🤖 **Multiple AI Models**: Dukungan Gemini 1.5 Flash, Pro, dan 1.0 Pro
- 📝 **Custom System Prompt**: Setiap user dapat mengatur personality AI
- 💾 **Database SQLite**: Lightweight dan mudah di-deploy
- 🔒 **Keamanan**: Rate limiting, input validation, spam detection
- ⚡ **Performance**: Optimized dengan caching dan connection pooling
- 🛠️ **Easy Setup**: Script setup interaktif untuk konfigurasi mudah
- 📱 **Smart Message Splitting**: Auto-split pesan panjang menjadi multiple bubbles

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd gemini-chatbot-wrapper
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Konfigurasi
```bash
npm run setup
```

Script setup akan memandu Anda mengisi:
- Telegram Bot Token (dari @BotFather)
- Gemini API Key (dari Google AI Studio)
- Model AI yang diinginkan
- System prompt default
- Pengaturan keamanan

### 4. Jalankan Bot
```bash
npm start
```

Untuk development dengan auto-reload:
```bash
npm run dev
```

## 📋 Persyaratan

### API Keys
1. **Telegram Bot Token**
   - Buat bot baru di [@BotFather](https://t.me/BotFather)
   - Gunakan command `/newbot`
   - Simpan token yang diberikan

2. **Gemini API Key**
   - Kunjungi [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Buat API key baru
   - Simpan API key

### System Requirements
- Node.js 16.0.0 atau lebih baru
- NPM atau Yarn
- 50MB disk space minimum

## ⚙️ Konfigurasi

### Environment Variables (.env)

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Gemini API Configuration  
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# System Prompt
SYSTEM_PROMPT=You are a helpful AI assistant. Be concise, friendly, and informative.

# Database Configuration
DATABASE_PATH=./data/chatbot.db

# Security Configuration
RATE_LIMIT_POINTS=10
RATE_LIMIT_DURATION=60
MAX_MESSAGE_LENGTH=4000
MAX_CONTEXT_MESSAGES=20
ADMIN_USER_IDS=123456789,987654321

# Server Configuration (untuk webhook)
PORT=3000
WEBHOOK_URL=https://yourdomain.com
WEBHOOK_SECRET=your_webhook_secret_here

# Environment
NODE_ENV=production
```

### Model Yang Tersedia

| Model | Deskripsi | Use Case |
|-------|-----------|----------|
| `gemini-1.5-flash` | Cepat dan efisien | Chat sehari-hari, respon cepat |
| `gemini-1.5-pro` | Canggih dengan reasoning | Analisis kompleks, creative writing |
| `gemini-1.0-pro` | Stabil untuk production | Production environment |

## 🤖 Perintah Bot

### Perintah Dasar
- `/start` - Mulai menggunakan bot
- `/help` - Panduan lengkap penggunaan
- `/ping` - Cek status bot dan koneksi

### Pengaturan Model
- `/models` - Lihat semua model tersedia
- `/model flash` - Gunakan Gemini 1.5 Flash
- `/model pro` - Gunakan Gemini 1.5 Pro

### Pengaturan System Prompt
- `/prompt` - Lihat system prompt saat ini
- `/prompt [teks]` - Atur system prompt baru
- `/prompt reset` - Reset ke prompt default

### Manajemen Data
- `/clear` - Hapus semua riwayat percakapan
- `/stats` - Lihat statistik penggunaan
- `/settings` - Menu pengaturan interaktif

### Admin (untuk user admin)
- `/admin` - Panel admin dengan statistik sistem

## 🔒 Keamanan

### Rate Limiting
- Default: 10 pesan per menit per user
- Block duration: 5 menit jika limit terlampaui
- Admin users tidak terkena rate limit

### Input Validation
- Maksimal 4000 karakter per pesan
- Deteksi spam otomatis
- Filter konten berbahaya
- Sanitasi input untuk mencegah injection

### Spam Detection
- Deteksi karakter berulang
- Deteksi excessive caps
- Deteksi kata berulang
- Deteksi karakter khusus berlebihan

### Smart Message Handling
- **Auto-Split Long Messages**: Pesan panjang (>4000 karakter) otomatis dipecah menjadi beberapa bubble chat
- **Markdown Preservation**: Mempertahankan format markdown saat memecah pesan
- **Fallback to Plain Text**: Otomatis convert ke plain text jika ada markdown yang bermasalah
- **Smart Splitting Algorithm**: Memecah berdasarkan paragraf, kalimat, dan kata untuk hasil optimal

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  telegram_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Conversations Table
```sql
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  model_used TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### User Settings Table
```sql
CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY,
  system_prompt TEXT,
  preferred_model TEXT,
  max_context_messages INTEGER DEFAULT 20,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## 🚀 Deployment

### Mode Polling (Development)
Bot akan melakukan polling ke Telegram servers:
```env
# Hapus atau kosongkan WEBHOOK_URL
WEBHOOK_URL=
```

### Mode Webhook (Production)
Untuk production, gunakan webhook:
```env
WEBHOOK_URL=https://yourdomain.com
WEBHOOK_SECRET=your_secure_secret
PORT=3000
```

### Deploy ke VPS/Cloud

1. **Setup Server**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 untuk process management
npm install -g pm2
```

2. **Deploy Bot**
```bash
# Clone dan setup
git clone <your-repo>
cd gemini-chatbot-wrapper
npm install
npm run setup

# Jalankan dengan PM2
pm2 start src/index.js --name "gemini-bot"
pm2 startup
pm2 save
```

3. **Setup Nginx (untuk webhook)**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker Deployment

1. **Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN mkdir -p data

EXPOSE 3000
CMD ["node", "src/index.js"]
```

2. **docker-compose.yml**
```yaml
version: '3.8'
services:
  gemini-bot:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    restart: unless-stopped
```

3. **Deploy**
```bash
docker-compose up -d
```

## 🛠️ Development

### Project Structure
```
gemini-chatbot-wrapper/
├── src/
│   ├── services/
│   │   ├── database.js      # SQLite database service
│   │   ├── gemini.js        # Gemini API integration
│   │   └── conversation.js  # Conversation memory management
│   ├── middleware/
│   │   └── security.js      # Security & rate limiting
│   ├── bot.js              # Main Telegram bot logic
│   └── index.js            # Application entry point
├── scripts/
│   └── setup.js            # Interactive setup script
├── data/                   # SQLite database storage
├── package.json
├── .env.example
└── README.md
```

### Adding New Commands
1. Edit `src/bot.js`
2. Add command handler dalam `setupCommands()`
3. Restart bot untuk apply changes

### Custom Middleware
```javascript
// Example: logging middleware
this.bot.use(async (ctx, next) => {
  console.log(`User ${ctx.from.id}: ${ctx.message?.text}`);
  await next();
});
```

## 📝 Logs & Monitoring

### Log Format
```
[2024-03-15T10:30:00.000Z] User 123456789 (username): Hello bot
Request processed in 1250ms
[SECURITY] 2024-03-15T10:30:00.000Z - rate_limit_exceeded - User: 123456789
```

### Monitoring Endpoints
- `GET /health` - Health check (jika menggunakan webhook)
- Gunakan `/ping` command untuk cek status dari dalam bot

## ❓ Troubleshooting

### Bot Tidak Merespon
1. Cek token Telegram di `.env`
2. Pastikan bot sudah di-start dengan `/start`
3. Cek logs untuk error messages
4. Test dengan `/ping` command

### Gemini API Error
1. Cek Gemini API key di `.env`
2. Pastikan quota API tidak habis
3. Cek model name yang digunakan valid
4. Test dengan `npm run setup` untuk re-configure

### Database Error
1. Pastikan direktori `data/` exists dan writable
2. Cek disk space availability
3. Restart bot untuk reconnect database

### Rate Limit Issues
1. Adjust `RATE_LIMIT_POINTS` di `.env`
2. Add user ID ke `ADMIN_USER_IDS` untuk bypass
3. Restart bot untuk apply changes

### Message Splitting Issues
1. **"Bad Request: can't parse entities"**: Bot otomatis fallback ke plain text
2. **Pesan terpotong aneh**: Algoritma splitting otomatis optimal berdasarkan paragraf/kalimat
3. **Format markdown hilang**: Jika ada markdown error, bot kirim sebagai plain text untuk keamanan
4. **Pesan tidak sampai**: Cek logs untuk error, mungkin hit rate limit

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Submit Pull Request

## 📄 License

MIT License - lihat file [LICENSE](LICENSE) untuk detail.

## 💬 Support

- Buat [Issue](https://github.com/urfavteddybear/gemini-telegram-chatbot/issues) untuk bug reports
- Gunakan [Discussions](https://github.com/urfavteddybear/gemini-telegram-chatbot/discussions) untuk questions

## 🙏 Acknowledgments

- [Telegraf](https://telegraf.js.org/) - Modern Telegram Bot Framework
- [Google Generative AI](https://ai.google.dev/) - Gemini API
- [SQLite](https://www.sqlite.org/) - Embedded database
- Semua contributor dan user yang memberikan feedback

---

**⭐ Star repository ini jika bermanfaat!**