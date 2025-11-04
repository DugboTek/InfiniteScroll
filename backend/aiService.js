const Replicate = require('replicate');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
    guidance_scale: 7,
    api: 'openai'
  },
  'gpt-image-1': {
    name: 'gpt-image-1',
    steps: 1,
    guidance_scale: 7,
    api: 'openai'
  },
  'gpt-4o-image': {
    name: 'gpt-4o-image',
    steps: 1,
    guidance_scale: 7,
    api: 'openai'
  },
  'flux-fill-pro': {
    name: 'black-forest-labs/flux-fill-pro',
    steps: 6, // Increased for better quality
    guidance_scale: 4.0, // Optimized for better results
    api: 'replicate'
  },
  'flux-schnell': {
    name: 'black-forest-labs/flux-schnell',
    steps: 1,
    guidance_scale: 3.5,
    api: 'replicate'
  },
  'flux-pro': {
    name: 'black-forest-labs/flux-pro',
    steps: 25,
    guidance_scale: 3.5,
    api: 'replicate'
  }
};

// For DALL-E quality outpainting, prefer GPT-Image-1 or GPT-4o
const DEFAULT_MODEL = 'dall-e-3';
const PREFERRED_OUTPAINTING_MODEL = 'gpt-image-1'; // Fallback to flux-fill-pro if not available

// Create DALL-E outpainting setup for image editing
async function createDalleOutpaintingSetup(previousImageUrl) {
  try {
    console.log('🔧 Creating DALL-E outpainting setup with transparency...');
    const response = await axios.get(previousImageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    console.log(`📏 Source image dimensions: ${width}x${height}`);

    const sliceHeight = Math.floor(height * 0.35);
    console.log(`📏 Slice height: ${sliceHeight}px`);

    // Extract bottom slice and resize to target dimensions
    const bottomSlice = await sharp(imageBuffer)
      .extract({ left: 0, top: height - sliceHeight, width: width, height: sliceHeight })
      .resize(IMAGE_WIDTH, sliceHeight, { fit: 'fill' }) // Ensure exact dimensions
      .png()
      .toBuffer();

    console.log(`📏 Resized slice to: ${IMAGE_WIDTH}x${sliceHeight}`);

    // Create a new RGBA canvas with proper dimensions
    const newCanvas = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 4, // RGBA for transparency
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Fully transparent
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

    console.log(`📏 Created DALL-E canvas: ${IMAGE_WIDTH}x${IMAGE_HEIGHT} with slice at top`);
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
    console.log(`✂️ Cropping outpainted image for seamless transition...`);
    
    // Download the generated image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // For perfect seamless flow, crop EXACTLY the slice height that was used for outpainting
    // This removes the duplicate area that was copied from the previous image
    const cropAmount = sliceHeight;
    
    console.log(`📏 SEAMLESS CROP: Removing exact duplicate area for perfect flow:`);
    console.log(`   - Original outpainted image: ${width}x${height}`);
    console.log(`   - Duplicate slice to remove: ${cropAmount}px`);
    
    // Safety check
    if (cropAmount >= height) {
      console.warn(`⚠️ Crop amount too large, returning original image`);
      return imageUrl;
    }
    
    const finalHeight = height - cropAmount;
    console.log(`   - Final seamless image: ${width}x${finalHeight}`);
    
    // Crop the EXACT slice height from the top to remove duplication
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: cropAmount, // Remove exactly the slice that was duplicated
        width: width,
        height: finalHeight
      })
      .png()
      .toBuffer();
    
    // Convert to data URL
    const croppedDataUrl = `data:image/png;base64,${croppedBuffer.toString('base64')}`;
    
    console.log(`✅ SEAMLESS CROP COMPLETE: Perfect transition ready`);
    
    return croppedDataUrl;
    
  } catch (error) {
    console.error('❌ Error during seamless cropping:', error);
    return imageUrl; // Return original on error
  }
}

