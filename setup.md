# Infinite Visual Story - Setup Guide

## Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- API keys for:
  - Replicate API (for image generation)
  - Google Gemini API (for prompt evolution)

## Setup Steps

### 1. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `backend/` directory with the following variables:

```env
# AI Service API Keys
REPLICATE_API_TOKEN=your_replicate_token_here
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# Image Generation Settings
IMAGE_WIDTH=1920
IMAGE_HEIGHT=1080
GENERATION_TIMEOUT=30000
MAX_IMAGES_PER_MINUTE=10
```

### 3. API Key Setup

**Replicate API:**
1. Go to https://replicate.com/
2. Sign up and get your API token
3. Add it to your `.env` file

**Google Gemini API:**
1. Go to https://makersuite.google.com/app/apikey
2. Create a new API key
3. Add it to your `.env` file

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 5. Access the Application

Open your browser and navigate to:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health Check: http://localhost:3001/health

## Troubleshooting

### Common Issues:

1. **API Key Errors:**
   - Ensure your API keys are valid and properly set in `.env`
   - Check the backend logs for specific error messages

2. **Image Generation Timeout:**
   - Increase `GENERATION_TIMEOUT` in `.env`
   - Check your internet connection

3. **CORS Issues:**
   - Ensure both frontend and backend are running on expected ports
   - Check browser developer tools for CORS errors

4. **Memory Issues:**
   - Reduce `IMAGE_WIDTH` and `IMAGE_HEIGHT` for testing
   - Monitor browser memory usage in developer tools

### Testing the API Directly:

```bash
# Test initial image generation
curl -X POST http://localhost:3001/api/generate-next-image \
  -H "Content-Type: application/json" \
  -d '{}'

# Test health endpoint
curl http://localhost:3001/health
```

## Next Steps

Once the basic application is running:

1. **Performance Testing:** Use the strategies outlined in `analysis.md`
2. **Optimization:** Implement WebGL rendering for better performance
3. **Monitoring:** Add real-user monitoring for production
4. **Caching:** Implement CDN caching for generated images

## Architecture Overview

- **Frontend:** React + Vite with infinite scroll
- **Backend:** Node.js + Express with AI integration
- **AI Services:** Replicate (Stable Diffusion) + Google Gemini
- **Image Processing:** Sharp for outpainting technique 