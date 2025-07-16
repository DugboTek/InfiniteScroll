const Replicate = require('replicate');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const axios = require('axios');

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
    steps: 8.2,
    guidance_scale: 0.0,
    use_case: 'speed'
  },
  'flux-fill-pro': {
    name: 'black-forest-labs/flux-fill-pro', 
    steps: 16,
    guidance_scale: 3.5, // what does this do?
    use_case: 'outpainting'
  }
};

const DEFAULT_MODEL = 'flux-schnell';

// Create advanced outpainting setup with gradient masks and feathering for seamless flow
async function createOutpaintingSetup(previousImageUrl) {
  try {
    console.log('🔧 Creating advanced outpainting setup for seamless flow...');
    
    // Download the previous image
    const response = await axios.get(previousImageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    console.log(`📏 Input image dimensions: ${width}x${height}`);
    
    // Use optimal slice size for seamless transitions (35%)
    const sliceHeight = Math.floor(height * 0.35);
    console.log(`📏 Extracting slice: ${sliceHeight}px from bottom of ${width}x${height} image`);
    
    // Extract bottom slice with feathered edges for better blending
    const bottomSlice = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: height - sliceHeight,
        width: width,
        height: sliceHeight
      })
      .resize(IMAGE_WIDTH, sliceHeight)
      .png()
      .toBuffer();
    
    console.log(`📏 Resized slice to: ${IMAGE_WIDTH}x${sliceHeight}`);
    
    // Create new canvas with slice at top
    const newCanvas = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 3,
        background: { r: 128, g: 128, b: 128 } // Neutral gray for better AI generation
      }
    })
    .composite([{
      input: bottomSlice,
      top: 0,
      left: 0,
      blend: 'over'
    }])
    .png()
    .toBuffer();
    
    console.log(`📏 Created new canvas: ${IMAGE_WIDTH}x${IMAGE_HEIGHT} with slice at top`);
    
    // Create gradient mask for smooth blending
    const maskHeight = IMAGE_HEIGHT - sliceHeight;
    const gradientZone = Math.min(60, Math.floor(sliceHeight * 0.4)); // Gradient transition zone
    
    console.log(`📏 Creating gradient mask with ${gradientZone}px transition zone`);
    
    // Create base mask
    let mask = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 3,
        background: { r: 255, g: 255, b: 255 } // White (generate)
      }
    }).png().toBuffer();
    
    // Add black preservation area (stronger preservation)
    const preserveHeight = sliceHeight - gradientZone;
    if (preserveHeight > 0) {
      const blackArea = await sharp({
        create: {
          width: IMAGE_WIDTH,
          height: preserveHeight,
          channels: 3,
          background: { r: 0, g: 0, b: 0 } // Black (preserve strongly)
        }
      }).png().toBuffer();
      
      mask = await sharp(mask)
        .composite([{ input: blackArea, top: 0, left: 0 }])
        .png()
        .toBuffer();
    }
    
    // Add gradient transition zone
    for (let i = 0; i < gradientZone; i++) {
      const intensity = Math.floor(255 * (i / gradientZone)); // 0 to 255 gradient
      const gradientLine = await sharp({
        create: {
          width: IMAGE_WIDTH,
          height: 1,
          channels: 3,
          background: { r: intensity, g: intensity, b: intensity }
        }
      }).png().toBuffer();
      
      mask = await sharp(mask)
        .composite([{ 
          input: gradientLine, 
          top: preserveHeight + i, 
          left: 0,
          blend: 'over' 
        }])
        .png()
        .toBuffer();
    }
    
    // Convert to base64 data URLs
    const imageDataUrl = `data:image/png;base64,${newCanvas.toString('base64')}`;
    const maskDataUrl = `data:image/png;base64,${mask.toString('base64')}`;
    
    console.log(`📏 Created gradient mask: preserve ${preserveHeight}px, gradient ${gradientZone}px, generate ${maskHeight}px`);
    console.log('✅ Advanced outpainting setup created for seamless flow');
    
    return {
      image: imageDataUrl,
      mask: maskDataUrl,
      sliceHeight,
      gradientZone,
      preserveHeight
    };
    
  } catch (error) {
    console.error('❌ Error creating advanced outpainting setup:', error);
    throw new Error(`Failed to create advanced outpainting setup: ${error.message}`);
  }
}

// Crop outpainted image to maintain perfect seamless flow
async function cropOutpaintedImage(imageUrl, sliceHeight, gradientZone = 0) {
  try {
    console.log(`🔧 Cropping image for perfect seamless flow...`);
    
    // Download the generated image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // For perfect seamless flow, crop minimal amount
    // Only remove the hard preservation area, keep the gradient zone for natural blending
    const cropAmount = Math.max(20, Math.floor(sliceHeight * 0.2)); // Minimal crop for seamless flow
    
    console.log(`📏 Perfect seamless flow: cropping only ${cropAmount}px (keeping ${sliceHeight - cropAmount}px for natural transition)`);
    
    // Crop minimal amount to maintain visual continuity
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: cropAmount,
        width: width,
        height: height - cropAmount
      })
      .png()
      .toBuffer();
    
    // Convert to data URL
    const croppedDataUrl = `data:image/png;base64,${croppedBuffer.toString('base64')}`;
    
    console.log(`✅ Perfect seamless crop: ${width}x${height} → ${width}x${height - cropAmount} (maintained natural transition)`);
    
    return croppedDataUrl;
    
  } catch (error) {
    console.error('❌ Error cropping for seamless flow:', error);
    // Return original image if cropping fails
    return imageUrl;
  }
}

