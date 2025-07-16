require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { 
  generateInitialImage, 
  generateNextImage, 
  evolvePrompt, 
  getAvailableModels, 
  MODEL_CONFIGS, 
  DEFAULT_MODEL
} = require('./aiService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware with increased payload limit for base64 image data
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large image data
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API endpoint to generate next image with model selection
app.post('/api/generate-next-image', async (req, res) => {
  try {
    console.log('🟢 === BACKEND SERVER DEBUG ===');
    console.log('📥 Request received:');
    
    const { 
      previousImage, 
      currentPrompt, 
      modelName = null,
      debugMode = false 
    } = req.body;
    
    console.log('📋 Raw request body fields:');
    console.log('  - previousImage:', !!previousImage);
    console.log('  - currentPrompt:', currentPrompt);
    console.log('  - modelName:', modelName);
    console.log('  - debugMode:', debugMode);
    
    // Debug request size
    const requestSize = JSON.stringify(req.body).length;
    console.log(`📊 Request size: ${(requestSize / 1024 / 1024).toFixed(2)} MB`);
    if (previousImage) {
      console.log(`📊 Previous image size: ${(previousImage.length / 1024).toFixed(2)} KB`);
    }
    
    // Auto-select model based on whether this is initial generation or continuation
    const selectedModel = modelName || (previousImage ? 'flux-fill-pro' : 'flux-schnell');
    
    console.log('🎯 Model selection logic:');
    console.log('  - modelName (requested):', modelName);
    console.log('  - previousImage exists:', !!previousImage);
    console.log('  - selectedModel (final):', selectedModel);
    
    console.log('🔍 Prompt analysis:');
    console.log('  - currentPrompt type:', typeof currentPrompt);
    console.log('  - currentPrompt value:', JSON.stringify(currentPrompt));
    console.log('  - currentPrompt length:', currentPrompt ? currentPrompt.length : 0);
    console.log('  - currentPrompt truthy:', !!currentPrompt);
    
    let result;
    
    if (!previousImage) {
      // Generate initial image
      console.log('🎨 === INITIAL IMAGE GENERATION PATH ===');
      console.log('  - Path: generateInitialImage');
      console.log('  - currentPrompt passed to AI:', currentPrompt);
      console.log('  - selectedModel passed to AI:', selectedModel);
      
      result = await generateInitialImage(currentPrompt, selectedModel);
      
      console.log('📨 generateInitialImage result:');
      console.log('  - result exists:', !!result);
      console.log('  - result.imageUrl:', !!result?.imageUrl);
      console.log('  - result.prompt:', result?.prompt);
      console.log('  - result.modelUsed:', result?.modelUsed);
      
    } else {
      // Generate next image with outpainting
      console.log('🎨 === CONTINUATION IMAGE GENERATION PATH ===');
      console.log('  - Path: generateNextImage');
      console.log('  - currentPrompt before evolution:', currentPrompt);
      
      // Evolve the prompt for narrative continuity
      let nextPrompt = currentPrompt;
      if (currentPrompt) {
        try {
          console.log('🧠 Evolving prompt...');
          const evolvedResult = await evolvePrompt(currentPrompt);
          nextPrompt = evolvedResult.evolvedPrompt;
          console.log('✅ Prompt evolved successfully:');
          console.log('  - original:', currentPrompt);
          console.log('  - evolved:', nextPrompt);
        } catch (error) {
          console.warn('⚠️ Prompt evolution failed, using original:', error.message);
          console.log('  - fallback prompt:', currentPrompt);
        }
      }
      
      console.log('  - nextPrompt passed to AI:', nextPrompt);
      console.log('  - selectedModel passed to AI:', selectedModel);
      
      result = await generateNextImage(previousImage, nextPrompt, selectedModel);
      
      console.log('📨 generateNextImage result:');
      console.log('  - result exists:', !!result);
      console.log('  - result.imageUrl:', !!result?.imageUrl);
      console.log('  - result.prompt:', result?.prompt);
      console.log('  - result.modelUsed:', result?.modelUsed);
    }
    
    if (!result) {
      console.error('❌ No result from AI service');
      throw new Error('Failed to generate image');
    }

    console.log('✅ Image generation completed successfully');
    
    const response = {
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      evolvedPrompt: result.evolvedPrompt,
      modelUsed: result.modelUsed,
      generationTime: result.generationTime,
      debugInfo: debugMode ? result.debugInfo : undefined
    };
    
    console.log('📤 Sending response to frontend:');
    console.log('  - imageUrl:', !!response.imageUrl);
    console.log('  - prompt:', response.prompt);
    console.log('  - evolvedPrompt:', response.evolvedPrompt);
    console.log('  - modelUsed:', response.modelUsed);
    console.log('  - generationTime:', response.generationTime);
    console.log('🟢 === END BACKEND SERVER DEBUG ===');
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoint to get available models
app.get('/api/models', async (req, res) => {
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
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎨 Image generation: http://localhost:${PORT}/api/generate-next-image`);
  console.log(`🔧 Models endpoint: http://localhost:${PORT}/api/models`);
});
