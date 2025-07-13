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
    steps: 4,
    guidance_scale: 3.5,
    use_case: 'outpainting',
    supports_outpainting: true,
    priority: 3 // Lower priority due to complexity
  },
  'flux-schnell-lora': {
    name: 'black-forest-labs/flux-schnell-lora',
    steps: 2,
    guidance_scale: 1.0,
    use_case: 'balanced',
    supports_outpainting: false,
    priority: 2 // Medium priority
  },
  'sdxl': {
    name: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    steps: 20, // Reduced from 50 for faster generation
    guidance_scale: 7.5,
    use_case: 'fallback',
    supports_outpainting: false,
    priority: 4 // Lowest priority
  }
};

// Default model preference - with smart switching (flux-schnell for initial, flux-fill-pro for outpainting)
const DEFAULT_MODEL = 'flux-fill-pro';

// Starting prompts for initial image generation - consistent map-like perspectives for seamless scrolling
const STARTING_PROMPTS = [
  "Top-down map view of mystical forest district at 800-foot altitude, showing uniform ancient tree canopy with clearings in natural patterns, consistent scale, captured with even overhead lighting for seamless navigation",
  "Overhead satellite view of futuristic metropolitan district from fixed 1000-foot altitude, featuring regular grid of gleaming towers at consistent scale, geometric transportation networks, captured with uniform daylight",
  "Straight-down aerial map of alien landscape sector at 600-foot altitude, showing organized bizarre rock formations in natural patterns, consistent alien flora scale, captured with steady twin-moon lighting",
  "Top-down satellite perspective of deep ocean region at fixed altitude, showing bioluminescent patterns in organized formations, consistent wave textures, captured with uniform ambient lighting for continuous map view",
  "Overhead map view of steampunk industrial district at 700-foot altitude, featuring organized brass infrastructure in grid layout, consistent smokestacks scale, captured with steady overhead lighting",
  "Straight-down aerial view of magical library city sector at 900-foot altitude, showing tower spires arranged in navigable patterns, consistent architectural scale, captured with even mystical lighting",
  "Top-down map perspective of post-apocalyptic district at 500-foot altitude, showing ruins organized in former city grid, consistent overgrowth patterns, captured with uniform overcast lighting",
  "Fixed-altitude space view of cosmic nebula region showing swirling patterns in organized formations, consistent star cluster scale, captured with steady cosmic lighting for seamless space navigation",
  "Overhead map view of medieval fortress island at 600-foot altitude, showing castle complex centered with defensive patterns, consistent scale structures, captured with uniform noon lighting",
  "Top-down satellite view of cyberpunk district at fixed 800-foot altitude, featuring neon-lit buildings in organized grid layout, consistent street patterns, captured with steady night lighting"
];

/**
 * Generate an initial image from a random starting prompt
 * @param {string} customPrompt - Optional custom prompt, uses random if not provided
 * @param {string} modelName - Model to use for generation
 * @returns {Promise<Object>} - Object containing imageUrl, prompt, and metadata
 */
