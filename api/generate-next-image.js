const { 
  generateInitialImage, 
  generateNextImage, 
  evolvePrompt, 
  DEFAULT_MODEL
} = require('../backend/aiService');

module.exports = async function handler(req, res) {
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
          const evolvedResult = await evolvePrompt(currentPrompt);
          nextPrompt = evolvedResult.evolvedPrompt;
          console.log('Prompt evolved successfully');
        } catch (error) {
          console.warn('Prompt evolution failed, using original:', error.message);
        }
      }
      
      result = await generateNextImage(previousImage, nextPrompt, modelName);
    }
    
    if (!result) {
      throw new Error('Failed to generate image');
    }
    
    console.log('Image generation completed successfully');
    
    const response = {
      imageUrl: result.imageUrl,
      prompt: result.prompt,
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
} 