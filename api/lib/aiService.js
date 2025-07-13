const Replicate = require('replicate');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const axios = require('axios');

// Initialize AI services
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuration constants - must match Replicate supported dimensions
const IMAGE_WIDTH = parseInt(process.env.IMAGE_WIDTH) || 1024;
const IMAGE_HEIGHT = parseInt(process.env.IMAGE_HEIGHT) || 768;
const GENERATION_TIMEOUT = parseInt(process.env.GENERATION_TIMEOUT) || 60000;
const SLICE_HEIGHT = 80; // Reduced height to minimize repetition at seam

// Global state for theme continuity
let dreamWorldTheme = null; // Store the user's original dream world theme for consistent generation

// Model configurations optimized for speed and quality
const MODEL_CONFIGS = {
  'flux-schnell': {
    name: 'black-forest-labs/flux-schnell',
    steps: 1, // Ultra-fast mode for sub-10 second target
    guidance_scale: 0.0,
    use_case: 'speed',
    supports_outpainting: false,
    priority: 1 // Highest priority for fallbacks
  },
  'flux-fill-pro': {
    name: 'black-forest-labs/flux-fill-pro',
    steps: 4, // Quality mode
    guidance_scale: 3.5,
    use_case: 'outpainting',
    supports_outpainting: true,
    priority: 2
  },
  'flux-schnell-lora': {
    name: 'black-forest-labs/flux-schnell-lora',
    steps: 2, // Balanced mode  
    guidance_scale: 1.0,
    use_case: 'balanced',
    supports_outpainting: false,
    priority: 3
  }
};

// Default model for speed
const DEFAULT_MODEL = 'flux-schnell';

// Generate initial image
async function generateInitialImage(customPrompt = null, modelName = DEFAULT_MODEL) {
  try {
    console.log(`🎨 Starting initial image generation with model: ${modelName}`);
    
    const startTime = Date.now();
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    
    // Create or use provided prompt
    const basePrompt = customPrompt || "An epic aerial view of a vast mystical landscape with intricate details, captured from high above";
    
    // Store theme for continuity
    if (customPrompt) {
      dreamWorldTheme = customPrompt;
    }
    
    console.log(`📝 Using prompt: ${basePrompt}`);
    
    // Generate image using Replicate
    const output = await replicate.run(config.name, {
      input: {
        prompt: basePrompt,
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        num_inference_steps: config.steps,
        guidance_scale: config.guidance_scale,
        num_outputs: 1,
        scheduler: "K_EULER"
      }
    });
    
    const imageUrl = Array.isArray(output) ? output[0] : output;
    const generationTime = Date.now() - startTime;
    
    console.log(`✅ Initial image generated successfully in ${generationTime}ms`);
    
    return {
      imageUrl,
      prompt: basePrompt,
      isInitial: true,
      modelUsed: modelName,
      generationTime,
      timestamp: new Date().toISOString(),
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT
    };
    
  } catch (error) {
    console.error('❌ Error generating initial image:', error);
    throw new Error(`Failed to generate initial image: ${error.message}`);
  }
}

