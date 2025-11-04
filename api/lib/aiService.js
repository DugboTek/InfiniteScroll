import Replicate from 'replicate';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import sharp from 'sharp';

// Initialize AI services
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuration constants
const IMAGE_WIDTH = parseInt(process.env.IMAGE_WIDTH) || 1024;
const IMAGE_HEIGHT = parseInt(process.env.IMAGE_HEIGHT) || 768;

// Model configurations
const MODEL_CONFIGS = {
  'dall-e-3': {
    name: 'dall-e-3',
    steps: 1, // Not applicable, but for consistency
    guidance_scale: 0.0, // Not applicable
    use_case: 'quality',
    api: 'openai'
  },
  'flux-schnell': {
    name: 'black-forest-labs/flux-schnell',
    steps: 1,
    max_steps: 4, // Add max steps limit
    guidance_scale: 0.0,
    use_case: 'speed',
    api: 'replicate'
  },
  'flux-fill-pro': {
    name: 'black-forest-labs/flux-fill-pro',
    steps: 4,
    max_steps: 20, // Add max steps limit
    guidance_scale: 3.5,
    use_case: 'outpainting',
    api: 'replicate'
  }
};

const DEFAULT_MODEL = 'dall-e-3';

// Create outpainting setup for DALL-E (requires transparency)
async function createDalleOutpaintingSetup(previousImageUrl) {
  try {
    console.log('🔧 Creating DALL-E outpainting setup with transparency...');
    const response = await fetch(previousImageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    const sliceHeight = Math.floor(height * 0.35);

    // Extract bottom slice
    const bottomSlice = await sharp(imageBuffer)
      .extract({ left: 0, top: height - sliceHeight, width: width, height: sliceHeight })
      .toBuffer();

    // Create a new RGBA canvas with a transparent area for DALL-E to fill
    const newCanvas = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 4, // Must be RGBA for transparency
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Fully transparent
      }
    })
    .composite([{ input: bottomSlice, top: 0, left: 0 }])
    .png() // Must be PNG to support transparency
    .toBuffer();

    console.log('✅ DALL-E outpainting setup created.');
    return {
      image: newCanvas, // Return buffer directly for OpenAI client
      sliceHeight
    };
  } catch (error) {
    console.error('❌ Error creating DALL-E outpainting setup:', error);
    throw error;
  }
}


// Create advanced outpainting setup with gradient masks and feathering for seamless flow
async function createOutpaintingSetup(previousImageUrl) {
  try {
    console.log('🔧 Creating advanced outpainting setup for seamless flow...');
    
    // Download the previous image
    const response = await fetch(previousImageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
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
    
    // Create enhanced gradient mask for better AI generation
    const maskHeight = IMAGE_HEIGHT - sliceHeight;
    const gradientZone = Math.min(40, Math.floor(sliceHeight * 0.3)); // Smaller gradient for cleaner separation
    
    console.log(`📏 Creating enhanced gradient mask with ${gradientZone}px transition zone`);
    
    // Create base mask - white for generation area
    let mask = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 3,
        background: { r: 255, g: 255, b: 255 } // White (generate new content)
      }
    }).png().toBuffer();
    
    // Add black preservation area (preserve original slice)
    const preserveHeight = sliceHeight - gradientZone;
    if (preserveHeight > 0) {
      const blackArea = await sharp({
        create: {
          width: IMAGE_WIDTH,
          height: preserveHeight,
          channels: 3,
          background: { r: 0, g: 0, b: 0 } // Black (preserve original)
        }
      }).png().toBuffer();
      
      mask = await sharp(mask)
        .composite([{ input: blackArea, top: 0, left: 0 }])
        .png()
        .toBuffer();
    }
    
    // Add steeper gradient transition for cleaner generation boundary
    for (let i = 0; i < gradientZone; i++) {
      // Use exponential curve for steeper transition
      const normalized = i / gradientZone;
      const exponential = Math.pow(normalized, 2); // Steeper curve
      const intensity = Math.floor(255 * exponential);
      
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
    console.log(`✂️ Cropping outpainted image to remove overlapping slice...`);
    
    // Download the generated image
    const response = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    // The amount to crop is *exactly* the height of the slice used for outpainting.
    // This precision is the key to a seamless transition.
    const cropAmount = sliceHeight;
    
    console.log(`📏 PRECISE CROP: Removing exact slice height for seamless flow.`);
    console.log(`   - Original image: ${width}x${height}`);
    console.log(`   - Slice height to remove: ${cropAmount}px`);
    
    // Safety check: ensure cropAmount is not going to result in a zero or negative height image.
    if (cropAmount >= height) {
      console.warn(`⚠️ Crop amount (${cropAmount}px) is too large for image height (${height}px). Returning original image.`);
      return imageUrl;
    }
    
    const finalHeight = height - cropAmount;
    console.log(`   - Final image dimensions: ${width}x${finalHeight}`);
    
    // Crop the exact slice height from the top of the image.
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: cropAmount,
        width: width,
        height: finalHeight
      })
      .png()
      .toBuffer();
    
    // Convert to data URL
    const croppedDataUrl = `data:image/png;base64,${croppedBuffer.toString('base64')}`;
    
    console.log(`✅ Precise crop complete. Image is ready for seamless display.`);
    
    return croppedDataUrl;
    
  } catch (error) {
    console.error('❌ Error during precise cropping:', error);
    // Return original image as a fallback if cropping fails.
    return imageUrl;
  }
}

