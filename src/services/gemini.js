const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.systemPrompt = process.env.SYSTEM_PROMPT || 'You are a helpful AI assistant.';
    
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.modelCache = new Map();
  }

  getModel(modelName = this.defaultModel) {
    if (!this.modelCache.has(modelName)) {
      try {
        const model = this.genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        });
        this.modelCache.set(modelName, model);
      } catch (error) {
        console.error(`Error creating model ${modelName}:`, error);
        throw new Error(`Failed to initialize model: ${modelName}`);
      }
    }
    return this.modelCache.get(modelName);
  }

  formatConversationHistory(conversations, systemPrompt = null) {
    const prompt = systemPrompt || this.systemPrompt;
    let context = `${prompt}\n\nPrevious conversation:\n`;
    
    for (const conv of conversations) {
      context += `User: ${conv.message}\n`;
      context += `Assistant: ${conv.response}\n\n`;
    }
    
    return context;
  }

  async generateResponse(message, options = {}) {
    try {
      const {
        model = this.defaultModel,
        systemPrompt = null,
        conversationHistory = [],
        userId = null
      } = options;

      const selectedModel = this.getModel(model);
      
      let fullPrompt = message;
      
      // Add conversation history if available
      if (conversationHistory && conversationHistory.length > 0) {
        const contextPrompt = this.formatConversationHistory(conversationHistory, systemPrompt);
        fullPrompt = `${contextPrompt}Current message:\nUser: ${message}\nAssistant:`;
      } else if (systemPrompt || this.systemPrompt) {
        const prompt = systemPrompt || this.systemPrompt;
        fullPrompt = `${prompt}\n\nUser: ${message}\nAssistant:`;
      }

      console.log(`Generating response for user ${userId} using model ${model}`);
      
      const result = await selectedModel.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Gemini API');
      }

      return {
        text: text.trim(),
        model: model,
        tokensUsed: this.estimateTokens(fullPrompt + text),
        success: true
      };

    } catch (error) {
      console.error('Error generating response:', error);
      
      // Handle specific Gemini API errors
      if (error.message.includes('safety')) {
        return {
          text: 'Maaf, saya tidak dapat merespon pesan tersebut karena melanggar kebijakan keamanan.',
          model: options.model || this.defaultModel,
          error: 'safety_violation',
          success: false
        };
      }
      
      if (error.message.includes('quota') || error.message.includes('limit')) {
        return {
          text: 'Maaf, layanan sedang mengalami pembatasan. Silakan coba lagi nanti.',
          model: options.model || this.defaultModel,
          error: 'quota_exceeded',
          success: false
        };
      }

      if (error.message.includes('API key')) {
        return {
          text: 'Terjadi kesalahan konfigurasi. Silakan hubungi administrator.',
          model: options.model || this.defaultModel,
          error: 'api_key_error',
          success: false
        };
      }

      return {
        text: 'Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.',
        model: options.model || this.defaultModel,
        error: 'unknown_error',
        success: false
      };
    }
  }

  // Simple token estimation (rough approximation)
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  // Validate model name
  isValidModel(modelName) {
    const validModels = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
      'gemini-pro'
    ];
    return validModels.includes(modelName);
  }

  // Get available models
  getAvailableModels() {
    return [
      {
        name: 'gemini-1.5-flash',
        description: 'Fast and efficient model for quick responses'
      },
      {
        name: 'gemini-1.5-pro',
        description: 'Advanced model with better reasoning capabilities'
      },
      {
        name: 'gemini-1.0-pro',
        description: 'Stable production model'
      }
    ];
  }

  // Health check for the service
  async healthCheck() {
    try {
      const testModel = this.getModel(this.defaultModel);
      const result = await testModel.generateContent('Hello');
      const response = result.response.text();
      
      return {
        status: 'healthy',
        model: this.defaultModel,
        responseReceived: !!response
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = new GeminiService();