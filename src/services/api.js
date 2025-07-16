// This service will handle communication with the backend.

// Use relative URLs for production, localhost for development
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isDevelopment ? 'http://localhost:3001' : '';
const API_URL = `${BASE_URL}/api/generate-next-image`;
const MODELS_URL = `${BASE_URL}/api/models`;
const HEALTH_URL = `${BASE_URL}/api/health`;

// State to track current prompt and model for continuity
let currentPrompt = null;
let originalUserPrompt = null; // Track the original user theme throughout the session
let currentModel = 'flux-schnell'; // Default to speed model for initial generation
let debugMode = false;
let inferenceSteps = 4; // Default steps

export const fetchNextImage = async (previousImage = null, modelName = null, enableDebug = false, customPrompt = null, steps = null) => {
  try {
    console.log('🚀 === FRONTEND API SERVICE DEBUG ===');
    console.log('📥 fetchNextImage called with:');
    console.log('  - previousImage:', !!previousImage);
    console.log('  - modelName:', modelName);
    console.log('  - enableDebug:', enableDebug);
    console.log('  - customPrompt:', customPrompt);
    console.log('  - steps:', steps);
    console.log('  - currentPrompt (global):', currentPrompt);
    
    // Auto-select model based on whether this is initial generation or continuation
    let selectedModel = modelName || currentModel;
    if (!modelName) {
      selectedModel = previousImage ? 'flux-fill-pro' : 'flux-schnell';
    }
    
    const promptToUse = customPrompt || currentPrompt;
    
    console.log('🎯 Prompt selection logic:');
    console.log('  - customPrompt:', customPrompt);
    console.log('  - currentPrompt (global):', currentPrompt);
    console.log('  - promptToUse (final):', promptToUse);
    console.log('  - selectedModel:', selectedModel);
    
    // Handle original user prompt tracking
    if (customPrompt && !previousImage) {
      // This is a new initial image with custom prompt - store as original theme
      originalUserPrompt = customPrompt;
      console.log('🎯 New session started with original theme:', originalUserPrompt);
    }
    
    console.log('📤 Sending to backend:', { 
      previousImage: !!previousImage, 
      currentPrompt: promptToUse,
      originalUserPrompt: originalUserPrompt,
      modelName: selectedModel,
      debugMode: enableDebug,
      inferenceSteps: steps || inferenceSteps
    });
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        previousImage, 
        currentPrompt: promptToUse,
        originalUserPrompt: originalUserPrompt,
        modelName: selectedModel,
        debugMode: enableDebug,
        inferenceSteps: steps || inferenceSteps
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', errorData);
      throw new Error(`API Error: ${errorData.error} - ${errorData.details}`);
    }
    
    const data = await response.json();
    console.log('📨 Backend response received:');
    console.log('  - imageUrl:', !!data.imageUrl);
    console.log('  - prompt:', data.prompt);
    console.log('  - originalUserPrompt:', data.originalUserPrompt);
    console.log('  - evolvedPrompt:', data.evolvedPrompt);
    console.log('  - modelUsed:', data.modelUsed);
    console.log('🚀 === END FRONTEND API SERVICE DEBUG ===');
    
    // Update original user prompt from backend if provided
    if (data.originalUserPrompt && !originalUserPrompt) {
      originalUserPrompt = data.originalUserPrompt;
      console.log('🎯 Original user prompt updated from backend:', originalUserPrompt);
    }
    
    // Update the current prompt with the evolved prompt or original prompt
    if (data.evolvedPrompt) {
      currentPrompt = data.evolvedPrompt;
      console.log('📝 Updated currentPrompt (global) to evolved:', currentPrompt);
    } else if (data.prompt) {
      currentPrompt = data.prompt;
      console.log('📝 Updated currentPrompt (global) to original:', currentPrompt);
    }
    
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
  console.log('🔄 setCurrentPrompt called:');
  console.log('  - old currentPrompt:', currentPrompt);
  console.log('  - new prompt:', prompt);
  currentPrompt = prompt;
  console.log('  - updated currentPrompt:', currentPrompt);
};

export const getOriginalUserPrompt = () => originalUserPrompt;
export const setOriginalUserPrompt = (prompt) => {
  console.log('🎯 setOriginalUserPrompt called:');
  console.log('  - old originalUserPrompt:', originalUserPrompt);
  console.log('  - new original prompt:', prompt);
  originalUserPrompt = prompt;
  console.log('  - updated originalUserPrompt:', originalUserPrompt);
};

export const getDebugMode = () => debugMode;
export const setDebugMode = (enabled) => {
  debugMode = enabled;
  console.log('Debug mode set to:', enabled);
};

export const getInferenceSteps = () => {
  const storedSteps = localStorage.getItem('inferenceSteps');
  return storedSteps ? parseInt(storedSteps, 10) : inferenceSteps;
};

export const setInferenceSteps = (steps) => {
  inferenceSteps = steps;
  localStorage.setItem('inferenceSteps', steps);
  console.log('Inference steps set to:', steps);
};


// Clear state (useful for reset)
export const clearState = () => {
  currentPrompt = null;
  originalUserPrompt = null;
  currentModel = 'flux-schnell';
  debugMode = false;
  inferenceSteps = 4; // Reset to default
  localStorage.removeItem('inferenceSteps');
  console.log('API state cleared - all prompts and settings reset');
};
