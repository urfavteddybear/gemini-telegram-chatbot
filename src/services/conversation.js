const database = require('./database');

class ConversationService {
  constructor() {
    this.maxContextMessages = parseInt(process.env.MAX_CONTEXT_MESSAGES) || 20;
    this.contextCache = new Map(); // In-memory cache for active conversations
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
  }

  // Get conversation context for a user
  async getConversationContext(userId, maxMessages = null) {
    try {
      const limit = maxMessages || this.maxContextMessages;
      
      // Try to get from cache first
      const cacheKey = `user_${userId}`;
      const cached = this.contextCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`Using cached context for user ${userId}`);
        return cached.conversations.slice(-limit);
      }

      // Get from database
      const conversations = await database.getUserConversations(userId, limit);
      
      // Update cache
      this.contextCache.set(cacheKey, {
        conversations,
        timestamp: Date.now()
      });

      return conversations;
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return [];
    }
  }

  // Save a new conversation
  async saveConversation(userId, userMessage, aiResponse, modelUsed) {
    try {
      await database.saveConversation(userId, userMessage, aiResponse, modelUsed);
      
      // Update cache
      const cacheKey = `user_${userId}`;
      const cached = this.contextCache.get(cacheKey);
      
      if (cached) {
        cached.conversations.push({
          message: userMessage,
          response: aiResponse,
          created_at: new Date().toISOString(),
          model_used: modelUsed
        });
        
        // Keep only the last maxContextMessages
        if (cached.conversations.length > this.maxContextMessages) {
          cached.conversations = cached.conversations.slice(-this.maxContextMessages);
        }
        
        cached.timestamp = Date.now();
      }

      console.log(`Conversation saved for user ${userId}`);
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  // Clear conversation history for a user
  async clearConversationHistory(userId) {
    try {
      await database.clearUserHistory(userId);
      
      // Clear from cache
      const cacheKey = `user_${userId}`;
      this.contextCache.delete(cacheKey);
      
      console.log(`Conversation history cleared for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      return false;
    }
  }

  // Get conversation summary for a user
  async getConversationSummary(userId) {
    try {
      const conversations = await this.getConversationContext(userId);
      
      if (conversations.length === 0) {
        return {
          messageCount: 0,
          lastInteraction: null,
          modelsUsed: [],
          averageResponseTime: null
        };
      }

      const modelsUsed = [...new Set(conversations.map(c => c.model_used).filter(Boolean))];
      const lastInteraction = conversations[conversations.length - 1]?.created_at;

      return {
        messageCount: conversations.length,
        lastInteraction,
        modelsUsed,
        firstInteraction: conversations[0]?.created_at
      };
    } catch (error) {
      console.error('Error getting conversation summary:', error);
      return null;
    }
  }

  // Format conversation history for AI context
  formatContextForAI(conversations, includeModel = false) {
    if (!conversations || conversations.length === 0) {
      return '';
    }

    return conversations.map(conv => {
      let formatted = `User: ${conv.message}\nAssistant: ${conv.response}`;
      if (includeModel && conv.model_used) {
        formatted += ` [${conv.model_used}]`;
      }
      return formatted;
    }).join('\n\n');
  }

  // Get recent conversations for context (optimized for AI)
  async getRecentContextForAI(userId, maxMessages = 10) {
    try {
      const conversations = await this.getConversationContext(userId, maxMessages);
      
      // Filter out very old conversations (older than 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentConversations = conversations.filter(conv => {
        const convDate = new Date(conv.created_at);
        return convDate > twentyFourHoursAgo;
      });

      return recentConversations;
    } catch (error) {
      console.error('Error getting recent context for AI:', error);
      return [];
    }
  }

  // Cleanup old cache entries
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.contextCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.contextCache.delete(key);
      }
    }
  }

  // Get active conversation stats
  getActiveConversationStats() {
    this.cleanupCache();
    return {
      activeCacheEntries: this.contextCache.size,
      cacheTimeout: this.cacheTimeout,
      maxContextMessages: this.maxContextMessages
    };
  }

  // Search conversations by keyword
  async searchConversations(userId, keyword, limit = 10) {
    try {
      const conversations = await database.all(`
        SELECT message, response, created_at, model_used 
        FROM conversations 
        WHERE user_id = ? AND (
          LOWER(message) LIKE LOWER(?) OR 
          LOWER(response) LIKE LOWER(?)
        )
        ORDER BY created_at DESC 
        LIMIT ?
      `, [userId, `%${keyword}%`, `%${keyword}%`, limit]);

      return conversations;
    } catch (error) {
      console.error('Error searching conversations:', error);
      return [];
    }
  }

  // Export conversation history
  async exportConversations(userId, format = 'json') {
    try {
      const conversations = await database.getUserConversations(userId, 1000); // Get more for export
      
      if (format === 'json') {
        return JSON.stringify(conversations, null, 2);
      } else if (format === 'text') {
        return conversations.map(conv => 
          `[${conv.created_at}]\nUser: ${conv.message}\nAssistant: ${conv.response}\n---\n`
        ).join('\n');
      }
      
      return conversations;
    } catch (error) {
      console.error('Error exporting conversations:', error);
      return null;
    }
  }

  // Get conversation statistics
  async getConversationStats(userId) {
    try {
      const stats = await database.all(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          model_used,
          COUNT(*) as model_count
        FROM conversations 
        WHERE user_id = ?
        GROUP BY model_used
      `, [userId]);

      const totalMessages = stats.reduce((sum, stat) => sum + stat.model_count, 0);
      const modelUsage = stats.map(stat => ({
        model: stat.model_used,
        count: stat.model_count,
        percentage: ((stat.model_count / totalMessages) * 100).toFixed(2)
      }));

      return {
        totalMessages,
        activeDays: stats[0]?.active_days || 0,
        modelUsage
      };
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return null;
    }
  }
}

module.exports = new ConversationService();