// Generate initial image
async function generateInitialImage(customPrompt = null, modelName = DEFAULT_MODEL, steps = null) {
  try {
    console.log(`🎨 Starting initial image generation with model: ${modelName}`);
    console.log(`🔍 DEBUG - User provided custom prompt: "${customPrompt || 'none'}"`);
    console.log(`🔢 Steps override: ${steps}`);
    
    const startTime = Date.now();
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    
    const basePrompt = customPrompt 
      ? `Perfect top-down aerial view of ${customPrompt} captured directly from above, bird's eye perspective, satellite view, overhead shot, detailed terrain featuring ${customPrompt} visible from high altitude`
      : "Perfect top-down aerial view of a vast landscape captured directly from above, bird's eye perspective, satellite view, overhead shot, detailed terrain visible from high altitude";
    
    let imageUrl;
    let generationTime;

    if (config.api === 'openai') {
      console.log(`🤖 Calling OpenAI DALL-E 3 API...`);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: basePrompt,
        n: 1,
        size: "1024x1024", // DALL-E 3 has specific size requirements
        quality: "hd",
      });
      generationTime = Date.now() - startTime;
      imageUrl = response.data[0].url;
      console.log(`✅ OpenAI DALL-E 3 generation complete in ${generationTime}ms.`);
    } else {
      // Existing Replicate logic
      const clampedSteps = Math.min(steps || config.steps, config.max_steps || 20);
      console.log(`🤖 Calling Replicate API: ${config.name}`);
      const output = await replicate.run(config.name, {
        input: {
          prompt: basePrompt,
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          num_inference_steps: Math.round(clampedSteps), // Ensure integer and clamped
          guidance_scale: config.guidance_scale,
        },
      });
      generationTime = Date.now() - startTime;
      imageUrl = Array.isArray(output) ? output[0] : output;
      console.log(`✅ Replicate generation complete in ${generationTime}ms.`);
    }

    return {
      imageUrl: imageUrl,
      prompt: basePrompt,
      originalUserPrompt: customPrompt,
      isInitial: true,
      modelUsed: modelName,
      generationTime: generationTime,
      timestamp: new Date().toISOString(),
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT
    };
    
  } catch (error) {
    console.error('❌ Error generating initial image:', error);
    throw new Error(`Failed to generate initial image: ${error.message}`);
  }
}

// Generate next image using outpainting
async function generateNextImage(previousImage, prompt, modelName = DEFAULT_MODEL, originalUserPrompt = null, steps = null) {
  try {
    console.log(`🎨 Starting next image generation (outpainting) with model: ${modelName}`);
    console.log(`🔢 Steps override: ${steps}`);
    
    const startTime = Date.now();
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    let finalImageUrl;
    let generationTime;
    let sliceHeight = 0;

    if (config.api === 'openai') {
      console.log(`🤖 Calling OpenAI DALL-E 2/3 API for outpainting...`);
      const outpaintingSetup = await createDalleOutpaintingSetup(previousImage);
      sliceHeight = outpaintingSetup.sliceHeight;
      
      const response = await openai.images.edit({
        image: outpaintingSetup.image, // Pass the buffer directly
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });
      generationTime = Date.now() - startTime;
      finalImageUrl = response.data[0].url;
      console.log(`✅ OpenAI DALL-E outpainting complete in ${generationTime}ms.`);

    } else {
      // Existing Replicate logic
      const clampedSteps = Math.min(steps || config.steps, config.max_steps || 20);
      const outpaintingSetup = await createReplicateOutpaintingSetup(previousImage);
      sliceHeight = outpaintingSetup.sliceHeight;

      let replicateInput = {
        prompt: prompt,
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        num_inference_steps: Math.round(clampedSteps), // Ensure integer and clamped
        guidance_scale: config.guidance_scale,
        image: outpaintingSetup.image, // Data URL
        mask: outpaintingSetup.mask,   // Data URL
      };
      
      const output = await replicate.run(config.name, { input: replicateInput });
      generationTime = Date.now() - startTime;
      finalImageUrl = Array.isArray(output) ? output[0] : output;
    }
    
    // Crop the image to remove the original slice area for a seamless transition
    if (finalImageUrl && sliceHeight > 0) {
      console.log('✂️ Cropping generated image to ensure seamless transition...');
      finalImageUrl = await cropOutpaintedImage(finalImageUrl, sliceHeight);
    }

    return {
      imageUrl: finalImageUrl,
      prompt: prompt,
      originalUserPrompt: originalUserPrompt,
      evolvedPrompt: prompt,
      modelUsed: modelName,
      generationTime: generationTime,
      debugInfo: {
        requestedModel: modelName,
        modelUsed: config.name,
        generationTime: generationTime,
        inferenceSteps: steps || config.steps,
        guidanceScale: config.guidance_scale,
        supportsOutpainting: true,
        sliceHeight: sliceHeight,
      }
    };

  } catch (error) {
    console.error('❌ Error generating next image:', error);
    throw new Error(`Failed to generate next image: ${error.message}`);
  }
}

