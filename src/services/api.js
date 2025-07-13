// This service will handle communication with the backend.

// Use relative URLs for production, localhost for development
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isDevelopment ? 'http://localhost:3001' : '';
const API_URL = `${BASE_URL}/api/generate-next-image`;
const MODELS_URL = `${BASE_URL}/api/models`;
const HEALTH_URL = `${BASE_URL}/api/health`;

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
      availableModels: ['flux-schnell', 'flux-fill-pro'],
      defaultModel: 'flux-schnell',
      error: error.message
    };
  }
};

export const checkHealth = async () => {
  try {
    console.log('Checking API health...');
    
    const response = await fetch(HEALTH_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Health check result:', data);
    
    return data;

  } catch (error) {
    console.error("Health check failed:", error);
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

// Note: Prompt evolution and expansion are now handled within the main API endpoint

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
