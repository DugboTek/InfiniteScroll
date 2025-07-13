#!/bin/bash

# Infinite Visual Story - Dependency Installation Script

echo "🚀 Installing dependencies for Infinite Visual Story..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to v18 or higher."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Frontend dependencies installed successfully"
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install

if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed successfully"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

cd ..

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Environment file not found!"
    echo "📝 Please create a .env file in the backend/ directory with your API keys."
    echo "📖 See setup.md for detailed instructions."
    echo ""
    echo "Required environment variables:"
    echo "  - REPLICATE_API_TOKEN"
    echo "  - GEMINI_API_KEY"
    echo ""
fi

echo "🎉 Installation complete!"
echo ""
echo "🔧 Next steps:"
echo "  1. Set up your API keys in backend/.env"
echo "  2. Run the backend: cd backend && npm run dev"
echo "  3. Run the frontend: npm run dev"
echo "  4. Open http://localhost:5173 in your browser"
echo ""
echo "📚 For detailed setup instructions, see setup.md" 