#!/bin/bash

# Quick Firebase Setup Script
# This script helps you get started with Firebase deployment

set -e

echo "🔥 Firebase Setup for BountyAI"
echo "=============================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found"
    echo "Installing Firebase CLI..."
    npm install -g firebase-tools
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "⚠️  Google Cloud SDK not found"
    echo ""
    echo "Please install it first:"
    echo "  macOS: brew install --cask google-cloud-sdk"
    echo "  Or visit: https://cloud.google.com/sdk/docs/install"
    echo ""
    exit 1
fi

echo "✅ All tools installed"
echo ""

# Login to Firebase
echo "🔐 Logging in to Firebase..."
firebase login

# Login to Google Cloud
echo "🔐 Logging in to Google Cloud..."
gcloud auth login

# Select Firebase project
echo ""
echo "📦 Select your Firebase project:"
firebase use --add

# Get project ID
PROJECT_ID=$(firebase use | grep "Now using" | awk '{print $4}' || firebase use | grep "active" | awk '{print $4}' | tr -d '()')

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Could not determine project ID"
    echo "Please run: firebase use --add"
    exit 1
fi

echo ""
echo "Using project: $PROJECT_ID"
echo ""

# Update .firebaserc with actual project
cat > .firebaserc << EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF

echo "✅ Updated .firebaserc with project ID"
echo ""

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable run.googleapis.com --project=$PROJECT_ID
gcloud services enable containerregistry.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID

echo "✅ APIs enabled"
echo ""

# Create production env file
echo "📝 Creating environment file template..."
if [ ! -f "frontend/.env.production" ]; then
    cp frontend/.env.production.example frontend/.env.production
    echo "✅ Created frontend/.env.production"
    echo "⚠️  Please edit frontend/.env.production with your Firebase config"
else
    echo "⚠️  frontend/.env.production already exists, skipping..."
fi

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Edit frontend/.env.production with your Firebase configuration"
echo "2. Run: ./deploy.sh"
echo ""
echo "Or deploy manually:"
echo "  Frontend: cd frontend && npm run build && cd .. && firebase deploy --only hosting"
echo "  Backend: cd backend && gcloud run deploy bountyai-backend --source . --region us-central1 && cd .."
echo ""
