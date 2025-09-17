const { Telegraf, Markup } = require('telegraf');
const database = require('./services/database');
const geminiService = require('./services/gemini');
const conversationService = require('./services/conversation');
const securityMiddleware = require('./middleware/security');

class TelegramBot {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }

    this.bot = new Telegraf(this.token);
    this.setupMiddleware();
    this.setupCommands();
    this.setupMessageHandlers();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Apply security middleware
    this.bot.use(securityMiddleware.rateLimitMiddleware.bind(securityMiddleware));
    this.bot.use(securityMiddleware.validateInputMiddleware.bind(securityMiddleware));
    this.bot.use(securityMiddleware.commandValidationMiddleware.bind(securityMiddleware));

    // Logging middleware
    this.bot.use(async (ctx, next) => {
      const start = Date.now();
      const userId = ctx.from?.id;
      const username = ctx.from?.username;
      const text = ctx.message?.text || '';
      
      console.log(`[${new Date().toISOString()}] User ${userId} (${username}): ${text.substring(0, 100)}`);
      
      await next();
      
      const duration = Date.now() - start;
      console.log(`Request processed in ${duration}ms`);
    });
  }

  setupCommands() {
    // Start command
    this.bot.command('start', async (ctx) => {
      const user = await database.getOrCreateUser(ctx.from);
      
      const welcomeMessage = `
🤖 *Selamat datang di Gemini Chatbot!*

Halo ${ctx.from.first_name}! Saya adalah chatbot yang menggunakan Google Gemini AI untuk membantu Anda.

*Fitur yang tersedia:*
🧠 Chat dengan AI yang mengingat percakapan
⚙️ Konfigurasi otomatis dari environment
🤖 Model AI yang telah dikonfigurasi
📊 Lihat statistik penggunaan
🗑️ Hapus riwayat percakapan

*Perintah yang tersedia:*
/help - Bantuan lengkap
/clear - Hapus riwayat percakapan
/stats - Lihat statistik Anda
/settings - Pengaturan akun
/ping - Cek status bot

Silakan mulai chat dengan mengirim pesan apapun!
      `;

      await this.sendLongMessage(ctx, welcomeMessage);
    });

    // Help command
    this.bot.command('help', async (ctx) => {
      const helpMessage = `
📖 *Panduan Penggunaan Gemini Chatbot*

*Cara Chat:*
• Kirim pesan biasa untuk chat dengan AI
• AI akan mengingat percakapan sebelumnya
• Respon AI akan disesuaikan dengan konteks

*Perintah Dasar:*
/start - Mulai menggunakan bot
/help - Tampilkan panduan ini
/ping - Cek status bot dan koneksi

*Manajemen Data:*
/clear - Hapus semua riwayat percakapan
/stats - Lihat statistik penggunaan
/settings - Pengaturan akun Anda

*Tips:*
• Bot mengingat 20 pesan terakhir untuk konteks
• Rate limit: 10 pesan per menit
• Maksimal 4000 karakter per pesan
• Gunakan model Flash untuk respon cepat
• Gunakan model Pro untuk analisis kompleks

Jika ada masalah, coba /ping untuk cek status bot.
      `;

      await this.sendLongMessage(ctx, helpMessage);
    });

    // Clear command
    this.bot.command('clear', async (ctx) => {
      const user = await database.getOrCreateUser(ctx.from);
      const success = await conversationService.clearConversationHistory(user.id);
      
      if (success) {
        await ctx.reply('🗑️ Riwayat percakapan berhasil dihapus. Percakapan baru akan dimulai tanpa konteks sebelumnya.');
      } else {
        await ctx.reply('❌ Gagal menghapus riwayat percakapan. Silakan coba lagi.');
      }
    });

    // Stats command
    this.bot.command('stats', async (ctx) => {
      const user = await database.getOrCreateUser(ctx.from);
      const summary = await conversationService.getConversationSummary(user.id);
      const stats = await conversationService.getConversationStats(user.id);
      const settings = await database.getUserSettings(user.id);

      if (!summary || summary.messageCount === 0) {
        await ctx.reply('📊 Belum ada percakapan. Mulai chat untuk melihat statistik!');
        return;
      }

      let message = `📊 *Statistik Anda:*\n\n`;
      message += `💬 Total pesan: ${summary.messageCount}\n`;
      message += `📅 Interaksi pertama: ${new Date(summary.firstInteraction).toLocaleDateString('id-ID')}\n`;
      message += `🕐 Interaksi terakhir: ${new Date(summary.lastInteraction).toLocaleDateString('id-ID')}\n\n`;

      if (stats && stats.modelUsage.length > 0) {
        message += `🤖 *Penggunaan Model:*\n`;
        stats.modelUsage.forEach(usage => {
          message += `• ${usage.model}: ${usage.count} (${usage.percentage}%)\n`;
        });
        message += `\n`;
      }

      const currentModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      
      message += `⚙️ *Konfigurasi Bot:*\n`;
      message += `• Model: ${currentModel} (fixed)\n`;
      message += `• System Prompt: Default (fixed)`;

      await this.sendLongMessage(ctx, message);
    });

    // Settings command
    this.bot.command('settings', async (ctx) => {
      const user = await database.getOrCreateUser(ctx.from);
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🗑️ Hapus Riwayat', 'settings_clear')],
        [Markup.button.callback('📊 Lihat Stats', 'settings_stats')]
      ]);

      const currentModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

      const message = `⚙️ *Pengaturan Akun*\n\n` +
                     `🤖 Model: ${currentModel} (fixed dari environment)\n` +
                     `📝 System Prompt: Default (fixed dari environment)\n` +
                     `👤 User ID: ${user.id}\n\n` +
                     `Pilih pengaturan yang tersedia:`;

      await this.sendLongMessage(ctx, message, { reply_markup: keyboard.reply_markup });
    });

    // Ping command
    this.bot.command('ping', async (ctx) => {
      const start = Date.now();
      const healthCheck = await geminiService.healthCheck();
      const dbStats = await database.getStats();
      const securityStats = securityMiddleware.getSecurityStats();
      const ping = Date.now() - start;

      const message = `🏓 *Status Bot*\n\n` +
                     `⚡ Ping: ${ping}ms\n` +
                     `🤖 Gemini API: ${healthCheck.status === 'healthy' ? '✅' : '❌'}\n` +
                     `💾 Database: ✅ Connected\n` +
                     `👥 Total Users: ${dbStats.users}\n` +
                     `💬 Total Messages: ${dbStats.totalMessages}\n` +
                     `📅 Today Messages: ${dbStats.todayMessages}\n` +
                     `🔒 Blocked Users: ${securityStats.blockedUsers}`;

      await this.sendLongMessage(ctx, message);
    });

    // Admin command (if user is admin)
    this.bot.command('admin', async (ctx) => {
      if (!securityMiddleware.isAdmin(ctx.from.id)) {
        await ctx.reply('❌ Anda tidak memiliki akses admin.');
        return;
      }

      const stats = await database.getStats();
      const securityStats = securityMiddleware.getSecurityStats();
      const conversationStats = conversationService.getActiveConversationStats();

      const message = `👑 *Admin Panel*\n\n` +
                     `📊 *Statistik Sistem:*\n` +
                     `👥 Users: ${stats.users}\n` +
                     `💬 Total Messages: ${stats.totalMessages}\n` +
                     `📅 Today: ${stats.todayMessages}\n\n` +
                     `🔒 *Keamanan:*\n` +
                     `🚫 Blocked: ${securityStats.blockedUsers}\n` +
                     `👑 Admins: ${securityStats.adminUsers}\n\n` +
                     `💾 *Cache:*\n` +
                     `🔄 Active: ${conversationStats.activeCacheEntries}`;

      await this.sendLongMessage(ctx, message);
    });
  }

  setupMessageHandlers() {
    // Handle regular text messages
    this.bot.on('text', async (ctx) => {
      // Skip if it's a command
      if (ctx.message.text.startsWith('/')) {
        return;
      }

      const user = await database.getOrCreateUser(ctx.from);
      const userMessage = securityMiddleware.sanitizeInput(ctx.message.text);

      try {
        // Show typing indicator
        await ctx.sendChatAction('typing');

        // Use settings from environment (no user customization)
        const preferredModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const systemPrompt = null; // Always use default from environment
        const maxContext = parseInt(process.env.MAX_CONTEXT_MESSAGES) || 20;

        // Get conversation history
        const conversationHistory = await conversationService.getRecentContextForAI(user.id, maxContext);

        // Generate response
        const result = await geminiService.generateResponse(userMessage, {
          model: preferredModel,
          systemPrompt: systemPrompt,
          conversationHistory: conversationHistory,
          userId: user.id
        });

        if (!result.success) {
          await ctx.reply(`❌ ${result.text}`);
          return;
        }

        // Save conversation
        await conversationService.saveConversation(user.id, userMessage, result.text, result.model);

        // Send response (split if too long)
        await this.sendLongMessage(ctx, result.text);

      } catch (error) {
        console.error('Error processing message:', error);
        await ctx.reply('❌ Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.');
      }
    });

    // Handle callback queries (inline buttons)
    this.bot.on('callback_query', async (ctx) => {
      const action = ctx.callbackQuery.data;

      await ctx.answerCbQuery();

      switch (action) {
        case 'settings_model':
          await ctx.reply('Model AI telah dikonfigurasi dari environment dan tidak dapat diubah.');
          break;
        case 'settings_prompt':
          await ctx.reply('System prompt telah dikonfigurasi dari environment dan tidak dapat diubah.');
          break;
        case 'settings_clear':
          await ctx.reply('Gunakan /clear untuk menghapus riwayat percakapan.');
          break;
        case 'settings_stats':
          await ctx.reply('Gunakan /stats untuk melihat statistik penggunaan.');
          break;
      }
    });
  }

  setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      
      if (ctx && ctx.reply) {
        ctx.reply('❌ Terjadi kesalahan sistem. Tim teknis telah diberitahu.')
          .catch(console.error);
      }
    });

    // Handle graceful shutdown
    process.once('SIGINT', () => this.stop('SIGINT'));
    process.once('SIGTERM', () => this.stop('SIGTERM'));
  }

  // Method untuk mengirim pesan panjang yang dipecah otomatis
  async sendLongMessage(ctx, text, options = {}) {
    const maxLength = 2000; // Lebih agresif: kurangi dari 2800 ke 2000 untuk lebih banyak chunks
    
    // Pisahkan keyboard/markup dari options
    const { reply_markup, ...textOptions } = options;
    const defaultOptions = { 
      disable_web_page_preview: true,
      ...textOptions 
    };

    // Cek apakah text mungkin memiliki markdown yang bermasalah
    const hasProblematicMarkdown = this.hasProblematicMarkdown(text);

    console.log(`Message length: ${text.length}, will split: ${text.length > maxLength}`);

    // Jika pesan tidak terlalu panjang, kirim biasa
    if (text.length <= maxLength) {
      try {
        const finalOptions = reply_markup ? { ...defaultOptions, reply_markup } : defaultOptions;
        
        if (hasProblematicMarkdown) {
          // Coba bersihkan dulu sebelum fallback
          try {
            const cleanedText = this.cleanMarkdown(text);
            await ctx.reply(cleanedText, { ...finalOptions, parse_mode: 'Markdown' });
          } catch (cleanError) {
            console.log('Cleaned markdown still failed, sending as plain text');
            const plainText = this.markdownToPlainText(text);
            await ctx.reply(plainText, finalOptions);
          }
        } else {
          // Coba dengan Markdown dulu
          try {
            await ctx.reply(text, { ...finalOptions, parse_mode: 'Markdown' });
          } catch (markdownError) {
            console.log('Markdown parsing failed, trying to clean first');
            try {
              const cleanedText = this.cleanMarkdown(text);
              await ctx.reply(cleanedText, { ...finalOptions, parse_mode: 'Markdown' });
            } catch (cleanError) {
              console.log('Cleaned markdown still failed, sending as plain text');
              const plainText = this.markdownToPlainText(text);
              await ctx.reply(plainText, finalOptions);
            }
          }
        }
        return;
      } catch (error) {
        console.error('Error sending message:', error);
        await ctx.reply('❌ Terjadi kesalahan saat mengirim pesan.');
        return;
      }
    }

    // Split pesan panjang dengan mempertahankan format
    const chunks = this.splitLongMessage(text, maxLength);
    
    console.log(`Split into ${chunks.length} chunks:`, chunks.map(c => c.length));
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        let chunkText = chunks[i];
        
        // Tambahkan indikator jika ada multiple chunks
        if (chunks.length > 1) {
          if (i === 0) {
            chunkText = `${chunkText}\n\n_📄 Pesan dilanjutkan..._`;
          } else if (i === chunks.length - 1) {
            chunkText = `_📄 ...lanjutan pesan_\n\n${chunkText}`;
          } else {
            chunkText = `_📄 ...lanjutan pesan_\n\n${chunkText}\n\n_📄 Pesan dilanjutkan..._`;
          }
        }

        // Tambahkan keyboard hanya di chunk terakhir
        const finalOptions = (i === chunks.length - 1 && reply_markup) 
          ? { ...defaultOptions, reply_markup } 
          : defaultOptions;

        // Cek markdown di chunk ini
        const chunkHasProblematic = this.hasProblematicMarkdown(chunkText);
        
        if (chunkHasProblematic) {
          // Coba bersihkan dulu sebelum fallback
          try {
            const cleanedChunk = this.cleanMarkdown(chunkText);
            await ctx.reply(cleanedChunk, { ...finalOptions, parse_mode: 'Markdown' });
          } catch (cleanError) {
            console.log(`Cleaned markdown still failed for chunk ${i + 1}, sending as plain text`);
            const plainText = this.markdownToPlainText(chunkText);
            await ctx.reply(plainText, finalOptions);
          }
        } else {
          // Coba markdown dulu
          try {
            await ctx.reply(chunkText, { ...finalOptions, parse_mode: 'Markdown' });
          } catch (markdownError) {
            console.log(`Markdown parsing failed for chunk ${i + 1}, trying to clean first`);
            try {
              const cleanedChunk = this.cleanMarkdown(chunkText);
              await ctx.reply(cleanedChunk, { ...finalOptions, parse_mode: 'Markdown' });
            } catch (cleanError) {
              console.log(`Cleaned markdown still failed for chunk ${i + 1}, sending as plain text`);
              const plainText = this.markdownToPlainText(chunkText);
              await ctx.reply(plainText, finalOptions);
            }
          }
        }
        
        // Delay kecil antar pesan untuk avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error sending chunk ${i + 1}:`, error);
        await ctx.reply(`❌ Terjadi kesalahan saat mengirim bagian ${i + 1} dari pesan.`);
        break;
      }
    }
  }

  // Method untuk memecah pesan dengan mempertahankan format markdown
  splitLongMessage(text, maxLength = 2000) {
    const chunks = [];
    
    // Jika text pendek, return as is
    if (text.length <= maxLength) {
      return [text];
    }
    
    console.log(`Splitting text of length ${text.length} with maxLength ${maxLength}`);
    
    // Protect code blocks dulu sebelum split
    const codeBlocks = [];
    let textWithPlaceholders = text;
    
    // Extract code blocks (```) dan replace dengan placeholder
    textWithPlaceholders = textWithPlaceholders.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
    });
    
    // Extract inline code (`) dan replace dengan placeholder  
    const inlineCodeBlocks = [];
    textWithPlaceholders = textWithPlaceholders.replace(/`([^`\n]+?)`/g, (match) => {
      inlineCodeBlocks.push(match);
      return `___INLINE_CODE_${inlineCodeBlocks.length - 1}___`;
    });
    
    // Coba split berdasarkan paragraf dulu (double newline)
    const paragraphs = textWithPlaceholders.split('\n\n');
    let currentChunk = '';
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const potentialChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
      
      // Lebih agresif: jika potentialChunk > 80% maxLength, split
      if (potentialChunk.length <= maxLength * 0.8) {
        currentChunk = potentialChunk;
      } else {
        // Simpan chunk saat ini jika ada
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          console.log(`Added paragraph chunk: ${currentChunk.length} chars`);
        }
        
        // Jika paragraph sendiri > 60% maxLength, split berdasarkan kalimat
        if (paragraph.length > maxLength * 0.6) {
          const splitParagraph = this.splitParagraph(paragraph, maxLength);
          chunks.push(...splitParagraph);
          splitParagraph.forEach((chunk, idx) => {
            console.log(`Added split paragraph chunk ${idx}: ${chunk.length} chars`);
          });
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }
    
    // Tambahkan chunk terakhir
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
      console.log(`Added final chunk: ${currentChunk.length} chars`);
    }
    
    // Kalau masih belum cukup terpecah, paksa split lebih agresif
    if (chunks.length === 1 && chunks[0].length > maxLength) {
      console.log('Force splitting single large chunk');
      const forceSplit = this.forceSplit(chunks[0], maxLength);
      // Restore code blocks di force split
      const restoredForceSplit = forceSplit.map(chunk => {
        let restored = chunk;
        inlineCodeBlocks.forEach((code, index) => {
          restored = restored.replace(new RegExp(`___INLINE_CODE_${index}___`, 'g'), code);
        });
        codeBlocks.forEach((code, index) => {
          restored = restored.replace(new RegExp(`___CODE_BLOCK_${index}___`, 'g'), code);
        });
        return restored;
      });
      return restoredForceSplit;
    }
    
    // Validasi setiap chunk tidak melebihi maxLength
    const validatedChunks = [];
    for (const chunk of chunks) {
      if (chunk.length > maxLength) {
        console.log(`Chunk too large (${chunk.length}), force splitting`);
        validatedChunks.push(...this.forceSplit(chunk, maxLength));
      } else {
        validatedChunks.push(chunk);
      }
    }
    
    console.log(`Final result: ${validatedChunks.length} chunks`);
    
    // Restore code blocks di semua chunks
    const restoredChunks = validatedChunks.map(chunk => {
      let restored = chunk;
      
      // Restore inline code blocks
      inlineCodeBlocks.forEach((code, index) => {
        restored = restored.replace(new RegExp(`___INLINE_CODE_${index}___`, 'g'), code);
      });
      
      // Restore code blocks
      codeBlocks.forEach((code, index) => {
        restored = restored.replace(new RegExp(`___CODE_BLOCK_${index}___`, 'g'), code);
      });
      
      return restored;
    });
    
    return restoredChunks.length > 0 ? restoredChunks : [text];
  }

  // Helper method untuk split paragraph panjang
  splitParagraph(paragraph, maxLength) {
    const chunks = [];
    
    // Split berdasarkan kalimat (. ! ?)
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const potentialChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
      
      // Lebih agresif: jika > 70% maxLength, split
      if (potentialChunk.length <= maxLength * 0.7) {
        currentChunk = potentialChunk;
      } else {
        // Simpan chunk saat ini
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        // Jika kalimat terlalu panjang, split berdasarkan kata
        if (sentence.length > maxLength * 0.5) {
          const splitSentence = this.splitSentence(sentence, maxLength);
          chunks.push(...splitSentence);
          currentChunk = '';
        } else {
          currentChunk = sentence;
        }
      }
    }
    
    // Tambahkan chunk terakhir
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Helper method untuk split kalimat panjang berdasarkan kata
  splitSentence(sentence, maxLength) {
    const chunks = [];
    const words = sentence.split(' ');
    let currentChunk = '';
    
    for (const word of words) {
      const potentialChunk = currentChunk ? currentChunk + ' ' + word : word;
      
      // Batas 60% dari maxLength untuk kata-kata
      if (potentialChunk.length <= maxLength * 0.6) {
        currentChunk = potentialChunk;
      } else {
        // Simpan chunk saat ini
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        // Jika kata terlalu panjang, potong paksa
        if (word.length > maxLength * 0.6) {
          let remainingWord = word;
          while (remainingWord.length > maxLength * 0.6) {
            chunks.push(remainingWord.substring(0, Math.floor(maxLength * 0.6)));
            remainingWord = remainingWord.substring(Math.floor(maxLength * 0.6));
          }
          currentChunk = remainingWord;
        } else {
          currentChunk = word;
        }
      }
    }
    
    // Tambahkan chunk terakhir
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Helper method untuk force split text yang terlalu besar
  forceSplit(text, maxLength) {
    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      const potentialChunk = currentChunk ? currentChunk + '\n' + line : line;
      
      if (potentialChunk.length <= maxLength) {
        currentChunk = potentialChunk;
      } else {
        // Simpan chunk saat ini
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        
        // Jika line terlalu panjang, split berdasarkan kata
        if (line.length > maxLength) {
          const words = line.split(' ');
          let lineChunk = '';
          
          for (const word of words) {
            const potentialLine = lineChunk ? lineChunk + ' ' + word : word;
            
            if (potentialLine.length <= maxLength) {
              lineChunk = potentialLine;
            } else {
              if (lineChunk.trim()) {
                chunks.push(lineChunk.trim());
              }
              
              // Jika kata terlalu panjang, potong paksa
              if (word.length > maxLength) {
                let remainingWord = word;
                while (remainingWord.length > maxLength) {
                  chunks.push(remainingWord.substring(0, maxLength));
                  remainingWord = remainingWord.substring(maxLength);
                }
                lineChunk = remainingWord;
              } else {
                lineChunk = word;
              }
            }
          }
          
          currentChunk = lineChunk;
        } else {
          currentChunk = line;
        }
      }
    }
    
    // Tambahkan chunk terakhir
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Helper method untuk membersihkan markdown yang rusak
  cleanMarkdown(text) {
    // Strategi: preserve code blocks, bersihkan yang lain
    let cleaned = text;
    
    // Lindungi code blocks dulu
    const codeBlocks = [];
    const inlineCodeBlocks = [];
    
    // Simpan code blocks (```)
    cleaned = cleaned.replace(/```[\s\S]*?```/g, (match, index) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
    
    // Simpan inline code (`)
    cleaned = cleaned.replace(/`([^`\n]+?)`/g, (match, content) => {
      inlineCodeBlocks.push(match);
      return `__INLINE_CODE_${inlineCodeBlocks.length - 1}__`;
    });
    
    // Sekarang bersihkan markdown yang bermasalah
    // Hapus bold yang tidak lengkap
    cleaned = cleaned.replace(/\*\*([^*]*?)\*(?!\*)/g, '**$1**');
    cleaned = cleaned.replace(/\*(?!\*)([^*]*?)\*\*/g, '**$1**');
    cleaned = cleaned.replace(/\*\*\s*\*\*/g, '');
    
    // Hapus italic yang tidak lengkap (tapi hati-hati dengan yang valid)
    cleaned = cleaned.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (match, content) => {
      // Pastikan tidak ada * lain di dalam content
      if (content.includes('*')) {
        return content; // Hapus * jika bermasalah
      }
      return match; // Keep yang valid
    });
    
    // Hapus single * di awal/akhir baris yang tidak berpasangan
    cleaned = cleaned.replace(/^\*(?!\*)/gm, '');
    cleaned = cleaned.replace(/(?<!\*)\*$/gm, '');
    
    // Hapus underscore yang tidak berpasangan
    cleaned = cleaned.replace(/^_(?!_)/gm, '');
    cleaned = cleaned.replace(/(?<!_)_$/gm, '');
    
    // Bersihkan bracket yang tidak lengkap
    cleaned = cleaned.replace(/\[([^\]]*?)$/gm, '$1');
    cleaned = cleaned.replace(/^([^\[]*?)\]/gm, '$1');
    
    // Kembalikan code blocks
    inlineCodeBlocks.forEach((code, index) => {
      cleaned = cleaned.replace(`__INLINE_CODE_${index}__`, code);
    });
    
    codeBlocks.forEach((code, index) => {
      cleaned = cleaned.replace(`__CODE_BLOCK_${index}__`, code);
    });
    
    return cleaned;
  }

  // Helper method untuk deteksi markdown yang bermasalah
  hasProblematicMarkdown(text) {
    // Hapus code blocks dulu dari analisis
    let textToAnalyze = text;
    
    // Hapus code blocks (```) dari analisis
    textToAnalyze = textToAnalyze.replace(/```[\s\S]*?```/g, '');
    
    // Hapus inline code (`) dari analisis
    textToAnalyze = textToAnalyze.replace(/`[^`\n]+?`/g, '');
    
    // Sekarang cek markdown yang tersisa
    
    // Cek asterisk yang tidak berpasangan untuk bold/italic (skip yang di dalam code)
    const asteriskMatches = textToAnalyze.match(/\*/g);
    if (asteriskMatches) {
      // Hitung bold vs italic
      const boldMatches = textToAnalyze.match(/\*\*/g);
      const boldCount = boldMatches ? boldMatches.length : 0;
      const totalAsterisk = asteriskMatches.length;
      const italicAsterisk = totalAsterisk - (boldCount * 2);
      
      // Bold harus genap, italic harus genap
      if (boldCount % 2 !== 0 || italicAsterisk % 2 !== 0) {
        return true;
      }
    }
    
    // Cek underscore yang tidak berpasangan
    const underscoreMatches = textToAnalyze.match(/(?<!\w)_(?!\w)|(?!\w)_(?=\w)/g);
    if (underscoreMatches && underscoreMatches.length % 2 !== 0) {
      return true;
    }
    
    // Cek bracket yang tidak lengkap untuk link
    const openBrackets = (textToAnalyze.match(/\[/g) || []).length;
    const closeBrackets = (textToAnalyze.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return true;
    }
    
    // Cek parentheses yang tidak lengkap untuk link
    const linkPattern = /\[([^\]]*)\]\([^)]*\)/g;
    const links = textToAnalyze.match(linkPattern) || [];
    const openParensInLinks = links.join('').match(/\(/g) || [];
    const closeParensInLinks = links.join('').match(/\)/g) || [];
    
    const totalOpenParens = (textToAnalyze.match(/\(/g) || []).length;
    const totalCloseParens = (textToAnalyze.match(/\)/g) || []).length;
    
    // Hanya bermasalah jika ada paren yang tidak tertutup di luar link
    if (totalOpenParens !== totalCloseParens) {
      return true;
    }
    
    return false;
  }

  // Helper method untuk konversi markdown ke plain text
  markdownToPlainText(text) {
    return text
      .replace(/```(\w+)?\n?([\s\S]*?)```/g, '「CODE」\n$2\n「/CODE」') // Code block dengan pembatas
      .replace(/`([^`\n]+?)`/g, '〖$1〗')       // Inline code dengan bracket
      .replace(/\*\*(.*?)\*\*/g, '【$1】')     // Bold dengan bracket tebal
      .replace(/\*(.*?)\*/g, '$1')             // Italic hilang
      .replace(/_(.*?)_/g, '$1')               // Italic underscore hilang
      .replace(/\[(.*?)\]\(.*?\)/g, '🔗$1')    // Links dengan emoji
      .replace(/^#+\s*/gm, '▶ ')               // Headers dengan arrow
      .replace(/^\>\s*/gm, '💬 ')              // Quotes dengan emoji
      .replace(/^\*\s*/gm, '• ')               // Bullet points
      .replace(/^\d+\.\s*/gm, '◯ ')            // Numbered lists dengan circle
      .replace(/\n{3,}/g, '\n\n');             // Multiple newlines
  }

  async start() {
    try {
      console.log('Starting Telegram bot...');
      
      // Initialize database
      await database.initialize();
      
      // Test Gemini connection
      const healthCheck = await geminiService.healthCheck();
      if (healthCheck.status !== 'healthy') {
        throw new Error('Gemini API health check failed');
      }

      // Start bot
      if (process.env.WEBHOOK_URL) {
        // Use webhook mode for production
        const port = process.env.PORT || 3000;
        await this.bot.launch({
          webhook: {
            domain: process.env.WEBHOOK_URL,
            port: port,
            secretToken: process.env.WEBHOOK_SECRET
          }
        });
        console.log(`Bot started with webhook on port ${port}`);
      } else {
        // Use polling mode for development
        await this.bot.launch();
        console.log('Bot started with polling');
      }

      console.log('✅ Telegram bot is running successfully!');
    } catch (error) {
      console.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  async stop(signal) {
    console.log(`Received ${signal}, shutting down gracefully...`);
    
    try {
      await this.bot.stop(signal);
      await database.close();
      console.log('Bot stopped successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

module.exports = TelegramBot;