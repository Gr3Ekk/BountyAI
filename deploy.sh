#!/bin/bash

# Firebase Deployment Script for BountyAI
# This script deploys the frontend to Firebase Hosting and backend to Cloud Run

set -e  # Exit on error

echo "🚀 BountyAI Firebase Deployment"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Firebase project is set
if [ ! -f ".firebaserc" ] || ! grep -q '"default"' .firebaserc; then
    echo -e "${YELLOW}⚠️  Firebase project not configured${NC}"
    echo "Please run: firebase use --add"
    echo "And select your Firebase project"
    exit 1
fi

PROJECT_ID=$(firebase use | grep "active" | awk '{print $4}' | tr -d '()')
echo -e "${BLUE}📦 Project: ${PROJECT_ID}${NC}"
echo ""

# Step 1: Build Frontend
echo -e "${BLUE}Step 1: Building Frontend...${NC}"
cd frontend
npm run build
cd ..
echo -e "${GREEN}✅ Frontend built successfully${NC}"
echo ""

# Step 2: Deploy Frontend to Firebase Hosting
echo -e "${BLUE}Step 2: Deploying Frontend to Firebase Hosting...${NC}"
firebase deploy --only hosting
HOSTING_URL="https://${PROJECT_ID}.web.app"
echo -e "${GREEN}✅ Frontend deployed to: ${HOSTING_URL}${NC}"
echo ""

# Step 3: Deploy Backend to Cloud Run
echo -e "${BLUE}Step 3: Deploying Backend to Cloud Run...${NC}"
echo "Building and deploying backend container..."

# Set region (you can change this)
REGION="us-central1"
SERVICE_NAME="bountyai-backend"

cd backend

# Deploy to Cloud Run
gcloud run deploy ${SERVICE_NAME} \
  --source . \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --project ${PROJECT_ID}

# Get the backend URL
BACKEND_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --format 'value(status.url)')

cd ..

echo -e "${GREEN}✅ Backend deployed to: ${BACKEND_URL}${NC}"
echo ""

# Step 4: Update Frontend Environment
echo -e "${BLUE}Step 4: Configure Frontend to use Backend URL${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Update your frontend environment variables${NC}"
echo ""
echo "Add this to your Firebase Hosting environment config:"
echo "VITE_API_URL=${BACKEND_URL}"
echo ""
echo "You can set this by:"
echo "1. Creating a .env.production file in frontend/"
echo "2. Or using Firebase Hosting environment config"
echo ""

# Summary
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Frontend: ${HOSTING_URL}"
echo "Backend: ${BACKEND_URL}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update frontend .env.production with: VITE_API_URL=${BACKEND_URL}"
echo "2. Rebuild and redeploy frontend if needed: cd frontend && npm run build && cd .. && firebase deploy --only hosting"
echo "3. Test your application at: ${HOSTING_URL}"
echo ""
