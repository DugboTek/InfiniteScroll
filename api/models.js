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
    res.status(200).json({
      availableModels: getAvailableModels(),
      modelConfigs: MODEL_CONFIGS,
      defaultModel: DEFAULT_MODEL
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch model information',
      details: error.message
    });
  }
} 