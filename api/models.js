// Model configurations
const MODEL_CONFIGS = {
  'flux-schnell': {
    name: 'black-forest-labs/flux-schnell',
    steps: 1,
    guidance_scale: 0.0,
    use_case: 'speed'
  },
  'flux-fill-pro': {
    name: 'black-forest-labs/flux-fill-pro',
    steps: 4,
    guidance_scale: 3.5,
    use_case: 'outpainting'
  },
  'flux-schnell-lora': {
    name: 'black-forest-labs/flux-schnell-lora',
    steps: 2,
    guidance_scale: 1.0,
    use_case: 'balanced'
  }
};

const DEFAULT_MODEL = 'flux-schnell';

function getAvailableModels() {
  return Object.keys(MODEL_CONFIGS);
}

export default async function handler(req, res) {
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