// Generate initial image
async function generateInitialImage(customPrompt = null, modelName = DEFAULT_MODEL) {
  try {
    console.log(`🎨 Starting initial image generation with model: ${modelName}`);
    console.log(`🔍 DEBUG - User provided custom prompt: "${customPrompt || 'none'}"`);
    
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
      console.log(`🤖 Calling Replicate API: ${config.name}`);
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
async function generateNextImage(previousImage, prompt, modelName = DEFAULT_MODEL, originalUserPrompt = null) {
  try {
    console.log(`🎨 Starting next image generation (outpainting) with model: ${modelName}`);
    
    const startTime = Date.now();
    let config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    let finalImageUrl;
    let generationTime;
    let sliceHeight = 0;
    let actualModelUsed = modelName;

    // For continuation images with previous image, try DALL-E quality models first
    if (previousImage) {
      console.log(`🔄 Switching to high-quality outpainting model for seamless continuation...`);
      
      // Try GPT-Image-1 first (best quality outpainting)
      try {
        actualModelUsed = PREFERRED_OUTPAINTING_MODEL;
        config = MODEL_CONFIGS[PREFERRED_OUTPAINTING_MODEL];
        console.log(`✅ Using ${actualModelUsed} for DALL-E quality outpainting`);
      } catch (error) {
        console.log(`⚠️ ${PREFERRED_OUTPAINTING_MODEL} not available, trying GPT-4o...`);
        try {
          actualModelUsed = 'gpt-4o-image';
          config = MODEL_CONFIGS['gpt-4o-image'];
          console.log(`✅ Using GPT-4o for high-quality outpainting`);
        } catch (error) {
          console.log(`⚠️ GPT-4o not available, falling back to improved FLUX Fill Pro...`);
          actualModelUsed = 'flux-fill-pro';
          config = MODEL_CONFIGS['flux-fill-pro'];
        }
      }
    }

    if (config.api === 'openai') {
      console.log(`🤖 Using OpenAI model: ${actualModelUsed}`);
      
      if (previousImage) {
                 // GPT-Image-1 and GPT-4o support true outpainting
         console.log(`🎯 Creating ${actualModelUsed} outpainting setup...`);
         const outpaintingSetup = await createOpenAIOutpaintingSetup(previousImage);
         sliceHeight = outpaintingSetup.sliceHeight;
         
         // Enhanced prompt for outpainting
         const outpaintingPrompt = `Continue this aerial view seamlessly below the existing area. ${prompt}. Maintain the exact same perspective, altitude, and lighting. Extend the landscape naturally southward with consistent visual style and details.`;
         
         let response;
         if (actualModelUsed === 'gpt-image-1') {
           // GPT-Image-1 supports image editing by using the transparency of the input image as a mask
          
          // Workaround for multipart/form-data parsing error by writing buffer to a temp file
          const tempFileName = `temp_image_${Date.now()}.png`;
          const tempFilePath = path.join(os.tmpdir(), tempFileName);

          try {
            fs.writeFileSync(tempFilePath, outpaintingSetup.imageBuffer);

            response = await openai.images.edit({
              image: fs.createReadStream(tempFilePath),
              prompt: outpaintingPrompt,
              model: "dall-e-2",
              n: 1,
              size: "1024x1024"
            });
          } finally {
            // Ensure the temporary file is deleted
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          }
         } else if (actualModelUsed === 'gpt-4o-image') {
           // GPT-4o multimodal approach
           response = await openai.chat.completions.create({
             model: "gpt-4o",
             messages: [
               {
                 role: "user",
                 content: [
                   {
                     type: "text",
                     text: `Edit this image to ${outpaintingPrompt}`
                   },
                   {
                     type: "image_url",
                     image_url: {
                       url: `data:image/png;base64,${outpaintingSetup.imageBase64}`
                     }
                   }
                 ]
               }
             ],
             max_tokens: 1000
           });
         }
         
         finalImageUrl = response.data?.[0]?.url || response.choices?.[0]?.message?.content?.[0]?.image_url;
         generationTime = Date.now() - startTime;
         
         if (finalImageUrl) {
           console.log(`✅ ${actualModelUsed} outpainting completed in ${generationTime}ms`);
           // Crop to remove duplicate areas
           finalImageUrl = await cropOutpaintedImage(finalImageUrl, sliceHeight);
         }
        
      } else {
        // Standard DALL-E 3 generation for initial images
        const response = await openai.images.generate({
          model: config.name,
          prompt: `Perfect top-down aerial view of ${prompt} captured directly from above, bird's eye perspective, satellite view, overhead shot, detailed terrain featuring ${prompt} visible from high altitude`,
          n: 1,
          size: "1024x1024",
          quality: "hd",
          style: "natural"
        });
        
        finalImageUrl = response.data[0].url;
        generationTime = Date.now() - startTime;
        console.log(`✅ ${actualModelUsed} generation complete in ${generationTime}ms.`);
      }
      
    } else {
      // Improved FLUX Fill Pro with higher quality settings
      console.log(`🤖 Using improved FLUX Fill Pro with enhanced quality settings...`);
      
      const enhancedPrompt = `Continue this top-down aerial view seamlessly below the existing image. Current perspective maintained, camera positioned directly overhead. ${prompt}. The view extends naturally southward maintaining the exact same altitude and viewing angle. High detail, photorealistic, sharp focus, professional quality.`;
      
      let inputParams = {
        prompt: enhancedPrompt,
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        num_inference_steps: config.steps, // Now 6 steps for better quality
        guidance_scale: config.guidance_scale, // Optimized value
        num_outputs: 1,
        quality: "hd", // Enhanced quality
        style: "photorealistic" // Better style directive
      };
      
      // Create outpainting setup for FLUX
      if (previousImage) {
        const outpaintingData = await createOutpaintingSetup(previousImage);
        inputParams.image = outpaintingData.image;
        inputParams.mask = outpaintingData.mask;
        sliceHeight = outpaintingData.sliceHeight;
        
        console.log(`🖼️ FLUX outpainting ready: slice ${sliceHeight}px, model: ${config.name}`);
      }
      
      console.log(`🚀 Calling enhanced FLUX Fill Pro API...`);
      const output = await replicate.run(config.name, { input: inputParams });
      
      finalImageUrl = Array.isArray(output) ? output[0] : output;
      generationTime = Date.now() - startTime;
      
      console.log(`✅ Enhanced FLUX Fill Pro generation complete in ${generationTime}ms`);
      
      if (previousImage && sliceHeight > 0) {
        finalImageUrl = await cropOutpaintedImage(finalImageUrl, sliceHeight);
      }
    }

    return {
      imageUrl: finalImageUrl,
      prompt: prompt,
      modelUsed: actualModelUsed,
      generationTime: Math.round(generationTime),
      sliceHeight: sliceHeight
    };

  } catch (error) {
    console.error(`❌ Error in generateNextImage:`, error);
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

// Create outpainting setup for OpenAI models (GPT-Image-1, GPT-4o)
async function createOpenAIOutpaintingSetup(previousImageUrl) {
  try {
    console.log('🔧 Creating OpenAI outpainting setup for high-quality continuation...');
    
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
    
    // Extract bottom slice for context
    const bottomSlice = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: height - sliceHeight,
        width: width,
        height: sliceHeight
      })
      .resize(1024, sliceHeight)
      .png()
      .toBuffer();
    
    // Create new canvas with slice at top and transparent area below
    const newCanvas = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
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
    
    // Create mask for the area to be generated (transparent area)
    const mask = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: { r: 0, g: 0, b: 0 } // Black (preserve existing)
      }
    })
    .composite([{
      input: await sharp({
        create: {
          width: 1024,
          height: 1024 - sliceHeight,
          channels: 3,
          background: { r: 255, g: 255, b: 255 } // White (generate new)
        }
      }).png().toBuffer(),
      top: sliceHeight,
      left: 0
    }])
    .png()
    .toBuffer();
    
    console.log(`📏 Created OpenAI outpainting setup: preserve ${sliceHeight}px, generate ${1024 - sliceHeight}px`);
    
    return {
      imageBuffer: newCanvas,
      maskBuffer: mask,
      imageBase64: newCanvas.toString('base64'),
      maskBase64: mask.toString('base64'),
      sliceHeight
    };
    
  } catch (error) {
    console.error('❌ Error creating OpenAI outpainting setup:', error);
    throw new Error(`Failed to create OpenAI outpainting setup: ${error.message}`);
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
