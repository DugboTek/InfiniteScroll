# Backend AI Service Integration

This backend service integrates with AI services to generate seamless infinite scroll images using outpainting techniques.

## Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Image Generation Settings
IMAGE_WIDTH=1920
IMAGE_HEIGHT=1080
GENERATION_TIMEOUT=30000
MAX_IMAGES_PER_MINUTE=30

# AI Service API Keys
REPLICATE_API_TOKEN=your_replicate_token_here
GEMINI_API_KEY=your_gemini_api_key_here
HUGGINGFACE_API_TOKEN=your_huggingface_token_here
```

## API Key Setup

1. **Replicate API Token**: 
   - Visit https://replicate.com/account/api-tokens
   - Create a new token and add it to your .env file

2. **Gemini API Key**:
   - Visit https://ai.google.dev/
   - Create a new API key and add it to your .env file

3. **Hugging Face Token** (Optional):
   - Visit https://huggingface.co/settings/tokens
   - Create a new token and add it to your .env file

## AI Service Functions

The `aiService.js` module provides three core functions:

### `generateInitialImage(customPrompt)`
- Generates the first image in the infinite scroll sequence
- Uses a random starting prompt if no custom prompt is provided
- Returns image URL and metadata

### `generateNextImage(previousImageUrl, prompt)`
- Generates the next image using outpainting technique
- Takes a slice from the bottom of the previous image
- Places it at the top of a new canvas and outpaints the rest
- Ensures seamless visual continuity

### `evolvePrompt(currentPrompt)`
- Uses Gemini AI to evolve the story prompt
- Maintains narrative continuity while introducing new elements
- Fallback to prompt variations if AI evolution fails

## Architecture

The outpainting process works as follows:

1. Download the previous image
2. Extract a 150px slice from the bottom
3. Place this slice at the top of a new canvas
4. Use AI inpainting to fill the remaining canvas
5. Return the new seamless image

This creates the illusion of scrolling through one continuous, ever-expanding image.

## Usage

Start the development server:
```bash
npm run dev
```

The API endpoint `/api/generate-next-image` accepts:
- `previousImage`: URL of the previous image (optional for initial request)
- `currentPrompt`: Text prompt for image generation (optional)

Returns:
- `imageUrl`: URL of the generated image
- `prompt`: The prompt used for generation
- `isInitial`: Boolean indicating if this is the first image
- `timestamp`: Generation timestamp
- `width`: Image width
- `height`: Image height 