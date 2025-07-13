# 🚀 Complete API Setup Guide

## 🎯 What You Need
Your Infinite Visual Story app uses **two AI services**:
1. **Replicate** - For generating and continuing images
2. **Google Gemini** - For evolving the story prompts

## 📋 AI Models We're Using

### **Replicate Models:**
- **Initial Images:** `stability-ai/sdxl` (Stable Diffusion XL)
- **Outpainting:** `stability-ai/stable-diffusion-inpainting`
- **Cost:** ~$0.0046 per image generated

---

## 🔧 Step 1: Set Up Replicate

### **Create Account:**
1. Go to **https://replicate.com/**
2. Click **"Sign up"** (top right)
3. Sign up with GitHub, Google, or email

### **Get API Token:**
1. Once logged in, click your **profile picture** (top right)
2. Select **"Account settings"**
3. Click **"API tokens"** in the left sidebar
4. Click **"Create token"**
5. Name it: `Infinite Scroll Project`
6. **Copy the token** - it looks like: `r8_abc123...`

### **Understanding Costs:**
- **Free Credits:** You get some free credits to start
- **Per Image:** ~$0.0023 per image
- **Budget Control:** Set spending limits in your account settings

---

## 🔧 Step 2: Set Up Google Gemini

### **Create API Key:**
1. Go to **https://makersuite.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API key"**
4. Select **"Create API key in new project"** (or choose existing)
5. **Copy the key** - it looks like: `AIza...`

### **Cost:** 
- **Free Tier:** 15 requests per minute (perfect for testing)
- **Very Cheap:** $0.0025 per 1K characters for paid usage

---

## 🔧 Step 3: Create Your .env File

1. **Navigate to your backend folder:**
   ```bash
   cd backend
   ```

2. **Create a new file called `.env`** (no extension)

3. **Copy the content from `env-template.txt`** and replace the placeholders:

```env
# Your actual API keys
REPLICATE_API_TOKEN=r8_your_actual_replicate_token_here
GEMINI_API_KEY=AIza_your_actual_gemini_key_here

# Server settings
PORT=3001
NODE_ENV=development

# Image settings
IMAGE_WIDTH=1920
IMAGE_HEIGHT=1080
GENERATION_TIMEOUT=30000
MAX_IMAGES_PER_MINUTE=10
```

---

## 🧪 Step 4: Test Your Setup

### **Test the Backend:**
```bash
cd backend
npm run dev
```

You should see:
```
✅ Backend server running on port 3001
✅ Environment: development
✅ Health check: http://localhost:3001/health
```

### **Test the API:**
Open a new terminal and run:
```bash
curl http://localhost:3001/health
```

You should see:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "port": 3001
}
```

### **Test Image Generation:**
```bash
curl -X POST http://localhost:3001/api/generate-next-image \
  -H "Content-Type: application/json" \
  -d '{}'
```

This should return a JSON response with an image URL.

---

## 🎮 Step 5: Run the Full App

### **Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

### **Terminal 2 - Frontend:**
```bash
# From main directory
npm run dev
```

### **Open in Browser:**
- **Frontend:** http://localhost:5173
- **Backend Health:** http://localhost:3001/health

---

## 🔍 Troubleshooting

### **Common Issues:**

1. **"Invalid API token" Error:**
   - Double-check your Replicate token
   - Make sure it starts with `r8_`
   - Verify it's correctly copied to `.env`

2. **"Gemini API key not found":**
   - Verify your Gemini key starts with `AIza`
   - Check if the Google AI service is enabled
   - Try creating a new API key

3. **"Generation timeout":**
   - Increase `GENERATION_TIMEOUT` in `.env`
   - Check your internet connection
   - Reduce image size for testing

4. **"Rate limit exceeded":**
   - You're generating images too fast
   - Increase `MAX_IMAGES_PER_MINUTE` setting
   - Wait a few minutes and try again

### **Debug Mode:**
Your app includes debug mode! When running in development, you'll see:
- **🎬** for initial images
- **📖** for continued story images
- The AI prompt overlay on each image

---

## 💡 Tips for Success

1. **Start Small:** Use smaller image sizes (1024x768) for testing
2. **Monitor Costs:** Check your Replicate dashboard regularly
3. **Test Gradually:** Generate one image at a time initially
4. **Keep Keys Safe:** Never commit your `.env` file to version control

---

## 🎨 Expected Experience

Once working, you should see:
1. **Initial Load:** A beautiful AI-generated scene appears
2. **Scroll Down:** Each new image seamlessly continues the story
3. **Narrative Flow:** The story evolves naturally through AI
4. **Smooth Performance:** No jank or loading delays

**Ready to create some magic?** 🪄 