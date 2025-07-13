import React, { useState, useEffect, useCallback } from 'react';
import ImageContainer from './components/ImageContainer';
import useInfiniteScroll from './hooks/useInfiniteScroll';
import { fetchNextImage } from './services/api';

function App() {
  const [imageUrls, setImageUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMoreImages = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const lastImage = imageUrls.length > 0 ? imageUrls[imageUrls.length - 1] : null;
      const imageData = await fetchNextImage(lastImage?.imageUrl || null);
      
      if (imageData && imageData.imageUrl) {
        setImageUrls(prev => [...prev, imageData]);
        console.log('Added new image:', imageData);
      }
    } catch (error) {
      console.error('Error loading more images:', error);
    }
    setIsLoading(false);
  }, [isLoading, imageUrls]);

  const lastImageRef = useInfiniteScroll(loadMoreImages);

  // Load the very first image on component mount
  useEffect(() => {
    if (imageUrls.length === 0) {
      loadMoreImages();
    }
  }, []); // Empty dependency array ensures this runs only once

  return (
    <div className="App">
      {imageUrls.map((imageData, index) => {
        const isLastElement = index === imageUrls.length - 1;
        return (
          <div key={index} ref={isLastElement ? lastImageRef : null}>
            <ImageContainer 
              src={imageData.imageUrl} 
              prompt={imageData.prompt}
              isInitial={imageData.isInitial}
            />
          </div>
        );
      })}
      {isLoading && <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>}
    </div>
  );
}

export default App;
