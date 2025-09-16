const { RateLimiterMemory } = require('rate-limiter-flexible');

class SecurityMiddleware {
  constructor() {
    this.rateLimiter = new RateLimiterMemory({
      points: parseInt(process.env.RATE_LIMIT_POINTS) || 10, // Number of requests
      duration: parseInt(process.env.RATE_LIMIT_DURATION) || 60, // Per 60 seconds
      blockDuration: 300, // Block for 5 minutes if limit exceeded
    });

    this.maxMessageLength = parseInt(process.env.MAX_MESSAGE_LENGTH) || 4000;
    this.blockedUsers = new Set();
    this.adminUsers = new Set(
      (process.env.ADMIN_USER_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    );
  }

  // Rate limiting middleware
  async rateLimitMiddleware(ctx, next) {
    const userId = ctx.from.id;
    
    try {
      // Skip rate limiting for admin users
      if (this.adminUsers.has(userId)) {
        return next();
      }

      await this.rateLimiter.consume(userId);
      return next();
    } catch (rejRes) {
      const totalHits = rejRes.totalHits;
      const remainingPoints = rejRes.remainingPoints || 0;
      const msBeforeNext = rejRes.msBeforeNext || 0;

      console.log(`Rate limit exceeded for user ${userId}: ${totalHits} hits, ${remainingPoints} remaining, ${msBeforeNext}ms to wait`);
      
      const waitMinutes = Math.ceil(msBeforeNext / 60000);
      await ctx.reply(
        `⚠️ Anda mengirim pesan terlalu cepat. Silakan tunggu ${waitMinutes} menit sebelum mengirim pesan lagi.`
      );
    }
  }

  // Input validation middleware
  async validateInputMiddleware(ctx, next) {
    const text = ctx.message?.text || '';
    const userId = ctx.from.id;

    // Check if user is blocked
    if (this.blockedUsers.has(userId)) {
      await ctx.reply('🚫 Anda diblokir dari menggunakan bot ini.');
      return;
    }

    // Validate message length
    if (text.length > this.maxMessageLength) {
      await ctx.reply(
        `📝 Pesan terlalu panjang. Maksimal ${this.maxMessageLength} karakter. Pesan Anda: ${text.length} karakter.`
      );
      return;
    }

    // Basic spam detection
    if (this.isSpam(text)) {
      console.log(`Spam detected from user ${userId}: ${text}`);
      await ctx.reply('⚠️ Pesan terdeteksi sebagai spam. Silakan kirim pesan yang lebih bermakna.');
      return;
    }

    // Check for potentially harmful content
    if (this.containsHarmfulContent(text)) {
      console.log(`Harmful content detected from user ${userId}: ${text}`);
      await ctx.reply('⚠️ Pesan mengandung konten yang tidak pantas.');
      return;
    }

    return next();
  }

  // Spam detection logic
  isSpam(text) {
    // Check for repeated characters
    const repeatedChars = /(.)\1{10,}/.test(text);
    
    // Check for excessive caps
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    const excessiveCaps = capsRatio > 0.7 && text.length > 10;
    
    // Check for repeated words
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repeatedWords = words.length > 5 && uniqueWords.size / words.length < 0.5;
    
    // Check for excessive special characters
    const specialChars = (text.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?~`]/g) || []).length;
    const excessiveSpecial = specialChars / text.length > 0.3;

    return repeatedChars || excessiveCaps || repeatedWords || excessiveSpecial;
  }

  // Basic harmful content detection
  containsHarmfulContent(text) {
    const harmfulPatterns = [
      /\b(hack|crack|exploit|ddos|dos|attack)\b/i,
      /\b(bomb|terror|kill|murder|suicide)\b/i,
      /\b(drugs|cocaine|heroin|marijuana|cannabis)\b/i,
      /(https?:\/\/[^\s]+\.(exe|zip|rar|bat|cmd|scr))/i, // Suspicious file downloads
    ];

    return harmfulPatterns.some(pattern => pattern.test(text));
  }

  // Sanitize input
  sanitizeInput(text) {
    // Remove potentially dangerous characters
    return text
      .replace(/[<>]/g, '') // Remove HTML-like characters
      .replace(/javascript:/gi, '') // Remove javascript protocols
      .replace(/data:/gi, '') // Remove data protocols
      .trim();
  }

  // Block user
  blockUser(userId, reason = 'Violation of terms') {
    this.blockedUsers.add(userId);
    console.log(`User ${userId} blocked: ${reason}`);
  }

  // Unblock user
  unblockUser(userId) {
    this.blockedUsers.delete(userId);
    console.log(`User ${userId} unblocked`);
  }

  // Check if user is admin
  isAdmin(userId) {
    return this.adminUsers.has(userId);
  }

  // Add admin user
  addAdmin(userId) {
    this.adminUsers.add(userId);
    console.log(`User ${userId} added as admin`);
  }

  // Log security event
  logSecurityEvent(event, userId, details = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[SECURITY] ${timestamp} - ${event} - User: ${userId}`, details);
  }

  // Middleware for command validation
  async commandValidationMiddleware(ctx, next) {
    const text = ctx.message?.text || '';
    
    // Only allow commands that start with /
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();
      const allowedCommands = [
        '/start', '/help', '/clear', '/stats', '/model', '/models', 
        '/prompt', '/settings', '/ping', '/admin'
      ];
      
      if (!allowedCommands.includes(command)) {
        await ctx.reply('❌ Perintah tidak dikenal. Ketik /help untuk melihat perintah yang tersedia.');
        return;
      }
    }
    
    return next();
  }

  // Get security stats
  getSecurityStats() {
    return {
      blockedUsers: this.blockedUsers.size,
      adminUsers: this.adminUsers.size,
      rateLimitConfig: {
        points: this.rateLimiter.points,
        duration: this.rateLimiter.duration,
        blockDuration: this.rateLimiter.blockDuration
      }
    };
  }
}

module.exports = new SecurityMiddleware();