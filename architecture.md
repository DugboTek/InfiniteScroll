# Project Architecture: Infinite Visual Story

## 1. Project Vision

To create a single-page web application that presents a user with an infinite scroll of AI-generated, full-screen images. The images should flow into each other seamlessly, as if scrolling through a single, massive, ever-changing canvas. Each visit provides a unique, randomly generated visual narrative that evolves as the user scrolls.

## 2. Core Concepts

### AI Outpainting
The core technical driver for the seamless effect is **AI Outpainting**. When a new image needs to be generated for **downward scrolling**, the process is as follows:

**Scroll Flow Direction**: Previous Image **BOTTOM** → Next Image **TOP** → AI generates **BELOW**

1.  A small slice from the **bottom** of the last generated image is extracted.
2.  This slice is placed **exactly** at the **top** of a new canvas (no offset for perfect alignment).
3.  A mask is created: **BLACK** (preserve) at the top where the slice is, **WHITE** (generate) at the bottom.
4.  The AI model is instructed to **"continue the scene below"** the existing slice, generating new content in the white mask area.
5.  Enhanced prompt guidance: "Continue the scene naturally below the existing image content, maintaining visual consistency and perspective as the view extends downward."

This ensures seamless downward scrolling where each new image naturally continues from where the previous one ended.

### Multi-Model Architecture
The system supports multiple AI models with intelligent selection based on use case:

**Smart Model Selection Strategy**:
- **Initial Images**: FLUX Schnell (text-to-image capability required)
- **Subsequent Images**: FLUX Fill Pro (outpainting for seamless transitions)

**Available Models**:
- **FLUX Fill Pro**: **DEFAULT FOR OUTPAINTING** - Professional image extension (4 steps, ~15-20 seconds)
  - *Note: Requires input image - cannot generate from text alone*
- **FLUX Schnell**: **DEFAULT FOR INITIAL** - Ultra-fast text-to-image (1 step, ~5-10 seconds)
- **FLUX Schnell LoRA**: Fine-tuned variants for balanced performance (2 steps, ~8-12 seconds)
- **Stable Diffusion XL**: Fallback model for compatibility (20 steps, fallback option)

### Evolving Prompts
To guide the visual narrative and prevent creative stagnation, the text prompt sent to the AI will evolve with each new image. A fast and lightweight text-generation model will be used to create a new prompt based on the previous one, suggesting what might appear next in the scene.

**Perspective Strategy**: All prompts focus on **overhead/aerial views** of distant scenes:
- Starting prompts use terms like "aerial view", "bird's eye view", "overhead shot", "satellite view"
- Prompt evolution maintains the high-altitude perspective throughout the narrative
- Scenes are viewed from above, showing vast landscapes and far-away environments
- Visual continuity is maintained as if the camera is moving across a massive landscape from above

### Debug & Development Features
- **Debug Overlay**: Real-time model switching interface
- **Prompt Display**: Current prompt shown on screen for debugging
- **Performance Metrics**: Generation time and model information
- **Model Comparison**: Side-by-side testing capabilities

## 3. System Components

### 3.1. Frontend
- **Framework:** React with Vite (for fast development and performance).
- **State Management:** Standard React state (`useState`) will hold the array of generated image URLs.
- **Infinite Scroll:** The `Intersection Observer API` will be used to detect when the user has scrolled near the bottom of the last image. This will trigger a request for the next image.
- **Debug Interface:** Floating overlay with model controls, prompt display, and performance metrics.
- **UI & Rendering:** Initial implementation will use standard DOM elements (`<img>`). For performance optimization, the architecture will evolve to use **WebGL batch rendering** via a library like Pixi.js or Three.js. This will minimize DOM manipulation and reduce scroll jank.
- **Image Caching:** A Content Delivery Network (CDN) will be used to cache generated images, reducing latency and cost for repeated views of the same image segments.

### 3.2. Backend
- **Framework:** Node.js with Express.js (lightweight, fast, and well-suited for I/O-bound tasks).
- **Primary Endpoint:** A single API endpoint, e.g., `/api/generate-next-image`.
  - **Initial Request:** If no previous image is provided, it generates a completely new image from a random starting prompt.
  - **Subsequent Requests:** If a previous image is provided (as a data URL or file), it executes the outpainting logic.
  - **Model Selection:** Accepts model parameter to switch between different AI models.
- **Model Management:** Configurable model switching with optimized parameters for each model.
- **Performance Optimization:** 
  - Reduced inference steps for speed (1-4 steps for FLUX Schnell)
  - Parallel processing where possible
  - Intelligent model selection based on use case
