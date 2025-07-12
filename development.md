# Development Plan

This document breaks down the project development into parallel tasks that can be assigned to different AI agents. The tasks are structured to minimize file conflicts, allowing for simultaneous work on the frontend and backend.

## Agent 1: Frontend UI & Core Logic

**Objective:** Set up the React application and build the user-facing components.

**Files to be created/modified:**
- `package.json`
- `vite.config.js`
- `index.html`
- `src/main.jsx`
- `src/App.jsx`
- `src/components/ImageContainer.jsx`
- `src/hooks/useInfiniteScroll.js`
- `src/services/api.js`
- `src/index.css`

**Task Breakdown:**
1.  **Initialize Project:** Run `npm create vite@latest . -- --template react` to set up a new React + Vite project in the root directory.
2.  **Create `ImageContainer.jsx` Component:** This component will be responsible for displaying a single, full-screen image. It will take an image URL as a prop.
3.  **Create `useInfiniteScroll.js` Hook:** This custom hook will contain the `Intersection Observer` logic. It will take a callback function to execute when the trigger element becomes visible.
4.  **Create `api.js` Service:** This file will export a function that handles fetching the next image from the backend API.
5.  **Assemble in `App.jsx`:**
    - Manage the state for the list of image URLs.
    - Use the `useInfiniteScroll` hook to trigger the API call.
    - Render the list of images using the `ImageContainer` component.
6.  **Styling:** Add basic CSS in `index.css` to ensure components are full-screen and there is no extra margin/padding.

---

## Agent 2: Backend Server Setup

**Objective:** Create the Node.js server and define the API endpoint structure.

**Files to be created/modified:**
- `backend/package.json`
- `backend/server.js`
- `backend/.env`

**Task Breakdown:**
1.  **Initialize Project:** Create a `backend` directory. Inside it, run `npm init -y` and install `express`, `cors`, and `dotenv`.
2.  **Create `server.js`:**
    - Set up a basic Express server.
    - Enable CORS middleware.
    - Create a single POST endpoint: `/api/generate-next-image`.
3.  **Initial Endpoint Logic:** For now, the endpoint can accept a request and log it. It should return a placeholder JSON response, like `{ "imageUrl": "https://placeholder.com/image.jpg" }`. This allows the frontend agent to proceed without waiting for AI integration.
4.  **Environment Variables:** Create a `.env` file to store API keys and other configuration, which will be used by Agent 3.

---

## Agent 3: AI Service Integration

**Objective:** Implement the logic for communicating with the external AI services for image and prompt generation.

**Files to be created/modified:**
- `backend/aiService.js`
- `backend/package.json` (to add AI SDKs)

**Task Breakdown:**
1.  **Install Dependencies:** In the `backend` directory, install the necessary AI SDKs (e.g., `@replicate/api`, `@google/generative-ai`).
2.  **Create `aiService.js`:** This file will be a self-contained module.
3.  **Implement Image Generation Function:** Create an exported async function `generateInitialImage()` that takes a prompt, calls the image generation API (e.g., Replicate), and returns the URL of the generated image.
4.  **Implement Outpainting Function:** Create an exported async function `generateNextImage(previousImage, prompt)` that:
    a. Takes the previous image data and a new prompt.
    b. Prepares the image for outpainting (e.g., creating a mask).
    c. Calls the image generation API with the appropriate inpainting/outpainting parameters.
    d. Returns the URL of the new image.
5.  **Implement Prompt Evolution Function:** Create an exported async function `evolvePrompt(currentPrompt)` that calls a text model (e.g., Gemini) to generate the next logical prompt in the sequence.
