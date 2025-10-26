#!/bin/bash

# Fast Google Cloud SDK Installation Script
# This downloads the pre-built binary instead of compiling from source

echo "🚀 Installing Google Cloud SDK (fast method)"
echo "=============================================="
echo ""

# Download pre-built Google Cloud SDK
cd ~
curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-arm.tar.gz

# Extract it
tar -xf google-cloud-cli-darwin-arm.tar.gz

# Install it
./google-cloud-sdk/install.sh --quiet

# Add to PATH
echo ""
echo "✅ Installation complete!"
echo ""
echo "Run this to activate gcloud in your current terminal:"
echo "  source ~/google-cloud-sdk/path.bash.inc"
echo ""
echo "Or restart your terminal and it will be available"
echo ""

# Clean up
rm google-cloud-cli-darwin-arm.tar.gz

echo "Next steps:"
echo "1. source ~/google-cloud-sdk/path.bash.inc"
echo "2. cd /Users/luispenson/Desktop/BountyAi"
echo "3. ./setup-firebase.sh"
