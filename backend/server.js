require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generateInitialImage, generateNextImage, evolvePrompt } = require('./aiService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API endpoint to generate next image
app.post('/api/generate-next-image', async (req, res) => {
  try {
    const { previousImage, currentPrompt } = req.body;
    
    console.log('Received request for image generation');
    console.log('Previous image provided:', !!previousImage);
    console.log('Current prompt provided:', !!currentPrompt);
    
    let result;
    
    if (!previousImage) {
      // Generate initial image
      console.log('Generating initial image...');
      result = await generateInitialImage(currentPrompt);
    } else {
      // Generate next image with outpainting
      console.log('Generating next image with outpainting...');
      
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
      
      result = await generateNextImage(previousImage, nextPrompt);
    }
    
    console.log('Image generation completed:', result.imageUrl);
    
    res.json({
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      isInitial: result.isInitial,
      timestamp: result.timestamp,
      width: result.width,
      height: result.height
    });
    
  } catch (error) {
    console.error('Error generating image:', error);
    
    // Return detailed error information for debugging
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
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
    hasHuggingfaceToken: !!process.env.HUGGINGFACE_API_TOKEN
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint: http://localhost:${PORT}/api/generate-next-image`);
  console.log(`Environment info: http://localhost:${PORT}/env-info`);
});
