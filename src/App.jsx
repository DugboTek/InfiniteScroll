import React, { useState, useEffect, useCallback, useRef } from 'react';
import ImageContainer from './components/ImageContainer';
import DebugOverlay from './components/DebugOverlay';
import PromptInput from './components/PromptInput';
import useInfiniteScroll from './hooks/useInfiniteScroll';
import { 
  fetchNextImage, 
  getCurrentModel, 
  getDebugMode,
  setDebugMode,
  checkHealth,
  getInferenceSteps,
  setInferenceSteps
} from './services/api';

// Random prompts for initial image generation
const RANDOM_PROMPTS = [
  "mystical floating islands with waterfalls",
  "ancient forest with glowing mushrooms", 
  "steampunk city with flying machines",
  "underwater coral palace",
  "volcanic mountain with crystal formations",
  "enchanted meadow with fairy rings",
  "frozen tundra with aurora lights",
  "desert oasis with golden dunes",
  "jungle temple with exotic birds",
  "alien landscape with strange plants",
  "medieval castle on clifftop",
  "futuristic space station",
  "mountain village in clouds",
  "tropical beach with palm trees",
  "snowy pine forest with cabin"
];

function App() {
  const [imageUrls, setImageUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState(getCurrentModel());
  const [debugMode, setDebugModeState] = useState(getDebugMode());
  const [inferenceSteps, setInferenceStepsState] = useState(getInferenceSteps()); // New state for steps
  const [lastImageData, setLastImageData] = useState(null);
  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [userPromptPending, setUserPromptPending] = useState(false); // Flag to prevent random prompt when user submits
  
  // Refs for managing loading state and preventing race conditions
  const initialLoadAttempted = useRef(false);
  const componentId = useRef(Math.random().toString(36).substr(2, 9)); // Unique ID for this component instance
  const currentLoadingOperation = useRef(null); // Track current loading operation to cancel if needed
  const isComponentMounted = useRef(true);
  const componentStartTime = useRef(Date.now()); // Track when this component instance started
  const hasRunInitialization = useRef(false); // Flag to ensure initialization runs only once
  const isLoadingRef = useRef(false); // Ref version of isLoading to prevent callback recreation

  // Function to get random prompt
  const getRandomPrompt = useCallback(() => {
    return RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
  }, []);

  const loadMoreImages = useCallback(async (forceModel = null, isInitialLoad = false, customPrompt = null, forceFresh = false) => {
    const operationId = Math.random().toString(36).substr(2, 9);
    console.log(`🔵 === FRONTEND APP - LOAD MORE IMAGES DEBUG [${componentId.current}:${operationId}] ===`);
    console.log('📥 loadMoreImages called with:');
    console.log('  - forceModel:', forceModel);
    console.log('  - isInitialLoad:', isInitialLoad);
    console.log('  - customPrompt:', customPrompt);
    console.log('  - forceFresh:', forceFresh);
    console.log('  - isLoading (current):', isLoading);
    console.log('  - componentId:', componentId.current);
    
    // In development, be more lenient about mounting state due to hot reloads
    if (!isComponentMounted.current && process.env.NODE_ENV === 'production') {
      console.log('⚠️ Component unmounted, canceling operation');
      return;
    }
    
    // Prevent duplicate initial loads (React StrictMode protection)
    if (isInitialLoad && initialLoadAttempted.current) {
      console.log('⚠️ Skipping duplicate initial load attempt (React StrictMode)');
      return;
    }
    
    // Cancel any previous operation when starting a new one
    if (currentLoadingOperation.current && currentLoadingOperation.current !== operationId) {
      console.log('🛑 Canceling previous operation:', currentLoadingOperation.current);
      currentLoadingOperation.current = null;
    }
    
    // For user prompts (forceFresh), bypass the loading guard
    if (isLoading && !forceFresh) {
      console.log('⚠️ Already loading, skipping request (not user-forced)');
      return;
    }
    
    if (forceFresh) {
      console.log('🚀 User-forced fresh start - bypassing loading guard');
    }
    
    if (isInitialLoad) {
      initialLoadAttempted.current = true;
      console.log('🚀 Starting initial image load...');
    }
    
    // Set this as the current operation
    currentLoadingOperation.current = operationId;
    setIsLoading(true);
    isLoadingRef.current = true;
    console.log(`🔄 Set loading state: true [${operationId}]`);
    
    try {
      // Check if we're still the active operation
      if (currentLoadingOperation.current !== operationId) {
        console.log('⚠️ Operation canceled, another operation took precedence');
        return;
      }
      
      // If forceFresh is true (user submitted new prompt), don't use any previous image
      const lastImage = forceFresh ? null : (imageUrls.length > 0 ? imageUrls[imageUrls.length - 1] : null);
      
      // For fresh starts (user prompts), explicitly use flux-schnell model
      const modelToUse = forceFresh ? 'flux-schnell' : (forceModel || null);
      
      console.log('🎯 Parameter decisions:');
      console.log('  - imageUrls.length:', imageUrls.length);
      console.log('  - forceFresh:', forceFresh);
      console.log('  - lastImage (will be used):', !!lastImage);
      console.log('  - modelToUse:', modelToUse);
      console.log('  - customPrompt (will be passed):', customPrompt);
      
      console.log('🚀 Calling fetchNextImage...');
      
      const imageData = await fetchNextImage(
        lastImage?.imageUrl || null, 
        modelToUse, 
        debugMode,
        customPrompt,
        inferenceSteps // Pass steps to the API call
      );
      
      // Check again if we're still the active operation after async call
      if (currentLoadingOperation.current !== operationId) {
        console.log('⚠️ Operation canceled during fetchNextImage, discarding result');
        return;
      }
      
      // In development, be more lenient about mounting state due to hot reloads
      if (!isComponentMounted.current && process.env.NODE_ENV === 'production') {
        console.log('⚠️ Component unmounted during fetchNextImage, discarding result');
        return;
      }
      
      console.log('📨 fetchNextImage returned:');
      console.log('  - imageData exists:', !!imageData);
      console.log('  - imageData.imageUrl:', !!imageData?.imageUrl);
      console.log('  - imageData.prompt:', imageData?.prompt);
      console.log('  - imageData.modelUsed:', imageData?.modelUsed);
      
      if (imageData && imageData.imageUrl) {
        setImageUrls(prev => {
          const newUrls = [...prev, imageData];
          console.log('📊 Image state update:', {
            previousCount: prev.length,
            newCount: newUrls.length,
            newImage: {
              prompt: imageData.prompt,
              hasUrl: !!imageData.imageUrl,
              urlLength: imageData.imageUrl ? imageData.imageUrl.length : 0
            }
          });
          return newUrls;
        });
        setLastImageData(imageData);
        console.log('✅ Added new image to state');
        
        // Log performance metrics if debug mode is enabled
        if (debugMode && imageData.debug) {
          console.log('🚀 Performance Metrics:', {
            model: imageData.debug.modelUsed,
            requested: imageData.debug.requestedModel,
            time: `${imageData.debug.generationTime}ms`,
            steps: imageData.debug.inferenceSteps,
            outpainting: imageData.debug.supportsOutpainting
          });
        }
      } else {
        console.error('❌ No valid image data received', { imageData });
      }
    } catch (error) {
      console.error('❌ Error loading more images:', error);
    } finally {
      // Only clear loading state if we're still the active operation
      if (currentLoadingOperation.current === operationId) {
        setIsLoading(false);
        isLoadingRef.current = false;
        currentLoadingOperation.current = null;
        console.log(`🔄 Cleared loading state: false [${operationId}]`);
      }
    }
    console.log(`🔵 === END FRONTEND APP - LOAD MORE IMAGES DEBUG [${componentId.current}:${operationId}] ===`);
  }, [isLoading, imageUrls, currentModel, debugMode, inferenceSteps]); // Add dependency

  // Wrapper for infinite scroll that doesn't pass isInitialLoad flag
  const loadMoreForScroll = useCallback(() => {
    console.log(`🔄 Infinite scroll triggered [${componentId.current}] - imageUrls.length:`, imageUrls.length, 'isLoading:', isLoadingRef.current);
    // Don't trigger if already loading to prevent duplicate operations
    if (isLoadingRef.current) {
      console.log('⚠️ Already loading, skipping infinite scroll trigger');
      return;
    }
    return loadMoreImages(null, false); // Not an initial load
  }, [loadMoreImages]); // Stable dependencies - no state variables that change frequently
  
  const lastImageRef = useInfiniteScroll(loadMoreForScroll);

  // Cleanup effect to handle component unmounting
  useEffect(() => {
    // Reset mounting state when component mounts (handles hot reloads)
    isComponentMounted.current = true;
    // Reset initial load state for fresh component instances
    if (Date.now() - componentStartTime.current < 1000) {
      // Only reset if this is a fresh component (less than 1 second old)
      initialLoadAttempted.current = false;
      hasRunInitialization.current = false;
    }
    console.log(`🟢 Component mounted [${componentId.current}], initialLoadAttempted reset to:`, initialLoadAttempted.current, 'hasRunInitialization reset to:', hasRunInitialization.current);
    
    return () => {
      console.log(`🧹 Component unmounting [${componentId.current}], cleaning up...`);
      isComponentMounted.current = false;
      currentLoadingOperation.current = null;
    };
  }, []);

  // Initialize with first image - controlled by flag to prevent multiple triggers
  useEffect(() => {
    console.log(`🔄 Initialization useEffect [${componentId.current}] - hasRunInitialization:`, hasRunInitialization.current, 'userPromptPending:', userPromptPending, 'imageUrls.length:', imageUrls.length);
    
    // Only run initialization logic once per component lifecycle
    if (hasRunInitialization.current) {
      console.log('🔄 Initialization already completed, skipping');
      return;
    }
    
    // Don't generate random prompt if user has submitted a custom prompt
    if (userPromptPending) {
      console.log('🛑 Skipping random prompt generation - user prompt pending');
      return;
    }
    
    // In development, be more lenient about mounting state due to hot reloads
    if (!isComponentMounted.current && process.env.NODE_ENV === 'production') {
      console.log('⚠️ Component unmounted, skipping useEffect');
      return;
    }
    
    // Only generate initial image if we have no images and haven't tried yet
    if (imageUrls.length === 0 && !initialLoadAttempted.current) {
      hasRunInitialization.current = true; // Mark initialization as started
      const randomPrompt = getRandomPrompt();
      console.log('🎲 Using random prompt for initial load:', randomPrompt);
      setCurrentPrompt(randomPrompt);
      loadMoreImages(null, true, randomPrompt); // Pass isInitialLoad = true with random prompt
    }
  }, [imageUrls.length, userPromptPending, loadMoreImages, getRandomPrompt]); // Include necessary dependencies

  // Handle model change from debug overlay
  const handleModelChange = useCallback((newModel) => {
    console.log(`Model changed to: ${newModel}`);
    setCurrentModel(newModel);
    // Optionally generate a new image with the new model immediately
    // loadMoreImages(newModel);
  }, []);

  // Handle debug mode toggle
  const handleDebugModeChange = useCallback((enabled) => {
    console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    setDebugModeState(enabled);
    setDebugMode(enabled);
  }, []);

  // Handle refresh from debug overlay
  const handleRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh with current model:', currentModel);
    return loadMoreImages(currentModel, false); // Not an initial load
  }, [currentModel, loadMoreImages]);

  // Handle custom prompt submission - this will replace all images
  const handlePromptSubmit = useCallback(async (userPrompt) => {
    const submitId = Math.random().toString(36).substr(2, 9);
    try {
      console.log(`🟡 === FRONTEND APP - PROMPT SUBMIT DEBUG [${componentId.current}:${submitId}] ===`);
      console.log('📥 handlePromptSubmit called with:');
      console.log('  - userPrompt:', userPrompt);
      console.log('  - userPrompt type:', typeof userPrompt);
      console.log('  - userPrompt length:', userPrompt ? userPrompt.length : 0);
      console.log('  - currentPrompt (before):', currentPrompt);
      console.log('  - isLoading (before):', isLoading);
      console.log('  - componentId:', componentId.current);
      
      // In development, be more lenient about mounting state due to hot reloads
      if (!isComponentMounted.current && process.env.NODE_ENV === 'production') {
        console.log('⚠️ Component unmounted, canceling prompt submit');
        return;
      }
      
      // Set flag to prevent random prompt generation
      setUserPromptPending(true);
      console.log('🛑 Set userPromptPending=true to prevent random prompt');
      
      // Cancel any current loading operation - user input takes priority
      if (currentLoadingOperation.current) {
        console.log('🛑 Canceling current loading operation for user prompt:', currentLoadingOperation.current);
        currentLoadingOperation.current = null;
      }
      setIsLoading(false);
      isLoadingRef.current = false;
      
      setIsExpandingPrompt(true);
      
      // Update current prompt FIRST
      setCurrentPrompt(userPrompt);
      console.log('✅ Updated currentPrompt to:', userPrompt);
      
      // Clear existing images to start fresh with new scene
      setImageUrls([]);
      setLastImageData(null);
      initialLoadAttempted.current = false;
      hasRunInitialization.current = false; // Reset initialization flag for fresh start
      console.log('🧹 Cleared existing images and reset state');
      
      // Generate initial image with user prompt using forceFresh=true
      console.log('🚀 About to call loadMoreImages with:');
      console.log('  - forceModel: null');
      console.log('  - isInitialLoad: true');
      console.log('  - customPrompt:', userPrompt);
      console.log('  - forceFresh: true');
      
      // Wait a tiny bit to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await loadMoreImages(null, true, userPrompt, true); // forceFresh=true
      
      console.log('✅ loadMoreImages completed');
      console.log(`🟡 === END FRONTEND APP - PROMPT SUBMIT DEBUG [${componentId.current}:${submitId}] ===`);
      
    } catch (error) {
      console.error('❌ Error creating new scene:', error);
    } finally {
      setIsExpandingPrompt(false);
      setUserPromptPending(false); // Clear flag after processing
      console.log('✅ Cleared userPromptPending flag');
    }
  }, [currentModel, loadMoreImages, currentPrompt, isLoading]);

  // Debug: Log render state
  console.log(`🖼️ Rendering [${componentId.current}]:`, {
    imageUrlsLength: imageUrls.length,
    isLoading,
    currentPrompt,
    isExpandingPrompt,
    userPromptPending
  });

  return (
    <div className="App">
      {/* Debug Overlay */}
      <DebugOverlay 
        onModelChange={handleModelChange}
        lastImageData={lastImageData}
        onRefresh={handleRefresh}
        onStepsChange={setInferenceStepsState} // Pass setter to overlay
        isVisible={true}
      />

      {/* Image Display */}
      {imageUrls.length > 0 ? (
        imageUrls.map((imageData, index) => {
          const isLastElement = index === imageUrls.length - 1;
          console.log(`🖼️ Rendering image ${index}:`, {
            hasUrl: !!imageData.imageUrl,
            prompt: imageData.prompt,
            isLastElement
          });
          return (
            <div key={index} ref={isLastElement ? lastImageRef : null}>
              <ImageContainer 
                src={imageData.imageUrl} 
                prompt={imageData.prompt}
                isInitial={imageData.isInitial}
                debug={debugMode ? imageData.debug : null}
                modelUsed={imageData.debug?.modelUsed}
                generationTime={imageData.debug?.generationTime}
              />
            </div>
          );
        })
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          margin: '10px',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>
            🎨 No images yet
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>
            {isLoading ? 'Generating your first image...' : 'Enter a prompt above to start creating!'}
          </div>
        </div>
      )}
      
      {/* Loading Indicator */}
      {isLoading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px',
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          margin: '10px',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>
            🚀 Generating with {currentModel.toUpperCase()}...
          </div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>
            {imageUrls.length === 0 ? 
              'Initial image: FLUX Schnell (1 step, ultra-fast)' :
              currentModel === 'flux-fill-pro' ? 'Outpainting: FLUX Fill Pro (4 steps, seamless)' :
              currentModel === 'flux-schnell' ? 'Ultra-fast generation (1 step)' :
              currentModel === 'flux-schnell-lora' ? 'Balanced generation (2 steps)' :
              'Processing...'}
          </div>
        </div>
      )}

      {/* Floating Dream World Input - Always visible */}
      <PromptInput 
        onPromptSubmit={handlePromptSubmit}
        isExpanding={isExpandingPrompt}
        currentPrompt={currentPrompt}
      />
    </div>
  );
}

export default App;
