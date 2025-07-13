// This service will handle communication with the backend.

const API_URL = 'http://localhost:3001/api/generate-next-image'; // Backend runs on 3001
const MODELS_URL = 'http://localhost:3001/api/models';
const EVOLVE_PROMPT_URL = 'http://localhost:3001/api/evolve-prompt';
const EXPAND_PROMPT_URL = 'http://localhost:3001/api/expand-prompt';

// State to track current prompt and model for continuity
let currentPrompt = null;
let currentModel = 'flux-fill-pro'; // Default to outpainting model for better continuity
let debugMode = false;

export const fetchNextImage = async (previousImage = null, modelName = null, enableDebug = false, customPrompt = null) => {
  try {
    const selectedModel = modelName || currentModel;
    const promptToUse = customPrompt || currentPrompt;
    
    console.log('Fetching next image...', { 
      previousImage: !!previousImage, 
      promptToUse, 
      model: selectedModel,
      debug: enableDebug,
      isCustomPrompt: !!customPrompt
    });
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        previousImage, 
        currentPrompt: promptToUse,
        modelName: selectedModel,
        debugMode: enableDebug
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${errorData.error} - ${errorData.details}`);
    }
    
    const data = await response.json();
    console.log('Received image data:', data);
    
    // Update current prompt for next request
    currentPrompt = data.prompt;
    
    // If a custom prompt was provided, ensure it's stored for continuity
    if (customPrompt && !previousImage) {
      console.log('📝 Storing custom prompt for future evolution:', customPrompt);
    }
    
    return {
      imageUrl: data.imageUrl,
      prompt: data.prompt,
      isInitial: data.isInitial,
      timestamp: data.timestamp,
      width: data.width,
      height: data.height,
      debug: data.debug || null
    };

  } catch (error) {
    console.error("Failed to fetch next image:", error);
    // Return a placeholder on error to prevent crashing
    return {
      imageUrl: `https://picsum.photos/seed/${Math.random()}/1920/1080`,
      prompt: 'Placeholder image (API error)',
      isInitial: false,
      timestamp: new Date().toISOString(),
      width: 1920,
      height: 1080,
      debug: { error: error.message }
    };
  }
};

export const fetchAvailableModels = async () => {
  try {
    console.log('Fetching available models...');
    
    const response = await fetch(MODELS_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Available models:', data);
    
    return data;

  } catch (error) {
    console.error("Failed to fetch models:", error);
    // Return fallback models
    return {
      models: [
        { id: 'flux-schnell', name: 'FLUX SCHNELL', config: { use_case: 'speed' } },
        { id: 'flux-fill-pro', name: 'FLUX FILL PRO', config: { use_case: 'outpainting' } }
      ],
      defaultModel: 'flux-schnell',
      error: error.message
    };
  }
};

export const evolvePrompt = async (prompt) => {
  try {
    console.log('Evolving prompt:', prompt);
    
    const response = await fetch(EVOLVE_PROMPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Failed to evolve prompt: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Evolved prompt:', data);
    
    return data.evolvedPrompt;

  } catch (error) {
    console.error("Failed to evolve prompt:", error);
    return prompt; // Return original prompt on error
  }
};

export const expandPrompt = async (userPrompt) => {
  try {
    console.log('Expanding user prompt:', userPrompt);
    
    const response = await fetch(EXPAND_PROMPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userPrompt }),
    });

    if (!response.ok) {
      throw new Error(`Failed to expand prompt: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Expanded prompt:', {
      original: data.originalPrompt,
      expanded: data.expandedPrompt
    });
    
    return data.expandedPrompt;

  } catch (error) {
    console.error("Failed to expand prompt:", error);
    // Return a basic fallback expansion
    return `Aerial view of ${userPrompt}, captured from above with dramatic lighting and intricate details`;
  }
};

// Getters and setters for global state
export const getCurrentModel = () => currentModel;
export const setCurrentModel = (model) => {
  currentModel = model;
  console.log('Current model set to:', model);
};

export const getCurrentPrompt = () => currentPrompt;
export const setCurrentPrompt = (prompt) => {
  currentPrompt = prompt;
  console.log('Current prompt set to:', prompt);
};

export const getDebugMode = () => debugMode;
export const setDebugMode = (enabled) => {
  debugMode = enabled;
  console.log('Debug mode set to:', enabled);
};

// Clear state (useful for reset)
export const clearState = () => {
  currentPrompt = null;
  currentModel = 'flux-fill-pro';
  debugMode = false;
  console.log('API state cleared');
};
