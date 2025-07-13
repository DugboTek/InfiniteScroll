import Replicate from 'replicate';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

// Initialize AI services
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuration constants
const IMAGE_WIDTH = parseInt(process.env.IMAGE_WIDTH) || 1024;
const IMAGE_HEIGHT = parseInt(process.env.IMAGE_HEIGHT) || 768;

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
  }
};

const DEFAULT_MODEL = 'flux-schnell';

// Create outpainting setup: extract bottom slice and create mask
async function createOutpaintingSetup(previousImageUrl) {
  try {
    console.log('🔧 Creating outpainting setup...');
    
    // Download the previous image
    const response = await fetch(previousImageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // Extract bottom slice (35% of image height for smoother transitions)
    const sliceHeight = Math.floor(height * 0.35);
    const bottomSlice = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: height - sliceHeight,
        width: width,
        height: sliceHeight
      })
      .png()
      .toBuffer();
    
    // Create new canvas with slice at top
    const newCanvas = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
    .composite([{
      input: bottomSlice,
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();
    
    // Create mask: BLACK (preserve) at top, WHITE (generate) at bottom
    const maskHeight = IMAGE_HEIGHT - sliceHeight;
    const mask = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 3,
        background: { r: 0, g: 0, b: 0 } // Black (preserve)
      }
    })
    .composite([{
      input: await sharp({
        create: {
          width: IMAGE_WIDTH,
          height: maskHeight,
          channels: 3,
          background: { r: 255, g: 255, b: 255 } // White (generate)
        }
      }).png().toBuffer(),
      top: sliceHeight,
      left: 0
    }])
    .png()
    .toBuffer();
    
    // Convert to base64 data URLs
    const imageDataUrl = `data:image/png;base64,${newCanvas.toString('base64')}`;
    const maskDataUrl = `data:image/png;base64,${mask.toString('base64')}`;
    
    console.log('✅ Outpainting setup created successfully');
    
    return {
      image: imageDataUrl,
      mask: maskDataUrl,
      sliceHeight
    };
    
  } catch (error) {
    console.error('❌ Error creating outpainting setup:', error);
    throw new Error(`Failed to create outpainting setup: ${error.message}`);
  }
}

// Crop outpainted image to remove duplicate slice
async function cropOutpaintedImage(imageUrl, sliceHeight) {
  try {
    console.log(`🔧 Cropping image: removing top ${sliceHeight}px slice...`);
    
    // Download the generated image
    const response = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // Crop out the slice portion (remove top sliceHeight pixels)
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: sliceHeight,
        width: width,
        height: height - sliceHeight
      })
      .png()
      .toBuffer();
    
    // Convert to data URL
    const croppedDataUrl = `data:image/png;base64,${croppedBuffer.toString('base64')}`;
    
    console.log(`✅ Image cropped successfully: ${width}x${height} → ${width}x${height - sliceHeight}`);
    
    return croppedDataUrl;
    
  } catch (error) {
    console.error('❌ Error cropping outpainted image:', error);
    // Return original image if cropping fails
    return imageUrl;
  }
}

// Generate initial image
async function generateInitialImage(customPrompt = null, modelName = DEFAULT_MODEL) {
  try {
    console.log(`🎨 Starting initial image generation with model: ${modelName}`);
    
    const startTime = Date.now();
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    
    const basePrompt = customPrompt || "Perfect top-down aerial view of a vast landscape captured directly from above, bird's eye perspective, satellite view, overhead shot, detailed terrain visible from high altitude";
    
    console.log(`📝 Using prompt: ${basePrompt}`);
    
    const output = await replicate.run(config.name, {
      input: {
        prompt: basePrompt,
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        num_inference_steps: config.steps,
        guidance_scale: config.guidance_scale,
        num_outputs: 1
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

// Generate next image
async function generateNextImage(previousImage, prompt, modelName = DEFAULT_MODEL) {
  try {
    console.log(`🎨 Generating next image with model: ${modelName}`);
    
    const startTime = Date.now();
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    
    // Enhanced prompt for continuation with strict top-down perspective
    const enhancedPrompt = `Continue this top-down aerial view seamlessly below the existing terrain. Bird's eye perspective maintained, camera positioned directly overhead. ${prompt}. The landscape extends naturally southward maintaining the exact same altitude and viewing angle.`;
    
    let inputParams = {
      prompt: enhancedPrompt,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      num_inference_steps: config.steps,
      guidance_scale: config.guidance_scale,
      num_outputs: 1
    };
    
    // For outpainting models, create proper setup with image and mask
    let outpaintingData = null;
    if (modelName === 'flux-fill-pro' && previousImage) {
      outpaintingData = await createOutpaintingSetup(previousImage);
      inputParams.image = outpaintingData.image;
      inputParams.mask = outpaintingData.mask;
      console.log(`🖼️ Using outpainting setup: slice height ${outpaintingData.sliceHeight}px`);
    }
    
    const output = await replicate.run(config.name, {
      input: inputParams
    });
    
    let imageUrl = Array.isArray(output) ? output[0] : output;
    
    // If this was outpainting, crop out the duplicate slice portion
    if (modelName === 'flux-fill-pro' && previousImage) {
      console.log('🔧 Cropping duplicate slice from outpainted image...');
      imageUrl = await cropOutpaintedImage(imageUrl, outpaintingData.sliceHeight);
    }
    
    const generationTime = Date.now() - startTime;
    
    return {
      imageUrl,
      prompt: enhancedPrompt,
      modelUsed: modelName,
      generationTime,
      timestamp: new Date().toISOString(),
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT
    };
    
  } catch (error) {
    console.error('❌ Error generating next image:', error);
    throw new Error(`Failed to generate next image: ${error.message}`);
  }
}

// Evolve prompt
async function evolvePrompt(currentPrompt) {
  try {
    console.log('🧠 Evolving prompt for narrative continuity...');
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const evolutionPrompt = `
You are creating a visual narrative for an infinite scroll of top-down aerial landscape images. 

Current scene: "${currentPrompt}"

Create the next scene in this visual story by:
1. STRICT top-down perspective - camera positioned directly overhead, bird's eye view
2. Landscape continues naturally to the south/below
3. Same altitude and viewing angle maintained throughout
4. Add new terrain features that flow naturally from the previous scene
5. Keep response under 200 characters

Respond with ONLY the new scene description maintaining perfect overhead perspective:`;
    
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
      evolvedPrompt: `${currentPrompt}. The landscape continues with new mysteries revealed.`
    };
  }
}

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
      modelName = null,
      debugMode = false 
    } = req.body;
    
    // Auto-select model based on whether this is initial generation or continuation
    const selectedModel = modelName || (previousImage ? 'flux-fill-pro' : 'flux-schnell');
    
    console.log('Received request for image generation');
    console.log('Previous image provided:', !!previousImage);
    console.log('Current prompt provided:', !!currentPrompt);
    console.log('Model requested:', modelName);
    console.log('Model selected:', selectedModel);
    console.log('Debug mode:', debugMode);
    
    let result;
    
    if (!previousImage) {
      // Generate initial image
      console.log(`Generating initial image with model: ${selectedModel}...`);
      result = await generateInitialImage(currentPrompt, selectedModel);
    } else {
      // Generate next image with outpainting
      console.log(`Generating next image with model: ${selectedModel}...`);
      
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
      
      result = await generateNextImage(previousImage, nextPrompt, selectedModel);
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
}; 