async function generateInitialImage(customPrompt = null, modelName = DEFAULT_MODEL) {
  try {
    // CRITICAL: FLUX Fill Pro cannot generate initial images - it requires input image
    // Force use of FLUX Schnell for initial generation
    const initialModel = (modelName === 'flux-fill-pro') ? 'flux-schnell' : modelName;
    console.log(`Generating initial image with model: ${initialModel} (requested: ${modelName})`);
    
    // Use custom prompt or select random starting prompt
    const prompt = customPrompt || STARTING_PROMPTS[Math.floor(Math.random() * STARTING_PROMPTS.length)];
    const config = MODEL_CONFIGS[initialModel] || MODEL_CONFIGS['flux-schnell'];
    
    console.log('Using prompt:', prompt);
    console.log('Model config:', config);
    
    const startTime = Date.now();
    
    // Generate image using selected model
    const output = await Promise.race([
      replicate.run(config.name, {
        input: {
          prompt: prompt,
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          num_inference_steps: config.steps,
          guidance_scale: config.guidance_scale,
          scheduler: "K_EULER",
          seed: Math.floor(Math.random() * 1000000),
          go_fast: true // Enable accelerated inference for flux models
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Generation timeout')), GENERATION_TIMEOUT)
      )
    ]);
    
    const generationTime = Date.now() - startTime;
    const imageUrl = Array.isArray(output) ? output[0] : output;
    
    console.log(`Initial image generated in ${generationTime}ms:`, imageUrl);
    
    return {
      imageUrl,
      prompt,
      isInitial: true,
      timestamp: new Date().toISOString(),
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      modelUsed: initialModel, // Use the actual model that was used
      requestedModel: modelName, // Keep track of what was requested
      generationTime: generationTime,
      config: config
    };
    
  } catch (error) {
    console.error('Error generating initial image:', error);
    throw new Error(`Failed to generate initial image: ${error.message}`);
  }
}

/**
 * Generate the next image using outpainting technique or fast generation
 * @param {string} previousImageUrl - URL of the previous image
 * @param {string} prompt - Current prompt for generation
 * @param {string} modelName - Model to use for generation
 * @returns {Promise<Object>} - Object containing imageUrl, prompt, and metadata
 */
async function generateNextImage(previousImageUrl, prompt, modelName = DEFAULT_MODEL) {
  try {
    console.log(`Generating next image with model: ${modelName}`);
    console.log('Previous image URL:', previousImageUrl);
    console.log('Using prompt:', prompt);
    
    const config = MODEL_CONFIGS[modelName] || MODEL_CONFIGS[DEFAULT_MODEL];
    const startTime = Date.now();
    
    let output;
    let actualModelUsed = modelName; // Track which model was actually used
    
    // Use proper outpainting for flux-fill-pro, fast generation for others
    if (config.supports_outpainting && previousImageUrl && !previousImageUrl.includes('picsum.photos')) {
      // Only attempt outpainting with real images, not placeholder images
      try {
        output = await generateWithOutpainting(previousImageUrl, prompt, config);
        // Outpainting succeeded, model used as requested
      } catch (error) {
        console.warn('Outpainting failed, falling back to fast mode:', error.message);
        // CRITICAL: Use FLUX Schnell config for fallback since FLUX Fill Pro can't do text-to-image
        const fallbackConfig = MODEL_CONFIGS['flux-schnell'];
        console.log('Using fallback model config:', fallbackConfig);
        output = await generateWithFastMode(previousImageUrl, prompt, fallbackConfig);
        actualModelUsed = 'flux-schnell'; // Update to actual model used
      }
    } else {
      // For non-outpainting generation, use appropriate model
      const fastConfig = config.supports_outpainting ? MODEL_CONFIGS['flux-schnell'] : config;
      if (config.supports_outpainting) {
        actualModelUsed = 'flux-schnell'; // Updated to actual model used
      }
      console.log('Using fast generation with config:', fastConfig);
      output = await generateWithFastMode(previousImageUrl, prompt, fastConfig);
    }
    
    const generationTime = Date.now() - startTime;
    const imageUrl = Array.isArray(output) ? output[0] : output;
    
    console.log(`Next image generated in ${generationTime}ms:`, imageUrl);
    
    return {
      imageUrl,
      prompt,
      isInitial: false,
      timestamp: new Date().toISOString(),
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      modelUsed: actualModelUsed, // Actual model that was used
      requestedModel: modelName, // Original model that was requested
      generationTime: generationTime,
      config: config
    };
    
  } catch (error) {
    console.error('Error generating next image:', error);
    
    // Ultimate fallback - try with fastest model
    if (modelName !== 'flux-schnell') {
      console.log('Trying ultimate fallback with flux-schnell...');
      try {
        const fallbackResult = await generateNextImage(previousImageUrl, prompt, 'flux-schnell');
        // Update to show this was a fallback from the original request
        return {
          ...fallbackResult,
          modelUsed: 'flux-schnell',
          requestedModel: modelName // Keep original requested model
        };
      } catch (fallbackError) {
        console.error('Even fallback failed:', fallbackError);
      }
    }
    
    throw new Error(`Failed to generate next image: ${error.message}`);
  }
}

/**
 * Generate using FLUX Fill Pro with proper outpainting
 */
async function generateWithOutpainting(previousImageUrl, prompt, config) {
  console.log('Using FLUX Fill Pro outpainting...');
  
  try {
    // Download and process the previous image
    const previousImageBuffer = await downloadImage(previousImageUrl);
    
    // Get image metadata first
    const metadata = await sharp(previousImageBuffer).metadata();
    console.log('Previous image metadata:', { 
      width: metadata.width, 
      height: metadata.height, 
      channels: metadata.channels 
    });
    
    // Validate image dimensions
    if (!metadata.width || !metadata.height || metadata.width < SLICE_HEIGHT || metadata.height < SLICE_HEIGHT) {
      console.warn('Invalid image dimensions, falling back to fast mode');
      return await generateWithFastMode(previousImageUrl, prompt, config);
    }
    
    // Create outpainting setup with proper validation
    const { image, mask } = await createOutpaintingInputs(previousImageBuffer, metadata);
    
    // Convert to base64 for API
    const imageBase64 = `data:image/png;base64,${image.toString('base64')}`;
    const maskBase64 = `data:image/png;base64,${mask.toString('base64')}`;
    
    // Enhance prompt for seamless map-like continuity with fixed perspective
    const enhancedPrompt = `${prompt}. CRITICAL: Maintain EXACT same altitude, camera angle, and zoom level as the image above. Generate content that appears to be a natural continuation of the terrain/landscape below the existing area. Keep consistent lighting direction, time of day, and perspective as if viewing a continuous map from a fixed height. NO camera movement, angle changes, or zoom variations. The new content should seamlessly connect as if scrolling down on the same aerial photograph.`;
    
    console.log('🚀 Calling FLUX Fill Pro with enhanced prompt:', enhancedPrompt);
    
    return await replicate.run(config.name, {
      input: {
        image: imageBase64,
        mask: maskBase64,
        prompt: enhancedPrompt,
        num_inference_steps: config.steps,
        guidance_scale: config.guidance_scale,
        strength: 0.85, // Higher strength to encourage more creative deviation
        seed: Math.floor(Math.random() * 1000000),
        safety_tolerance: 2, // Allow more creative freedom
        output_format: "png",
        output_quality: 95
      }
    });
    
  } catch (error) {
    console.error('Error in FLUX Fill Pro outpainting:', error);
    console.log('Falling back to fast mode generation...');
    
    // Fallback to fast mode if outpainting fails
    return await generateWithFastMode(previousImageUrl, prompt, config);
  }
}

/**
 * Create proper outpainting inputs for FLUX Fill Pro
 */
async function createOutpaintingInputs(previousImageBuffer, metadata) {
  try {
    // Use the actual image dimensions from metadata
    const actualWidth = metadata.width;
    const actualHeight = metadata.height;
    
    // Ensure we don't extract beyond image bounds
    const sliceHeight = Math.min(SLICE_HEIGHT, Math.floor(actualHeight * 0.2)); // Max 20% of image height
    const extractTop = Math.max(0, actualHeight - sliceHeight);
    
    console.log('📏 Extraction parameters:', { 
      actualWidth, 
      actualHeight, 
      sliceHeight, 
      extractTop,
      explanation: `Taking ${sliceHeight}px slice from BOTTOM of previous image (y=${extractTop} to y=${actualHeight})`
    });
    
    console.log('🔄 Scroll Flow: Previous image BOTTOM → Current image TOP → AI generates BELOW');
    
    // Extract bottom slice from previous image with validation
    const bottomSlice = await sharp(previousImageBuffer)
      .extract({
        left: 0,
        top: extractTop,
        width: actualWidth,
        height: sliceHeight
      })
      .resize(IMAGE_WIDTH, sliceHeight) // Resize to target dimensions
      .png()
      .toBuffer();
    
    // FIXED: No random offset for better alignment - place bottom slice exactly at top
    // This ensures the transition from previous image bottom → current image top is seamless
    
    // Create new canvas with the bottom slice placed EXACTLY at the top (for downward scroll)
    const outpaintingImage = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 3, // RGB
        background: { r: 128, g: 128, b: 128 } // Neutral background for AI to fill
      }
    })
    .composite([{
      input: bottomSlice,
      top: 0, // EXACTLY at top - no offset for perfect alignment
      left: 0
      // Default 'over' blend mode - no need to specify
    }])
    .png()
    .toBuffer();
    
    // Create mask with gradient transition to reduce repetition at seam
    // BLACK (preserve) at very top, GRAY (transition), WHITE (generate)
    
    const gradientHeight = Math.min(20, Math.floor(sliceHeight * 0.3)); // Small transition zone
    const preserveHeight = Math.max(20, sliceHeight - gradientHeight); // Minimum preservation area
    
    // Start with white background (AI generates here)
    let maskBuffer = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 3,
        background: { r: 255, g: 255, b: 255 } // White = generate
      }
    }).png().toBuffer();
    
    // Add BLACK preservation area at top
    const blackArea = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: preserveHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 } // Black = preserve
      }
    }).png().toBuffer();
    
    maskBuffer = await sharp(maskBuffer)
      .composite([{ input: blackArea, top: 0, left: 0 }])
      .png()
      .toBuffer();
    
    // Add GRAY transition area
    if (gradientHeight > 0) {
      const grayArea = await sharp({
        create: {
          width: IMAGE_WIDTH,
          height: gradientHeight,
          channels: 3,
          background: { r: 128, g: 128, b: 128 } // Gray = transition
        }
      }).png().toBuffer();
      
      maskBuffer = await sharp(maskBuffer)
        .composite([{ input: grayArea, top: preserveHeight, left: 0 }])
        .png()
        .toBuffer();
    }
    
    const mask = maskBuffer;
    
    console.log('✅ Outpainting inputs created for seamless map-like scrolling');
    console.log('📏 Reduced slice height to', sliceHeight, 'pixels for smooth transitions');
    console.log('🎭 Gradient mask: BLACK (preserve) → GRAY (transition) → WHITE (generate)');
    console.log('🗺️ Map continuity: Maintaining exact perspective, altitude, and scale');
    console.log('🧭 Navigation feel: Terrain extends naturally southward as if scrolling on same map');
    
    return { image: outpaintingImage, mask };
    
  } catch (error) {
    console.error('Error creating outpainting inputs:', error);
    throw new Error(`Failed to create outpainting inputs: ${error.message}`);
  }
}

