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
  checkHealth
} from './services/api';

function App() {
  const [imageUrls, setImageUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState(getCurrentModel());
  const [debugMode, setDebugModeState] = useState(getDebugMode());
  const [lastImageData, setLastImageData] = useState(null);
  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Ref to prevent duplicate initial loads (React StrictMode protection)
  const initialLoadAttempted = useRef(false);

  const loadMoreImages = useCallback(async (forceModel = null, isInitialLoad = false, customPrompt = null) => {
    // Prevent duplicate initial loads (React StrictMode protection)
    if (isInitialLoad && initialLoadAttempted.current) {
      console.log('⚠️ Skipping duplicate initial load attempt (React StrictMode)');
      return;
    }
    
    if (isLoading) {
      console.log('⚠️ Already loading, skipping request');
      return;
    }
    
    if (isInitialLoad) {
      initialLoadAttempted.current = true;
      console.log('🚀 Starting initial image load...');
    }
    
    setIsLoading(true);
    try {
      const lastImage = imageUrls.length > 0 ? imageUrls[imageUrls.length - 1] : null;
      // Only use explicit model if forced, otherwise let backend auto-select
      const modelToUse = forceModel || null;
      
      console.log(`Loading image with model: ${modelToUse || 'auto-select'}, debug: ${debugMode}, initial: ${isInitialLoad}, customPrompt: ${!!customPrompt}`);
      
      const imageData = await fetchNextImage(
        lastImage?.imageUrl || null, 
        modelToUse, 
        debugMode,
        customPrompt
      );
      
      if (imageData && imageData.imageUrl) {
        setImageUrls(prev => [...prev, imageData]);
        setLastImageData(imageData);
        console.log('✅ Added new image:', imageData);
        
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
      }
    } catch (error) {
      console.error('❌ Error loading more images:', error);
    }
    setIsLoading(false);
  }, [isLoading, imageUrls, currentModel, debugMode]);

  // Wrapper for infinite scroll that doesn't pass isInitialLoad flag
  const loadMoreForScroll = useCallback(() => {
    return loadMoreImages(null, false); // Not an initial load
  }, [loadMoreImages]);
  
  const lastImageRef = useInfiniteScroll(loadMoreForScroll);

  // Load the very first image on component mount
  useEffect(() => {
    console.log('🔄 useEffect triggered - imageUrls.length:', imageUrls.length, 'initialLoadAttempted:', initialLoadAttempted.current);
    if (imageUrls.length === 0 && !initialLoadAttempted.current) {
      loadMoreImages(null, true); // Pass isInitialLoad = true
    }
  }, []); // Empty dependency array ensures this runs only once

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

  // Handle custom prompt submission
  const handlePromptSubmit = useCallback(async (userPrompt) => {
    try {
      console.log('🌍 User creating dream world:', userPrompt);
      setIsExpandingPrompt(true);
      
      // Expand the short prompt into a detailed aerial view description
      // Prompt expansion is now handled within the backend API
      const expandedPrompt = userPrompt;
      console.log('✨ Dream world expanded:', expandedPrompt);
      
      // Mark that the user has started their world
      setHasStarted(true);
      
      // Clear existing images to start fresh with new world
      setImageUrls([]);
      initialLoadAttempted.current = false;
      
      // Generate initial image with expanded prompt
      await loadMoreImages(currentModel, true, expandedPrompt);
      
    } catch (error) {
      console.error('Error creating dream world:', error);
    } finally {
      setIsExpandingPrompt(false);
    }
  }, [currentModel, loadMoreImages]);

  return (
    <div className="App">
      {/* Debug Overlay */}
      <DebugOverlay 
        onModelChange={handleModelChange}
        lastImageData={lastImageData}
        onRefresh={handleRefresh}
        isVisible={true}
      />

      {/* Image Display */}
      {imageUrls.map((imageData, index) => {
        const isLastElement = index === imageUrls.length - 1;
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
      })}
      
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

      {/* Dream World Input */}
      <PromptInput 
        onPromptSubmit={handlePromptSubmit}
        isExpanding={isExpandingPrompt}
        hasStarted={hasStarted}
      />
    </div>
  );
}

export default App;
