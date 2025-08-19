#!/bin/bash

echo "🚀 Setting up Agendify Frontend..."
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install dependencies
echo "🔄 Installing dependencies..."
if npm install; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔄 Creating .env file..."
    cat > .env << EOF
# Frontend Environment Variables
VITE_API_URL=http://localhost:5000
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Frontend setup completed!"
echo ""
echo "Next steps:"
echo "1. Make sure the backend is running on http://localhost:5000"
echo "2. Run: npm run dev"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "To build the widget for production:"
echo "1. Run: npm run build:widget"
echo "2. The widget bundle will be in dist-widget/"
echo "3. Include the widget.js file in your website" 