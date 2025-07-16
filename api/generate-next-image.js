import { 
  generateInitialImage, 
  generateNextImage, 
  evolvePrompt, 
  DEFAULT_MODEL 
} from './lib/aiService.js';

// Serverless function handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      previousImage, 
      currentPrompt, 
      originalUserPrompt = null, // Track original user theme
      modelName = null,
      debugMode = false,
      inferenceSteps = null // Get steps from body
    } = req.body;
    
    // Auto-select model based on whether this is an initial generation or a continuation
    const selectedModel = modelName || (previousImage ? 'flux-fill-pro' : 'flux-schnell');
    
    console.log('Received request for image generation');
    console.log('Previous image provided:', !!previousImage);
    console.log('Current prompt provided:', !!currentPrompt);
    console.log(`🔍 DEBUG - Raw currentPrompt from frontend: "${currentPrompt || 'none'}"`);
    console.log('Model requested:', modelName);
    console.log('Model selected:', selectedModel);
    console.log('Debug mode:', debugMode);
    
    let result;
    
    if (!previousImage) {
      // Generate initial image
      console.log(`Generating initial image with model: ${selectedModel}...`);
      result = await generateInitialImage(currentPrompt, selectedModel, inferenceSteps);
    } else {
      // Generate next image with outpainting
      console.log(`Generating next image with model: ${selectedModel}...`);
      
      // Evolve the prompt for narrative continuity while maintaining original theme
      let nextPrompt = currentPrompt;
      if (currentPrompt) {
        try {
          const evolvedResult = await evolvePrompt(currentPrompt, originalUserPrompt);
          nextPrompt = evolvedResult.evolvedPrompt;
          console.log('Prompt evolved successfully with theme maintained');
        } catch (error) {
          console.warn('Prompt evolution failed, using original:', error.message);
        }
      }
      
      result = await generateNextImage(previousImage, nextPrompt, selectedModel, originalUserPrompt, inferenceSteps);
    }
    
    if (!result) {
      throw new Error('Failed to generate image');
    }
    
    console.log('Image generation completed successfully');
    
    const response = {
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      originalUserPrompt: result.originalUserPrompt,
      evolvedPrompt: result.evolvedPrompt,
      modelUsed: result.modelUsed,
      generationTime: result.generationTime,
      debugInfo: debugMode ? result.debugInfo : undefined
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 