/**
 * Generate using fast models with slice technique
 */
async function generateWithFastMode(previousImageUrl, prompt, config) {
  console.log('Using fast generation mode...');
  
  // For ultra-fast generation, we'll use a simple approach
  // that includes context from the previous image in the prompt
  const contextualPrompt = await addContextualCues(previousImageUrl, prompt);
  
  return await replicate.run(config.name, {
    input: {
      prompt: contextualPrompt,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      num_inference_steps: config.steps,
      guidance_scale: config.guidance_scale,
      scheduler: "K_EULER",
      seed: Math.floor(Math.random() * 1000000),
      go_fast: true // Enable accelerated inference
    }
  });
}

/**
 * Add contextual cues to prompt for continuity in fast models
 */
async function addContextualCues(previousImageUrl, prompt) {
  // For fast models, we add contextual information to the prompt
  // to maintain some visual continuity
  const continuityPhrases = [
    "continuing the scene from above",
    "seamlessly extending the landscape",
    "flowing naturally from the previous scene",
    "maintaining the artistic style and atmosphere"
  ];
  
  const randomPhrase = continuityPhrases[Math.floor(Math.random() * continuityPhrases.length)];
  return `${prompt}, ${randomPhrase}`;
}

/**
 * Evolve the current prompt to create narrative continuity
 * @param {string} currentPrompt - The current prompt to evolve
 * @returns {Promise<string>} - New evolved prompt
 */
