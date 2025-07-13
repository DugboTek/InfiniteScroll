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
const SLICE_HEIGHT = 150; // Height of the slice to use for outpainting continuity

// Starting prompts for initial image generation
const STARTING_PROMPTS = [
  "A mystical forest at dawn with ethereal light filtering through ancient trees",
  "A futuristic cityscape with flying vehicles and neon-lit skyscrapers",
  "An alien landscape with strange rock formations and multiple moons",
  "A serene underwater scene with bioluminescent creatures and coral gardens",
  "A steampunk laboratory filled with brass machinery and glowing experiments",
  "A magical library with floating books and spiral staircases reaching to the clouds",
  "A post-apocalyptic wasteland with nature reclaiming abandoned structures",
  "A cosmic nebula with swirling colors and distant galaxies",
  "A medieval castle perched on a cliff overlooking a stormy sea",
  "A cyberpunk street market with holographic vendors and neon signs"
];

/**
 * Generate an initial image from a random starting prompt
 * @param {string} customPrompt - Optional custom prompt, uses random if not provided
 * @returns {Promise<Object>} - Object containing imageUrl, prompt, and metadata
 */
async function generateInitialImage(customPrompt = null) {
  try {
    console.log('Generating initial image...');
    
    // Use custom prompt or select random starting prompt
    const prompt = customPrompt || STARTING_PROMPTS[Math.floor(Math.random() * STARTING_PROMPTS.length)];
    
    console.log('Using prompt:', prompt);
    
    // Generate image using Stable Diffusion XL
    const output = await Promise.race([
      replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        {
          input: {
            prompt: prompt,
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            num_inference_steps: 50,
            guidance_scale: 7.5,
            scheduler: "K_EULER",
            seed: Math.floor(Math.random() * 1000000)
          }
        }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Generation timeout')), GENERATION_TIMEOUT)
      )
    ]);
    
    const imageUrl = Array.isArray(output) ? output[0] : output;
    
    console.log('Initial image generated successfully:', imageUrl);
    
    return {
      imageUrl,
      prompt,
      isInitial: true,
      timestamp: new Date().toISOString(),
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT
    };
    
  } catch (error) {
    console.error('Error generating initial image:', error);
    throw new Error(`Failed to generate initial image: ${error.message}`);
  }
}

/**
 * Generate the next image using outpainting technique
 * @param {string} previousImageUrl - URL of the previous image
 * @param {string} prompt - Current prompt for generation
 * @returns {Promise<Object>} - Object containing imageUrl, prompt, and metadata
 */
async function generateNextImage(previousImageUrl, prompt) {
  try {
    console.log('Generating next image with outpainting...');
    console.log('Previous image URL:', previousImageUrl);
    console.log('Using prompt:', prompt);
    
    // Download and process the previous image
    const previousImageBuffer = await downloadImage(previousImageUrl);
    const bottomSlice = await extractBottomSlice(previousImageBuffer);
    
    // Create the outpainting input image (slice at top of new canvas)
    const outpaintingInput = await createOutpaintingCanvas(bottomSlice);
    
    // Convert to base64 for API
    const imageBase64 = `data:image/png;base64,${outpaintingInput.toString('base64')}`;
    
    // Generate image using SDXL for now (until we implement proper outpainting)
    const output = await Promise.race([
      replicate.run(
        "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        {
          input: {
            prompt: prompt,
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            num_inference_steps: 50,
            guidance_scale: 7.5,
            scheduler: "K_EULER",
            seed: Math.floor(Math.random() * 1000000)
          }
        }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Generation timeout')), GENERATION_TIMEOUT)
      )
    ]);
    
    const imageUrl = Array.isArray(output) ? output[0] : output;
    
    console.log('Next image generated successfully:', imageUrl);
    
    return {
      imageUrl,
      prompt,
      isInitial: false,
      timestamp: new Date().toISOString(),
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT
    };
    
  } catch (error) {
    console.error('Error generating next image:', error);
    throw new Error(`Failed to generate next image: ${error.message}`);
  }
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
    
    const evolutionPrompt = `
    You are a creative narrative director for a visual story. Given the current scene description, create a new prompt that naturally continues the story while maintaining visual coherence.

    Current scene: "${currentPrompt}"

    Guidelines:
    - Maintain visual continuity (similar lighting, style, atmosphere)
    - Gradually introduce new elements or evolve existing ones
    - Keep the narrative flowing naturally
    - Ensure the new scene could believably connect to the previous one
    - Limit response to 2-3 sentences maximum
    - Focus on visual elements that an AI image generator can render

    New scene description:`;
    
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
 * Extract bottom slice from image for outpainting continuity
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Buffer>} - Bottom slice buffer
 */
async function extractBottomSlice(imageBuffer) {
  try {
    const slice = await sharp(imageBuffer)
      .extract({
        left: 0,
        top: IMAGE_HEIGHT - SLICE_HEIGHT,
        width: IMAGE_WIDTH,
        height: SLICE_HEIGHT
      })
      .png()
      .toBuffer();
      
    return slice;
  } catch (error) {
    console.error('Error extracting bottom slice:', error);
    throw new Error(`Failed to extract bottom slice: ${error.message}`);
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
    .composite([
      {
        input: bottomSlice,
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();
    
    return canvas;
  } catch (error) {
    console.error('Error creating outpainting canvas:', error);
    throw new Error(`Failed to create outpainting canvas: ${error.message}`);
  }
}

/**
 * Fallback function to add variation to prompt when AI evolution fails
 * @param {string} prompt - Original prompt
 * @returns {string} - Modified prompt
 */
function addPromptVariation(prompt) {
  const variations = [
    "As the scene continues, ",
    "Moving deeper into the scene, ",
    "The view expands to reveal ",
    "Time passes and the scene shows ",
    "The perspective shifts to show "
  ];
  
  const variation = variations[Math.floor(Math.random() * variations.length)];
  return variation + prompt.toLowerCase();
}

module.exports = {
  generateInitialImage,
  generateNextImage,
  evolvePrompt
};
