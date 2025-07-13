// This service will handle communication with the backend.
// For now, it returns a placeholder.

const API_URL = 'http://localhost:3001/api/generate-next-image'; // Backend runs on 3001

// State to track current prompt for continuity
let currentPrompt = null;

export const fetchNextImage = async (previousImage = null) => {
  try {
    console.log('Fetching next image...', { previousImage: !!previousImage, currentPrompt });
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        previousImage, 
        currentPrompt 
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
    
    return {
      imageUrl: data.imageUrl,
      prompt: data.prompt,
      isInitial: data.isInitial,
      timestamp: data.timestamp,
      width: data.width,
      height: data.height
    };

  } catch (error) {
    console.error("Failed to fetch next image:", error);
    // Return a placeholder on error to prevent crashing
    return {
      imageUrl: `https://picsum.photos/seed/${Math.random()}/1920/1080`,
      prompt: 'Placeholder image',
      isInitial: false,
      timestamp: new Date().toISOString(),
      width: 1920,
      height: 1080
    };
  }
};
