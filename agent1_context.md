# Agent 1 Context: Frontend UI & Core Logic

## Project Overview

**Project Name:** Infinite Visual Story

**Vision:** To create a single-page web application that presents a user with an infinite scroll of AI-generated, full-screen images. The images should flow into each other seamlessly, as if scrolling through a single, massive, ever-changing canvas. Each visit provides a unique, randomly generated visual narrative that evolves as the user scrolls.

## Your Role: Frontend UI & Core Logic

As Agent 1, your primary responsibility is to build the user-facing part of the application. This includes:

*   **User Interface (UI):** Creating the React components to display the images.
*   **Infinite Scroll Mechanism:** Implementing the logic that detects when the user scrolls to the bottom and triggers the loading of new images.
*   **API Communication:** Making requests to the backend API to fetch new image URLs.
*   **Initial Rendering:** Setting up the Vite project and the main application entry points.

## What Other Agents Are Doing

*   **Agent 2 (Backend Server Setup):** This agent is building the Node.js Express server. It will provide the `/api/generate-next-image` endpoint that you will call to get new image URLs. For now, it will return placeholder image URLs.
*   **Agent 3 (AI Service Integration):** This agent is implementing the actual AI image generation and prompt evolution logic within the backend. You will not directly interact with this agent's code, but your requests to the backend will eventually trigger its functions.

## Key Architectural Considerations (from `architecture.md`)

*   **Framework:** React with Vite.
*   **State Management:** Use standard React state (`useState`) to manage the array of image URLs.
*   **Infinite Scroll:** Utilize the `Intersection Observer API` to detect scroll events.
*   **UI & Rendering:** Initial implementation uses standard DOM `<img>` elements. Be aware that future optimizations will involve WebGL batch rendering for performance.
*   **Data Flow (Frontend Perspective):** You initiate the process by calling the backend. You receive image URLs and render them. You are responsible for triggering subsequent calls as the user scrolls.

## Key Analysis & Optimization Considerations (from `analysis.md`)

While your current task is foundational, keep these future considerations in mind:

*   **Performance Targets:** The application aims for very smooth scrolling (`timeToSeamlessScroll < 100ms`, `scrollJankScore < 0.1`). Your initial implementation should be clean and efficient to facilitate future optimizations.
*   **Rendering Optimization:** The plan includes transitioning to WebGL rendering. Your `ImageContainer` component should be designed to allow for this future change (e.g., by accepting an image source and not making assumptions about how it's rendered).
*   **Memory Management:** Future steps will involve aggressive memory cleanup for off-screen images. Your component structure should allow for easy removal or unmounting of images.
*   **Network Optimization:** You will be making API calls. Be aware that HTTP/3 and priority hints are planned for network optimization.

## Your Task (from `development.md`)

Follow the detailed instructions in the `development.md` file under "Agent 1: Frontend UI & Core Logic" to create/modify the specified files (`package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/components/ImageContainer.jsx`, `src/hooks/useInfiniteScroll.js`, `src/services/api.js`, `src/index.css`, `src/components/ImageContainer.css`).