async function evolvePrompt(currentPrompt) {
  try {
    console.log('Evolving prompt:', currentPrompt);
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const themeContext = dreamWorldTheme ? 
      `\n    DREAM WORLD THEME: The user's original vision was "${dreamWorldTheme}". ALL content must stay within this thematic world while expanding the map.` : 
      '';

    const evolutionPrompt = `
    You are creating the next section of a seamless aerial map within the user's dream world. The goal is to maintain EXACT consistency for smooth scrolling navigation while staying true to the established theme.

    Current map section: "${currentPrompt}"${themeContext}

    CRITICAL REQUIREMENTS FOR SEAMLESS MAP CONTINUATION:
    - IDENTICAL PERSPECTIVE: Maintain exact same altitude, viewing angle, and zoom level
    - SAME LIGHTING: Keep identical lighting direction, time of day, and shadow patterns
    - CONSISTENT SCALE: All objects must maintain the same proportional sizes
    - TERRAIN CONTINUITY: Landscape should naturally extend as if scrolling south on the same map
    - NO CAMERA CHANGES: No altitude shifts, angle variations, or zoom changes
    - TECHNICAL CONSISTENCY: Same satellite/map view style throughout
    - THEMATIC CONSISTENCY: Stay within the established dream world theme throughout

    EVOLUTION APPROACH:
    - Introduce new terrain/structures that belong to the same dream world theme
    - Maintain same environmental conditions (weather, lighting, season) as established
    - Keep architectural/natural elements at consistent scale within the theme
    - Preserve the map-like quality and navigational feel
    - Ensure smooth terrain transition that makes thematic sense
    - All new content should feel like a natural extension of the user's original dream world

    Create the next map section that continues the dream world (2-3 sentences maximum):`;
    
    const result = await model.generateContent(evolutionPrompt);
    const response = await result.response;
    const newPrompt = response.text().trim();
    
    console.log('Evolved prompt:', newPrompt);
    
    return newPrompt;
    
  } catch (error) {
    console.error('Error evolving prompt:', error);
    // Fallback to slight variation of current prompt
    return addPromptVariation(currentPrompt);
  }
}