// Generate initial image
async function generateInitialImage(customPrompt = null, modelName = DEFAULT_MODEL) {
  try {
    console.log('🔵 === AI SERVICE - INITIAL IMAGE DEBUG ===');
    console.log('📥 generateInitialImage called with:');
    console.log('  - customPrompt:', customPrompt);
    console.log('  - customPrompt type:', typeof customPrompt);
    console.log('  - customPrompt truthy:', !!customPrompt);
    console.log('  - modelName:', modelName);
    
    const startTime = Date.now();
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    
    console.log('🎯 Model configuration:');
    console.log('  - config.name:', config.name);
    console.log('  - config.steps:', config.steps);
    console.log('  - config.guidance_scale:', config.guidance_scale);
    
    // For initial images, use user prompt directly without evolution
    const basePrompt = customPrompt 
      ? `Perfect top-down aerial view of ${customPrompt} captured directly from above, bird's eye perspective, satellite view, overhead shot, detailed terrain featuring ${customPrompt} visible from high altitude`
      : "Perfect top-down aerial view of a vast landscape captured directly from above, bird's eye perspective, satellite view, overhead shot, detailed terrain visible from high altitude";
    
    console.log('🔍 Prompt construction:');
    console.log('  - customPrompt input:', customPrompt);
    console.log('  - basePrompt (final):', basePrompt);
    console.log('  - prompt length:', basePrompt.length);
    
    console.log('🚀 Sending to Replicate API...');
    console.log('  - model:', config.name);
    console.log('  - prompt:', basePrompt);
    console.log('  - width:', IMAGE_WIDTH);
    console.log('  - height:', IMAGE_HEIGHT);
    
    const output = await replicate.run(config.name, {
      input: {
        prompt: basePrompt,
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        num_inference_steps: config.steps,
        guidance_scale: config.guidance_scale,
        num_outputs: 1,
        seed: Math.floor(Math.random() * 1000000)
      }
    });
    
    console.log('📨 Replicate API response:');
    console.log('  - output type:', typeof output);
    console.log('  - output length:', Array.isArray(output) ? output.length : 'not array');
    console.log('  - first output:', Array.isArray(output) ? output[0] : output);
    
    const generationTime = Date.now() - startTime;
    console.log(`⏱️ Generation time: ${generationTime}ms`);
    
    const result = {
      imageUrl: Array.isArray(output) ? output[0] : output,
      prompt: customPrompt || 'random landscape',
      evolvedPrompt: null,
      modelUsed: config.name,
      generationTime: generationTime,
      debugInfo: {
        originalPrompt: customPrompt,
        finalPrompt: basePrompt,
        modelConfig: config,
        isInitial: true
      }
    };
    
    console.log('📤 Final result being returned:');
    console.log('  - imageUrl:', !!result.imageUrl);
    console.log('  - prompt:', result.prompt);
    console.log('  - evolvedPrompt:', result.evolvedPrompt);
    console.log('  - modelUsed:', result.modelUsed);
    console.log('  - generationTime:', result.generationTime);
    console.log('🔵 === END AI SERVICE - INITIAL IMAGE DEBUG ===');
    
    return result;
    
  } catch (error) {
    console.error('❌ Error generating initial image:', error);
    throw new Error(`Failed to generate initial image: ${error.message}`);
  }
}

// Generate next image
async function generateNextImage(previousImage, prompt, modelName = DEFAULT_MODEL) {
  try {
    console.log(`🎨 Generating next image with model: ${modelName}`);
    console.log(`🔍 DEBUG - Original continuation prompt: "${prompt}"`);
    
    const startTime = Date.now();
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    
    // Enhanced prompt for continuation with strict top-down perspective
    const enhancedPrompt = `Continue this top-down aerial view seamlessly below the existing image. Cyrrent imagesperspective maintained, camera positioned directly overhead. ${prompt}. The view extends naturally southward maintaining the exact same altitude and viewing angle.`;
    
    console.log(`🔍 DEBUG - Enhanced prompt sent to AI: "${enhancedPrompt}"`);
    console.log(`🔍 DEBUG - Model: ${config.name}, Steps: ${config.steps}, Guidance: ${config.guidance_scale}`);
    
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
      imageUrl = await cropOutpaintedImage(imageUrl, outpaintingData.sliceHeight, outpaintingData.gradientZone);
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
    console.log(`🔍 DEBUG - Input prompt to evolve: "${currentPrompt}"`);
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const evolutionPrompt = `
You are creating a visual narrative for an infinite scroll of top-down aerial images. 

Current scene: "${currentPrompt}" keep the scene as close to the original as possible. but continue it in a logical order as if the camera was panning down or as if the original view is going up as the user scrolls

Create the next scene in this visual story by:
1. STRICT top-down perspective - camera positioned directly overhead, bird's eye view
3. Same altitude and viewing angle maintained throughout
4. Add new features that flow naturally from the previous scene
5. Keep response under 200 characters

Respond with ONLY the new scene description maintaining perfect overhead perspective:`;
    
    const result = await model.generateContent(evolutionPrompt);
    const evolvedPrompt = result.response.text().trim();
    
    console.log(`🔍 DEBUG - Evolved prompt result: "${evolvedPrompt}"`);
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

// Get available models
function getAvailableModels() {
  return Object.keys(MODEL_CONFIGS).map(key => ({
    id: key,
    name: key,
    ...MODEL_CONFIGS[key]
  }));
}

module.exports = {
  generateInitialImage,
  generateNextImage,
  evolvePrompt,
  getAvailableModels,
  MODEL_CONFIGS,
  DEFAULT_MODEL,
  IMAGE_WIDTH,
  IMAGE_HEIGHT
};
