#!/usr/bin/env node

/**
 * 🧪 API Setup Test Script
 * 
 * This script tests your Replicate and Gemini API keys
 * to ensure everything is configured correctly.
 */

require('dotenv').config({ path: './backend/.env' });

console.log('🧪 Testing Infinite Visual Story API Setup...\n');

// Check if environment variables are loaded
console.log('📋 Environment Variables:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`  PORT: ${process.env.PORT || 'not set'}`);
console.log(`  IMAGE_WIDTH: ${process.env.IMAGE_WIDTH || 'not set'}`);
console.log(`  IMAGE_HEIGHT: ${process.env.IMAGE_HEIGHT || 'not set'}`);
console.log(`  REPLICATE_API_TOKEN: ${process.env.REPLICATE_API_TOKEN ? '✅ Set' : '❌ Not set'}`);
console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  HUGGINGFACE_API_TOKEN: ${process.env.HUGGINGFACE_API_TOKEN ? '✅ Set (but not needed)' : '❌ Not set (but not needed)'}`);
console.log('');

// Test Replicate API
async function testReplicate() {
  console.log('🔮 Testing Replicate API...');
  
  if (!process.env.REPLICATE_API_TOKEN) {
    console.log('❌ REPLICATE_API_TOKEN not found in .env file');
    return false;
  }

  try {
    // Test with a simple model list (this doesn't cost anything)
    const response = await fetch('https://api.replicate.com/v1/models', {
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
    });

    if (response.ok) {
      console.log('✅ Replicate API token is valid');
      return true;
    } else {
      console.log('❌ Replicate API token is invalid');
      console.log(`   Status: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Error testing Replicate API:', error.message);
    return false;
  }
}

// Test Gemini API
async function testGemini() {
  console.log('🤖 Testing Google Gemini API...');
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY not found in .env file');
    return false;
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Test with a simple prompt
    const result = await model.generateContent("Hello, respond with just 'API working!'");
    const response = await result.response;
    const text = response.text();

    console.log('✅ Gemini API is working');
    console.log(`   Test response: "${text.trim()}"`);
    return true;
  } catch (error) {
    console.log('❌ Error testing Gemini API:', error.message);
    if (error.message.includes('API key')) {
      console.log('   Check your API key at: https://makersuite.google.com/app/apikey');
    }
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Running API tests...\n');
  
  const replicateOk = await testReplicate();
  console.log('');
  
  const geminiOk = await testGemini();
  console.log('');
  
  console.log('📊 Test Results:');
  console.log(`  Replicate API: ${replicateOk ? '✅ Working' : '❌ Failed'}`);
  console.log(`  Gemini API: ${geminiOk ? '✅ Working' : '❌ Failed'}`);
  console.log('');
  
  if (replicateOk && geminiOk) {
    console.log('🎉 All tests passed! Your setup is ready.');
    console.log('💡 You can now run: npm run dev (in backend) and npm run dev (in frontend)');
    console.log('');
    console.log('🔍 Note: HUGGINGFACE_API_TOKEN is not needed for this app.');
    console.log('   Your app only uses Replicate and Gemini APIs.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
    console.log('📖 See REPLICATE_SETUP.md for detailed setup instructions.');
  }
}

// Check if .env file exists
const fs = require('fs');
const path = require('path');

if (!fs.existsSync(path.join(__dirname, 'backend', '.env'))) {
  console.log('❌ .env file not found in backend/ directory');
  console.log('📝 Please create backend/.env with your API keys');
  console.log('📋 Copy the template from backend/env-template.txt');
  process.exit(1);
}

// Run the tests
runTests().catch(console.error); 