# Project Architecture: Infinite Visual Story

## 1. Project Vision

To create a single-page web application that presents a user with an infinite scroll of AI-generated, full-screen images. The images should flow into each other seamlessly, as if scrolling through a single, massive, ever-changing canvas. Each visit provides a unique, randomly generated visual narrative that evolves as the user scrolls.

## 2. Core Concepts

### AI Outpainting
The core technical driver for the seamless effect is **AI Outpainting**. When a new image needs to be generated, the process is as follows:
1.  A small slice from the bottom of the last generated image is taken.
2.  This slice is placed at the top of a new, blank canvas.
3.  The AI image generation model is instructed to "fill in" (outpaint) the rest of the blank canvas based on the content of the top slice and an evolving text prompt.
This ensures the new image perfectly matches the previous one at the seam.

### Evolving Prompts
To guide the visual narrative and prevent creative stagnation, the text prompt sent to the AI will evolve with each new image. A fast and lightweight text-generation model will be used to create a new prompt based on the previous one, suggesting what might appear next in the scene.

## 3. System Components

### 3.1. Frontend
- **Framework:** React with Vite (for fast development and performance).
- **State Management:** Standard React state (`useState`) will hold the array of generated image URLs.
- **Infinite Scroll:** The `Intersection Observer API` will be used to detect when the user has scrolled near the bottom of the last image. This will trigger a request for the next image.
- **UI & Rendering:** Initial implementation will use standard DOM elements (`<img>`). For performance optimization, the architecture will evolve to use **WebGL batch rendering** via a library like Pixi.js or Three.js. This will minimize DOM manipulation and reduce scroll jank.
- **Image Caching:** A Content Delivery Network (CDN) will be used to cache generated images, reducing latency and cost for repeated views of the same image segments.

### 3.2. Backend
- **Framework:** Node.js with Express.js (lightweight, fast, and well-suited for I/O-bound tasks).
- **Primary Endpoint:** A single API endpoint, e.g., `/api/generate-next-image`.
  - **Initial Request:** If no previous image is provided, it generates a completely new image from a random starting prompt.
  - **Subsequent Requests:** If a previous image is provided (as a data URL or file), it executes the outpainting logic.
- **Security:** The backend will securely store and use the API keys for the AI services, never exposing them to the frontend.

### 3.3. AI Services
- **Image Generation:** A service providing access to an open-source model like **Stable Diffusion** that is fine-tuned for inpainting/outpainting.
  - **Provider:** A pay-per-use platform like **Replicate** or **Hugging Face Inference APIs** for cost-effectiveness.
- **Prompt Generation:** A fast and cheap text model (e.g., **Gemini API**) to handle the evolution of the story prompt.

## 4. Data Flow & Optimization
1.  **Initial Load:** User opens the site. Frontend calls the backend `/api/generate-next-image` endpoint with no payload.
2.  **First Image:** Backend generates a random prompt and calls the AI image service to create the first image. It returns a CDN-cached image URL to the frontend.
3.  **User Scrolls:** The user scrolls down. The `Intersection Observer` on the frontend is triggered.
4.  **Next Image Request:** Frontend calls the backend endpoint again, this time sending the URL or data of the last image. It may include a `X-Prefetch-Distance` header to inform the backend of scroll velocity.
5.  **Backend Logic:**
    a. Backend fetches/processes the last image.
    b. It calls the text-gen AI to create a new prompt.
    c. It calls the image-gen AI, providing the bottom slice of the last image and the new prompt to perform outpainting.
6.  **Next Image Response:** Backend returns the new, CDN-cached image URL.
7.  **Loop & Memory Management:** The frontend adds the new image to its list for rendering. An aggressive cleanup strategy will be implemented to release memory for off-screen images, keeping only a small number of images in the DOM or WebGL context at any time.
