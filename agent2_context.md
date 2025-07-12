# Agent 2 Context: Backend Server Setup

## Project Overview

**Project Name:** Infinite Visual Story

**Vision:** To create a single-page web application that presents a user with an infinite scroll of AI-generated, full-screen images. The images should flow into each other seamlessly, as if scrolling through a single, massive, ever-changing canvas. Each visit provides a unique, randomly generated visual narrative that evolves as the user scrolls.

## Your Role: Backend Server Setup

As Agent 2, your primary responsibility is to establish the server-side foundation for the application. This includes:

*   **API Endpoint:** Creating the primary API endpoint that the frontend will call to request new images.
*   **Server Configuration:** Setting up the Express server, handling CORS, and managing environment variables.
*   **Initial Placeholder Logic:** Providing a basic response for the frontend to work with, even before the AI integration is complete.

## What Other Agents Are Doing

*   **Agent 1 (Frontend UI & Core Logic):** This agent is building the React application that will display the images and manage the infinite scroll. It will be making requests to the API endpoint you create.
*   **Agent 3 (AI Service Integration):** This agent is developing the module that will interact with the external AI image and text generation services. Your server will eventually import and utilize the functions from Agent 3's module to generate actual images.

## Key Architectural Considerations (from `architecture.md`)

*   **Framework:** Node.js with Express.js.
*   **Primary Endpoint:** A single POST endpoint, `/api/generate-next-image`, which will handle both initial image requests and subsequent outpainting requests.
*   **Security:** The backend is crucial for securely storing and using AI API keys, preventing their exposure to the frontend.
*   **Data Flow (Backend Perspective):** You receive requests from the frontend, process them, and return image URLs. You will eventually orchestrate calls to the AI services (handled by Agent 3).

## Key Analysis & Optimization Considerations (from `analysis.md`)

While your current task is foundational, keep these future considerations in mind:

*   **Performance Targets:** The backend needs to respond quickly (`TTFB < 200ms`, `generationQueueLatency < 2s`). Your server setup should be lean and efficient.
*   **Load Testing:** The server will be subjected to load tests simulating many concurrent users. Ensure your Express setup is robust.
*   **Network Optimization:** The plan includes HTTP/3 and CDN usage. Your server should be designed to return image URLs that can be served efficiently by a CDN.
*   **Cost Analysis:** The backend is where AI generation costs will be incurred. Your design should be mindful of efficient resource usage.

## Your Task (from `development.md`)

Follow the detailed instructions in the `development.md` file under "Agent 2: Backend Server Setup" to create/modify the specified files (`backend/package.json`, `backend/server.js`, `backend/.env`).
