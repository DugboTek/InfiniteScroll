const { getAvailableModels, MODEL_CONFIGS, DEFAULT_MODEL } = require('../backend/aiService');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        replicate: !!process.env.REPLICATE_API_TOKEN,
        gemini: !!process.env.GEMINI_API_KEY
      },
      availableModels: Object.keys(MODEL_CONFIGS),
      defaultModel: DEFAULT_MODEL
    };

    res.status(200).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 