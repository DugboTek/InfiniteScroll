require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { 
  generateInitialImage, 
  generateNextImage, 
  evolvePrompt, 
  getAvailableModels, 
  MODEL_CONFIGS, 
  DEFAULT_MODEL,
  expandUserPrompt 
} = require('./aiService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API endpoint to generate next image with model selection
app.post('/api/generate-next-image', async (req, res) => {
  try {
    const { 
      previousImage, 
      currentPrompt, 
      modelName = DEFAULT_MODEL,
      debugMode = false 
    } = req.body;
    
    console.log('Received request for image generation');
    console.log('Previous image provided:', !!previousImage);
    console.log('Current prompt provided:', !!currentPrompt);
    console.log('Model requested:', modelName);
    console.log('Debug mode:', debugMode);
    
    let result;
    
    if (!previousImage) {
      // Generate initial image
      console.log(`Generating initial image with model: ${modelName}...`);
      result = await generateInitialImage(currentPrompt, modelName);
    } else {
      // Generate next image with outpainting
      console.log(`Generating next image with model: ${modelName}...`);
      
      // Evolve the prompt for narrative continuity
      let nextPrompt = currentPrompt;
      if (currentPrompt) {
        try {
          nextPrompt = await evolvePrompt(currentPrompt);
        } catch (error) {
          console.warn('Failed to evolve prompt, using current prompt:', error.message);
          nextPrompt = currentPrompt;
        }
      }
      
      result = await generateNextImage(previousImage, nextPrompt, modelName);
    }
    
    console.log('Image generation completed:', result.imageUrl);
    console.log('Generation time:', result.generationTime, 'ms');
    
    // Prepare response with debug information if requested
    const response = {
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      isInitial: result.isInitial,
      timestamp: result.timestamp,
      width: result.width,
      height: result.height
    };
    
    // Add debug information if debug mode is enabled
    if (debugMode) {
      response.debug = {
        modelUsed: result.modelUsed,
        generationTime: result.generationTime,
        config: result.config,
        supportsOutpainting: result.config.supports_outpainting,
        inferenceSteps: result.config.steps
      };
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Error generating image:', error);
    
    // Return detailed error information for debugging
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message,
      timestamp: new Date().toISOString(),
      modelAttempted: req.body.modelName || DEFAULT_MODEL
    });
  }
});

// Debug endpoint to get available models
app.get('/api/models', (req, res) => {
  try {
    const models = getAvailableModels();
    res.json({
      models,
      defaultModel: DEFAULT_MODEL,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({
      error: 'Failed to get models',
      details: error.message
    });
  }
});

// Debug endpoint to get model configuration
app.get('/api/models/:modelName', (req, res) => {
  try {
    const { modelName } = req.params;
    const config = MODEL_CONFIGS[modelName];
    
    if (!config) {
      return res.status(404).json({
        error: 'Model not found',
        availableModels: Object.keys(MODEL_CONFIGS)
      });
    }
    
    res.json({
      modelName,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting model config:', error);
    res.status(500).json({
      error: 'Failed to get model configuration',
      details: error.message
    });
  }
});

// Endpoint to evolve a prompt (for debug testing)
app.post('/api/evolve-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required'
      });
    }
    
    const evolvedPrompt = await evolvePrompt(prompt);
    
    res.json({
      originalPrompt: prompt,
      evolvedPrompt,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error evolving prompt:', error);
    res.status(500).json({
      error: 'Failed to evolve prompt',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    modelsLoaded: Object.keys(MODEL_CONFIGS).length,
    defaultModel: DEFAULT_MODEL
  });
});

// API endpoint to expand user prompts
app.post('/api/expand-prompt', async (req, res) => {
  try {
    const { userPrompt } = req.body;
    
    if (!userPrompt || typeof userPrompt !== 'string') {
      return res.status(400).json({ 
        error: 'Valid userPrompt is required' 
      });
    }
    
    console.log('📝 Expanding user prompt:', userPrompt);
    
    const expandedPrompt = await expandUserPrompt(userPrompt.trim());
    
    console.log('✨ Expanded prompt:', expandedPrompt);
    
    res.json({ 
      originalPrompt: userPrompt,
      expandedPrompt: expandedPrompt
    });
    
  } catch (error) {
    console.error('Error expanding prompt:', error);
    res.status(500).json({ 
      error: 'Failed to expand prompt',
      details: error.message 
    });
  }
});

// Environment info endpoint (for debugging - should be removed in production)
app.get('/env-info', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    imageWidth: process.env.IMAGE_WIDTH,
    imageHeight: process.env.IMAGE_HEIGHT,
    maxImagesPerMinute: process.env.MAX_IMAGES_PER_MINUTE,
    generationTimeout: process.env.GENERATION_TIMEOUT,
    // Don't expose API keys in response
    hasReplicateToken: !!process.env.REPLICATE_API_TOKEN,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasHuggingfaceToken: !!process.env.HUGGINGFACE_API_TOKEN,
    // Add model information
    availableModels: Object.keys(MODEL_CONFIGS),
    defaultModel: DEFAULT_MODEL
  });
});

// Start server (for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
