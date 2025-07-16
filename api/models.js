import { getAvailableModels, MODEL_CONFIGS, DEFAULT_MODEL } from './lib/aiService.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const models = getAvailableModels();
    
    res.status(200).json({ 
      models,
      default: DEFAULT_MODEL,
      configs: MODEL_CONFIGS
    });
    
  } catch (error) {
    console.error('Error getting available models:', error);
    res.status(500).json({ 
      error: 'Failed to get available models',
      details: error.message 
    });
  }
}; 