- **Security:** The backend will securely store and use the API keys for the AI services, never exposing them to the frontend.

### 3.3. AI Services
- **Primary Models:**
  - **FLUX Schnell** (`black-forest-labs/flux-schnell`): Ultra-fast text-to-image (1-4 steps)
  - **FLUX Fill Pro** (`black-forest-labs/flux-fill-pro`): Professional inpainting/outpainting
  - **FLUX Schnell LoRA** (`black-forest-labs/flux-schnell-lora`): Fine-tuned variants
- **Fallback Model:** Stable Diffusion XL for compatibility
- **Provider:** Replicate API for cost-effectiveness and model availability
- **Prompt Generation:** Gemini API for fast text evolution

## 4. Data Flow & Optimization

### 4.0. Production Deployment
**Production URL**: https://infinite-scroll-pt3qiapom-dugboteks-projects.vercel.app
**Deployment Platform**: Vercel
**Frontend**: React/Vite served as static build
**Backend**: ES Module serverless functions with full outpainting pipeline
**Environment Variables**: ✅ Configured (REPLICATE_API_TOKEN, GEMINI_API_KEY, etc.)
**API Endpoints**:
- `/api/generate-next-image` - Full outpainting pipeline with image slicing and cropping
- `/api/health` - System health check
- `/api/models` - Available AI models

**Outpainting Implementation**: ✅ COMPLETE
- **Smart Model Selection**: flux-schnell for initial, flux-fill-pro for outpainting
- **Image Slicing**: 35% bottom slice extraction for smooth transitions
- **Masking System**: Black (preserve) / White (generate) mask creation
- **Cropping Pipeline**: Removes duplicate slices for seamless flow
- **Perspective Control**: Strict top-down aerial view maintained
- **Prompt Evolution**: Gemini-1.5-flash for narrative continuity

**Status**: ✅ FULLY DEPLOYED & OPERATIONAL

### 4.1. Multi-Model Image Generation Flow
1.  **Initial Load:** User opens the site. Frontend calls the backend `/api/generate-next-image` endpoint with no payload.
2.  **Model Selection:** Backend selects appropriate model (FLUX Schnell for speed, FLUX Fill Pro for outpainting).
3.  **First Image:** Backend generates a random prompt and calls the selected AI service to create the first image.
4.  **User Scrolls:** The user scrolls down. The `Intersection Observer` on the frontend is triggered.
5.  **Next Image Request:** Frontend calls the backend endpoint, sending the last image URL and current model preference.
6.  **Outpainting Logic:**
    a. Backend fetches/processes the last image.
    b. For FLUX Fill Pro: Creates proper mask and outpainting input.
    c. For FLUX Schnell: Uses bottom slice technique with evolved prompt.
    d. Calls text-gen AI to create a new prompt.
    e. Calls image-gen AI with optimized parameters (1-4 steps for speed).
7.  **Response:** Backend returns the new image URL with metadata (model used, generation time, prompt).

### 4.2. Debug & Development Flow
- **Debug Overlay:** Displays current model, prompt, and performance metrics
- **Model Switching:** Real-time switching between available models
- **Performance Monitoring:** Track generation times and optimize parameters

### 4.3. Performance Targets
- **Sub-10 Second Generation:** Achieved through FLUX Schnell with minimal inference steps
- **Seamless Transitions:** FLUX Fill Pro ensures perfect continuity between images
- **Memory Management:** Aggressive cleanup strategy for off-screen images

## 5. Technical Implementation

### 5.1. Model Configuration
```javascript
const MODEL_CONFIGS = {
  'flux-schnell': {
    name: 'black-forest-labs/flux-schnell',
    steps: 1, // Ultra-fast mode
    guidance_scale: 0.0,
    use_case: 'speed'
  },
  'flux-fill-pro': {
    name: 'black-forest-labs/flux-fill-pro',
    steps: 4,
    guidance_scale: 3.5,
    use_case: 'outpainting'
  },
  'flux-schnell-lora': {
    name: 'black-forest-labs/flux-schnell-lora',
    steps: 2,
    guidance_scale: 1.0,
    use_case: 'balanced'
  }
};
```

### 5.2. Debug Interface Components
- **Model Selector:** Dropdown to switch between models
- **Prompt Display:** Current and next prompts
- **Performance Metrics:** Generation time, model info
- **Image Metadata:** Dimensions, model used, parameters

This architecture ensures blazing-fast image generation while maintaining the seamless outpainting effect that creates the infinite canvas experience.