// Generate next image with outpainting
async function generateNextImage(previousImageUrl, prompt, modelName = DEFAULT_MODEL) {
  try {
    console.log(`🎨 Generating next image with model: ${modelName}`);
    
    const startTime = Date.now();
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    
    let result;
    
    if (config.supports_outpainting) {
      result = await generateWithOutpainting(previousImageUrl, prompt, config);
    } else {
      result = await generateWithFastMode(previousImageUrl, prompt, config);
    }
    
    const generationTime = Date.now() - startTime;
    
    return {
      ...result,
      modelUsed: modelName,
      generationTime,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error generating next image:', error);
    throw new Error(`Failed to generate next image: ${error.message}`);
  }
}

// Fast generation mode for speed-focused models
async function generateWithFastMode(previousImageUrl, prompt, config) {
  console.log('🚀 Using fast mode generation...');
  
  // For fast mode, we generate based on evolved prompt without complex outpainting
  const enhancedPrompt = await addContextualCues(previousImageUrl, prompt);
  
  const output = await replicate.run(config.name, {
    input: {
      prompt: enhancedPrompt,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      num_inference_steps: config.steps,
      guidance_scale: config.guidance_scale,
      num_outputs: 1,
      scheduler: "K_EULER"
    }
  });
  
  const imageUrl = Array.isArray(output) ? output[0] : output;
  
  return {
    imageUrl,
    prompt: enhancedPrompt,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT
  };
}

// Enhanced outpainting mode
async function generateWithOutpainting(previousImageUrl, prompt, config) {
  console.log('🎨 Using outpainting mode...');
  
  // Download and process previous image
  const previousImageBuffer = await downloadImage(previousImageUrl);
  const { canvas, mask } = await createOutpaintingInputs(previousImageBuffer);
  
  const output = await replicate.run(config.name, {
    input: {
      image: canvas,
      mask: mask,
      prompt: prompt,
      num_inference_steps: config.steps,
      guidance_scale: config.guidance_scale,
      num_outputs: 1
    }
  });
  
  const imageUrl = Array.isArray(output) ? output[0] : output;
  
  return {
    imageUrl,
    prompt,
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT
  };
}

// Create outpainting inputs
async function createOutpaintingInputs(previousImageBuffer) {
  const image = sharp(previousImageBuffer);
  const { width, height } = await image.metadata();
  
  // Extract bottom slice
  const sliceHeight = Math.min(SLICE_HEIGHT, Math.floor(height * 0.1));
  const bottomSlice = await image
    .extract({ 
      left: 0, 
      top: height - sliceHeight, 
      width: width, 
      height: sliceHeight 
    })
    .toBuffer();
  
  // Create new canvas
  const canvas = await createOutpaintingCanvas(bottomSlice);
  
  // Create mask (black = preserve, white = generate)
  const mask = await sharp({
    create: {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 } // White background
    }
  })
  .composite([{
    input: await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: sliceHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 } // Black top section
      }
    }).png().toBuffer(),
    top: 0,
    left: 0
  }])
  .png()
  .toBuffer();
  
  return {
    canvas: `data:image/png;base64,${canvas.toString('base64')}`,
    mask: `data:image/png;base64,${mask.toString('base64')}`
  };
}

// Create outpainting canvas
async function createOutpaintingCanvas(bottomSlice) {
  const canvas = await sharp({
    create: {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      channels: 3,
      background: { r: 128, g: 128, b: 128 } // Neutral gray
    }
  })
  .composite([{
    input: bottomSlice,
    top: 0,
    left: 0
  }])
  .png()
  .toBuffer();
  
  return canvas;
}

// Add contextual cues for better continuity
async function addContextualCues(previousImageUrl, prompt) {
  // Enhance prompt with continuity cues
  const contextualPrompt = `Continuing the scene from above, ${prompt}. The view extends downward naturally, maintaining the same artistic style and perspective as the previous image. Aerial view, captured from high above.`;
  
  return contextualPrompt;
}

// Evolve prompt for narrative continuity
async function evolvePrompt(currentPrompt) {
  try {
    console.log('🧠 Evolving prompt for narrative continuity...');
    
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const evolutionPrompt = `
You are creating a visual narrative for an infinite scroll of aerial landscape images. 

Current scene: "${currentPrompt}"

Create the next scene in this visual story by:
1. Maintaining the aerial/overhead perspective 
2. Naturally progressing the narrative or environment
3. Adding new interesting elements while keeping visual coherence
4. Keeping the response under 200 characters

Respond with ONLY the new scene description, no explanations:`;
    
    const result = await model.generateContent(evolutionPrompt);
    const evolvedPrompt = result.response.text().trim();
    
    console.log(`✨ Prompt evolved: ${evolvedPrompt}`);
    
    return {
      originalPrompt: currentPrompt,
      evolvedPrompt: evolvedPrompt
    };
    
  } catch (error) {
    console.warn('⚠️ Prompt evolution failed:', error.message);
    return {
      originalPrompt: currentPrompt,
      evolvedPrompt: addPromptVariation(currentPrompt)
    };
  }
}

// Simple prompt variation fallback
function addPromptVariation(prompt) {
  const variations = [
    "The landscape continues with new mysteries revealed",
    "New terrain emerges as the view extends further", 
    "The scene evolves with unexpected discoveries",
    "Fresh landscapes unfold in the continuing journey"
  ];
  
  const variation = variations[Math.floor(Math.random() * variations.length)];
  return `${prompt}. ${variation}`;
}

// Download image from URL
async function downloadImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000
    });
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

// Get available models
function getAvailableModels() {
  return Object.keys(MODEL_CONFIGS);
}

module.exports = {
  generateInitialImage,
  generateNextImage,
  evolvePrompt,
  getAvailableModels,
  MODEL_CONFIGS,
  DEFAULT_MODEL
}; 