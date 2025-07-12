# Agent 3 Context: AI Service Integration

## Project Overview

**Project Name:** Infinite Visual Story

**Vision:** To create a single-page web application that presents a user with an infinite scroll of AI-generated, full-screen images. The images should flow into each other seamlessly, as if scrolling through a single, massive, ever-changing canvas. Each visit provides a unique, randomly generated visual narrative that evolves as the user scrolls.

## Your Role: AI Service Integration

As Agent 3, your primary responsibility is to implement the core intelligence of the application: the communication with external AI services. This includes:

*   **Image Generation:** Interfacing with an AI model to generate initial images and perform outpainting for subsequent images.
*   **Prompt Evolution:** Using a text-based AI model to dynamically evolve the story prompt for continuous narrative.
*   **API Key Management:** Ensuring secure handling of AI service API keys via environment variables.

## What Other Agents Are Doing

*   **Agent 1 (Frontend UI & Core Logic):** This agent is building the React application that displays the images and manages the infinite scroll. It will make requests to the backend, which will then trigger your AI service functions.
*   **Agent 2 (Backend Server Setup):** This agent is setting up the Node.js Express server and defining the `/api/generate-next-image` endpoint. Your AI service functions will be imported and called by this server to fulfill image generation requests.

## Key Architectural Considerations (from `architecture.md`)

*   **AI Outpainting:** This is the core technical concept you will implement. You need to ensure the image generation model can take a previous image (or a slice of it) and extend it seamlessly.
*   **Evolving Prompts:** You will be responsible for calling a text model to generate new prompts based on the previous ones, guiding the visual story.
*   **AI Services:** You will integrate with a service like Replicate (for image generation/outpainting) and potentially the Gemini API (for prompt evolution).
*   **Security:** You must ensure that API keys are loaded from environment variables (`.env`) and are never hardcoded or exposed.

## Key Analysis & Optimization Considerations (from `analysis.md`)

Your work is critical for the application's performance and cost-effectiveness:

*   **Performance Targets:** Your image generation and prompt evolution functions must be fast (`generationQueueLatency < 2s`). Slow AI responses will directly impact user experience.
*   **Cost Analysis:** AI generation is a primary cost driver. Your implementation should be mindful of efficient API usage to minimize costs (e.g., avoiding unnecessary calls, optimizing image sizes if possible).
*   **A/B Testing:** Future plans include A/B testing different AI models. Your module should be structured to allow for easy swapping of AI model implementations.

## Your Task (from `development.md`)

Follow the detailed instructions in the `development.md` file under "Agent 3: AI Service Integration" to create/modify the specified files (`backend/aiService.js`, and potentially `backend/package.json` for dependencies).
