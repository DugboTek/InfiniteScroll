# Parallel Development Prompts for Cursor

This file contains the specific, self-contained prompts to be given to different AI agent instances in an IDE like Cursor. Each prompt corresponds to a task outlined in `development.md`.

---

### Prompt for Agent 1: Frontend UI & Core Logic

**Request:**
"You are an expert React developer. Your task is to set up the entire frontend for our infinite scroll image application.

**Instructions:**
1.  Initialize a Vite project by creating the necessary configuration.
2.  Build all the React components, hooks, and services needed.
3.  Use placeholder data and API endpoints for now. The backend is being built separately.
4.  Ensure the application is styled to be full-screen with no default margins.

**Here is the exact code to use for each file:**

**`vite.config.js`**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
```

**`index.html`**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Infinite Visual Story</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**`src/main.jsx`**
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**`src/index.css`**
```css
body, html, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  background-color: #111;
  color: white;
}
```

**`src/components/ImageContainer.jsx`**
```javascript
import React from 'react';
import './ImageContainer.css';

const ImageContainer = ({ src }) => {
  return (
    <div className="image-container">
      <img src={src} alt="AI-generated visual story segment" />
    </div>
  );
};

export default ImageContainer;
```

**`src/components/ImageContainer.css`** (Create this new file)
```css
.image-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.image-container img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}
```

**`src/hooks/useInfiniteScroll.js`**
```javascript
import { useEffect, useRef, useCallback } from 'react';

const useInfiniteScroll = (callback) => {
  const observer = useRef();

  const lastElementRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        callback();
      }
    });
    if (node) observer.current.observe(node);
  }, [callback]);

  return lastElementRef;
};

export default useInfiniteScroll;
```

**`src/services/api.js`**
```javascript
// This service will handle communication with the backend.
// For now, it returns a placeholder.

const API_URL = 'http://localhost:3001/api/generate-next-image'; // Backend runs on 3001

export const fetchNextImage = async (previousImage = null) => {
  try {
    // In a real scenario, you'd send the previous image data
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ previousImage }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    return data.imageUrl;

  } catch (error) {
    console.error("Failed to fetch next image:", error);
    // Return a placeholder on error to prevent crashing
    return `https://picsum.photos/seed/${Math.random()}/1920/1080`;
  }
};
```

**`src/App.jsx`**
```javascript
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
    const lastImage = imageUrls.length > 0 ? imageUrls[imageUrls.length - 1] : null;
    const newImageUrl = await fetchNextImage(lastImage);
    if (newImageUrl) {
      setImageUrls(prev => [...prev, newImageUrl]);
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
      {imageUrls.map((url, index) => {
        const isLastElement = index === imageUrls.length - 1;
        return (
          <div key={index} ref={isLastElement ? lastImageRef : null}>
            <ImageContainer src={url} />
          </div>
        );
      })}
      {isLoading && <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>}
    </div>
  );
}

export default App;
```
"
---

### Prompt for Agent 2: Backend Server Setup

**Request:**
"You are an expert Node.js developer. Your task is to set up the backend server for our infinite scroll image application.

**Instructions:**
1.  Install dependencies: `express`, `cors`, and `dotenv`.
2.  Create a basic Express server that listens on port 3001.
3.  Enable CORS for all origins.
4.  Create a single POST endpoint at `/api/generate-next-image`.
5.  For now, this endpoint should simply log that it was hit and return a hardcoded placeholder image URL. This allows the frontend team to work in parallel.

**Here is the exact code to use for each file:**

**`backend/package.json`** (after running `npm install express cors dotenv`)
```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2"
  }
}
```

**`backend/server.js`**
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// const { generateInitialImage, generateNextImage, evolvePrompt } = require('./aiService');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for image data

// API Endpoint
app.post('/api/generate-next-image', async (req, res) => {
  console.log('Received request for next image.');
  
  const { previousImage } = req.body;

  try {
    let imageUrl;
    if (previousImage) {
      console.log('Generating subsequent image...');
      // Placeholder for real logic
      imageUrl = `https://picsum.photos/seed/${Math.random()}/1920/1080`;
    } else {
      console.log('Generating initial image...');
      // Placeholder for real logic
      imageUrl = `https://picsum.photos/seed/start/1920/1080`;
    }
    res.status(200).json({ imageUrl });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

**`backend/.env`**
```
# AI Service Configuration
REPLICATE_API_TOKEN=your_replicate_api_token_here
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3001
```
"
---

### Prompt for Agent 3: AI Service Integration

**Request:**
"You are an expert in integrating third-party AI services. Your task is to create the module that will communicate with the AI image and text generation APIs.

**Instructions:**
1.  Create a file `backend/aiService.js`.
2.  Install the necessary SDKs: `@replicate/api` and `@google/generative-ai`.
3.  Create stub functions for the three core AI tasks: generating the initial image, generating the next image (outpainting), and evolving the text prompt.
4.  The functions should be `async` and have the correct parameters.
5.  For now, leave the implementation details as comments. The goal is to define the module's interface so the backend agent can import it.

**Here is the exact code to use for the file:**

**`backend/aiService.js`**
```javascript
// This module will contain all the logic for interacting with external AI APIs.

// const Replicate = require('@replicate/api');
// const { GoogleGenerativeAI } = require('@google/generative-ai');

// const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generates the very first image from a random or fixed prompt.
 * @returns {Promise<string>} The URL of the generated image.
 */
async function generateInitialImage() {
  console.log('AI Service: Generating initial image...');
  // TODO: Implement call to Replicate with a starting prompt.
  // Example:
  // const output = await replicate.run("stability-ai/stable-diffusion:ac732df835056b8ccf224ca7039d292d3f441659250de741b7d5167c6f36f584", {
  //   input: { prompt: "a beautiful landscape" }
  // });
  // return output[0];

  // Placeholder return
  return `https://picsum.photos/seed/initial/1920/1080`;
}

/**
 * Generates the next image by outpainting from the previous one.
 * @param {string} previousImage - The data URL of the previous image.
 * @param {string} prompt - The evolving text prompt for the new image.
 * @returns {Promise<string>} The URL of the new outpainted image.
 */
async function generateNextImage(previousImage, prompt) {
  console.log(`AI Service: Generating next image with prompt: "${prompt}"`);
  // TODO: Implement outpainting logic.
  // This usually involves using a model specifically for inpainting/outpainting.
  // You would provide the previous image and a mask to tell the model where to generate new content.
  // Example:
  // const output = await replicate.run("stability-ai/stable-diffusion-inpainting:...", {
  //   input: { 
  //      image: previousImage, 
  //      mask: "...", // You'll need to generate a mask
  //      prompt: prompt 
  //   }
  // });
  // return output[0];

  // Placeholder return
  return `https://picsum.photos/seed/${Math.random()}/1920/1080`;
}

/**
 * Evolves the story by generating a new prompt based on the last one.
 * @param {string} currentPrompt - The prompt used for the last image.
 * @returns {Promise<string>} The new, evolved prompt.
 */
async function evolvePrompt(currentPrompt) {
  console.log(`AI Service: Evolving prompt from: "${currentPrompt}"`);
  // TODO: Implement call to a text model like Gemini.
  // const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  // const instruction = `The current scene is "${currentPrompt}". Briefly describe in one sentence what you would see looking further down.`;
  // const result = await model.generateContent(instruction);
  // const response = await result.response;
  // return response.text();

  // Placeholder return
  return "a castle wall at the bottom of the view";
}

module.exports = {
  generateInitialImage,
  generateNextImage,
  evolvePrompt,
};
```
"