/**
 * Get available models for the debug interface
 */
function getAvailableModels() {
  return Object.keys(MODEL_CONFIGS).map(key => ({
    id: key,
    name: key.replace('-', ' ').toUpperCase(),
    config: MODEL_CONFIGS[key]
  }));
}

/**
 * Download image from URL
 * @param {string} imageUrl - URL of image to download
 * @returns {Promise<Buffer>} - Image buffer
 */
async function downloadImage(imageUrl) {
  try {
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error downloading image:', error);
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

/**
 * Create outpainting canvas with bottom slice at top
 * @param {Buffer} bottomSlice - Bottom slice from previous image
 * @returns {Promise<Buffer>} - Outpainting canvas buffer
 */
async function createOutpaintingCanvas(bottomSlice) {
  try {
    // Create a new canvas with the slice at the top
    const canvas = await sharp({
      create: {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
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
  } catch (error) {
    console.error('Error creating outpainting canvas:', error);
    throw new Error(`Failed to create outpainting canvas: ${error.message}`);
  }
}

/**
 * Add prompt variation for fallback
 * @param {string} prompt - Original prompt
 * @returns {string} - Varied prompt
 */
function addPromptVariation(prompt) {
  const variations = [
    'with subtle changes in lighting',
    'with slightly different perspective',
    'with enhanced atmospheric effects',
    'with more dramatic composition'
  ];
  
  const variation = variations[Math.floor(Math.random() * variations.length)];
  return `${prompt} ${variation}`;
}

/**
 * Expand a short user prompt into a detailed aerial view description
 */
async function expandUserPrompt(userPrompt) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const expansionPrompt = `Transform this short user input into a detailed aerial view prompt that will create seamless scrolling map-like imagery:

USER INPUT: "${userPrompt}"

CRITICAL REQUIREMENTS FOR SEAMLESS SCROLLING:
- FIXED PERSPECTIVE: Establish a consistent altitude and viewing angle (straight down or specific angle)
- CONSISTENT SCALE: All elements should be at the same zoom level/scale
- MAP-LIKE VIEW: Should feel like viewing a continuous satellite map or aerial photograph
- UNIFORM LIGHTING: Establish consistent lighting direction and time of day
- SEAMLESS TERRAIN: Design landscape that can naturally extend in all directions

TECHNICAL SPECIFICATIONS:
- Altitude: High enough to see landscape patterns but detailed enough to see structures
- Viewing angle: Straight down overhead view (90 degrees) or consistent slight angle
- Scale: Consistent object sizes (buildings, trees, roads should maintain proportional scale)
- Lighting: Establish single light source direction that can be maintained across images
- Composition: Design as if it's one section of a larger continuous map

EXAMPLES:
Input: "medieval castle" 
Output: "Top-down aerial map view of a medieval castle complex at 500-foot altitude, showing the fortress positioned in the center with concentric defensive walls, surrounded by organized village districts with uniform-scale buildings, roads radiating outward in a grid pattern, captured with consistent noon lighting from the southeast creating uniform shadows."

Input: "futuristic city"
Output: "Overhead satellite-style view of a futuristic metropolitan district from fixed 1000-foot altitude, featuring a regular grid of glass towers at consistent scale, transportation networks forming geometric patterns, all captured with uniform daylight from above-right, designed as one section of a larger continuous urban map."

Now expand the user's input following this format for seamless map-like scrolling:`;

    console.log('🤖 Calling Gemini to expand prompt...');
    
    const result = await model.generateContent(expansionPrompt);
    const response = await result.response;
    const expandedPrompt = response.text().trim();
    
      // Clean up the response (remove any quotes or formatting)
  const cleanPrompt = expandedPrompt.replace(/^["']|["']$/g, '').trim();
  
  // Store the user's original theme for future prompt evolution
  dreamWorldTheme = userPrompt;
  
  console.log('📝 Original dream world:', userPrompt);
  console.log('🌍 Theme stored for continuity:', dreamWorldTheme);
  console.log('✨ Expanded map prompt:', cleanPrompt);
  
  return cleanPrompt;
    
  } catch (error) {
    console.error('Error expanding user prompt:', error);
    
    // Fallback to consistent map-like template expansion
    const fallbackPrompts = {
      'medieval castle': 'Top-down map view of a medieval castle complex at 500-foot altitude, showing the fortress centered with defensive walls, surrounded by organized village districts with consistent-scale buildings, roads in grid patterns, captured with uniform noon lighting from southeast',
      'futuristic city': 'Overhead satellite view of a futuristic metropolitan district from fixed 1000-foot altitude, featuring regular grid of glass towers at consistent scale, geometric transportation networks, captured with uniform daylight, designed as continuous urban map section',
      'mystical forest': 'Straight-down aerial map view of an enchanted forest canopy at 800-foot altitude, showing uniform tree coverage with clearings in natural patterns, consistent scale throughout, captured with even overhead lighting for seamless map-like appearance',
      'desert oasis': 'Top-down satellite perspective of desert oasis at 600-foot altitude, showing circular oasis centered with palm groves, surrounded by regular sand dune patterns, captured with consistent noon sun positioning for uniform shadows',
      'floating islands': 'Overhead map view of floating island archipelago at fixed 1200-foot altitude, showing islands arranged in navigable patterns with consistent scale, uniform cloud coverage, captured with steady overhead lighting',
      'underwater city': 'Top-down sonar-map style view of underwater city district at consistent depth perspective, showing organized dome structures in grid layout, uniform scale coral gardens, captured with even ambient lighting for continuous map appearance'
    };
    
    const fallback = fallbackPrompts[userPrompt.toLowerCase()] || 
      `Top-down map view of ${userPrompt} at fixed altitude with consistent scale, uniform lighting, and seamless terrain patterns designed for continuous scrolling navigation`;
    
    // Store the user's original theme even when using fallback
    dreamWorldTheme = userPrompt;
    
    console.log('🔄 Using fallback expansion:', fallback);
    console.log('🌍 Theme stored for continuity (fallback):', dreamWorldTheme);
    return fallback;
  }
}

module.exports = {
  generateInitialImage,
  generateNextImage,
  evolvePrompt,
  expandUserPrompt,
  getAvailableModels,
  MODEL_CONFIGS,
  DEFAULT_MODEL
};
