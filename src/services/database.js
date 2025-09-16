const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = process.env.DATABASE_PATH || './data/chatbot.db';
  }

  async initialize() {
    try {
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize database connection
      this.db = new sqlite3.Database(this.dbPath);
      
      // Enable foreign keys
      await this.run('PRAGMA foreign_keys = ON');
      
      // Create tables
      await this.createTables();
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createConversationsTable = `
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        response TEXT NOT NULL,
        model_used TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    const createUserSettingsTable = `
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        system_prompt TEXT,
        preferred_model TEXT,
        max_context_messages INTEGER DEFAULT 20,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    // Create indexes for better performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)'
    ];

    await this.run(createUsersTable);
    await this.run(createConversationsTable);
    await this.run(createUserSettingsTable);

    for (const index of createIndexes) {
      await this.run(index);
    }
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(error) {
        if (error) reject(error);
        else resolve(this);
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
  }

  // User management methods
  async getOrCreateUser(telegramUser) {
    try {
      let user = await this.get(
        'SELECT * FROM users WHERE telegram_id = ?',
        [telegramUser.id]
      );

      if (!user) {
        await this.run(
          `INSERT INTO users (telegram_id, username, first_name, last_name) 
           VALUES (?, ?, ?, ?)`,
          [telegramUser.id, telegramUser.username, telegramUser.first_name, telegramUser.last_name]
        );

        user = await this.get(
          'SELECT * FROM users WHERE telegram_id = ?',
          [telegramUser.id]
        );
      } else {
        // Update user info if changed
        await this.run(
          `UPDATE users SET username = ?, first_name = ?, last_name = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE telegram_id = ?`,
          [telegramUser.username, telegramUser.first_name, telegramUser.last_name, telegramUser.id]
        );
      }

      return user;
    } catch (error) {
      console.error('Error in getOrCreateUser:', error);
      throw error;
    }
  }

  // Conversation history methods
  async saveConversation(userId, message, response, modelUsed) {
    try {
      await this.run(
        `INSERT INTO conversations (user_id, message, response, model_used) 
         VALUES (?, ?, ?, ?)`,
        [userId, message, response, modelUsed]
      );
    } catch (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }
  }

  async getUserConversations(userId, limit = 20) {
    try {
      const conversations = await this.all(
        `SELECT message, response, created_at, model_used 
         FROM conversations 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [userId, limit]
      );
      return conversations.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error getting user conversations:', error);
      throw error;
    }
  }

  async clearUserHistory(userId) {
    try {
      await this.run(
        'DELETE FROM conversations WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Error clearing user history:', error);
      throw error;
    }
  }

  // User settings methods
  async getUserSettings(userId) {
    try {
      return await this.get(
        'SELECT * FROM user_settings WHERE user_id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  }

  async updateUserSettings(userId, settings) {
    try {
      const existing = await this.getUserSettings(userId);
      
      if (existing) {
        const updateFields = [];
        const updateValues = [];
        
        if (settings.system_prompt !== undefined) {
          updateFields.push('system_prompt = ?');
          updateValues.push(settings.system_prompt);
        }
        if (settings.preferred_model !== undefined) {
          updateFields.push('preferred_model = ?');
          updateValues.push(settings.preferred_model);
        }
        if (settings.max_context_messages !== undefined) {
          updateFields.push('max_context_messages = ?');
          updateValues.push(settings.max_context_messages);
        }
        
        if (updateFields.length > 0) {
          updateFields.push('updated_at = CURRENT_TIMESTAMP');
          updateValues.push(userId);
          
          await this.run(
            `UPDATE user_settings SET ${updateFields.join(', ')} WHERE user_id = ?`,
            updateValues
          );
        }
      } else {
        await this.run(
          `INSERT INTO user_settings (user_id, system_prompt, preferred_model, max_context_messages) 
           VALUES (?, ?, ?, ?)`,
          [userId, settings.system_prompt, settings.preferred_model, settings.max_context_messages]
        );
      }
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const userCount = await this.get('SELECT COUNT(*) as count FROM users');
      const messageCount = await this.get('SELECT COUNT(*) as count FROM conversations');
      const todayMessages = await this.get(
        'SELECT COUNT(*) as count FROM conversations WHERE DATE(created_at) = DATE("now")'
      );

      return {
        users: userCount.count,
        totalMessages: messageCount.count,
        todayMessages: todayMessages.count
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  async close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = new DatabaseService();