// Renaming original function to be more specific
const createReplicateOutpaintingSetup = createOutpaintingSetup;

// Evolve the prompt for narrative continuity
async function evolvePrompt(currentPrompt, originalUserPrompt = null) {
  try {
    console.log('🧠 Evolving prompt for narrative continuity...');
    console.log(`🔍 DEBUG - Input prompt to evolve: "${currentPrompt}"`);
    console.log(`🔍 DEBUG - Original user theme: "${originalUserPrompt || 'none'}"`);
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Build evolution prompt that maintains original theme
    let evolutionPrompt;
    
    if (originalUserPrompt) {
      evolutionPrompt = `
You are creating a visual narrative for an infinite scroll of top-down aerial landscape images that maintains a consistent theme.

ORIGINAL THEME: "${originalUserPrompt}"
Current scene: "${currentPrompt}"

Create the next scene in this visual story by:
1. MAINTAIN the original theme "${originalUserPrompt}" throughout the evolution
2. STRICT top-down perspective - camera positioned directly overhead, bird's eye view
3. Landscape continues naturally to the south/below 
4. Same altitude and viewing angle maintained throughout
5. Add new terrain features that flow naturally from the previous scene
6. ALWAYS incorporate elements related to "${originalUserPrompt}"
7. Keep response under 200 characters

Respond with ONLY the new scene description that maintains the "${originalUserPrompt}" theme while showing new areas:`;
    } else {
      evolutionPrompt = `
You are creating a visual narrative for an infinite scroll of top-down aerial landscape images. 

Current scene: "${currentPrompt}"

Create the next scene in this visual story by:
1. STRICT top-down perspective - camera positioned directly overhead, bird's eye view
2. Landscape continues naturally to the south/below
3. Same altitude and viewing angle maintained throughout
4. Add new terrain features that flow naturally from the previous scene
5. Keep response under 200 characters

Respond with ONLY the new scene description maintaining perfect overhead perspective:`;
    }
    
    const result = await model.generateContent(evolutionPrompt);
    const evolvedPrompt = result.response.text().trim();
    
    console.log(`🔍 DEBUG - Evolved prompt result: "${evolvedPrompt}"`);
    console.log(`✨ Prompt evolved with theme maintained: ${evolvedPrompt}`);
    
    return {
      originalPrompt: currentPrompt,
      evolvedPrompt: evolvedPrompt,
      themePrompt: originalUserPrompt
    };
    
  } catch (error) {
    console.warn('⚠️ Prompt evolution failed:', error.message);
    
    // Fallback that maintains theme
    let fallbackPrompt;
    if (originalUserPrompt) {
      fallbackPrompt = `${currentPrompt}. The ${originalUserPrompt} landscape continues with new features revealed.`;
    } else {
      fallbackPrompt = `${currentPrompt}. The landscape continues with new mysteries revealed.`;
    }
    
    return {
      originalPrompt: currentPrompt,
      evolvedPrompt: fallbackPrompt,
      themePrompt: originalUserPrompt
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

export {
  generateInitialImage,
  generateNextImage,
  evolvePrompt,
  getAvailableModels,
  MODEL_CONFIGS,
  DEFAULT_MODEL,
  IMAGE_WIDTH,
  IMAGE_HEIGHT
}; 