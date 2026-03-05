#!/bin/bash

# Odyssey macOS Installation Script

echo "Checking for Node.js and npm..."

# Check if npm or node is installed
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "Node.js and/or npm are not installed."
    
    # Check if Homebrew is installed
    if command -v brew &> /dev/null; then
        echo "Homebrew detected. Installing Node.js..."
        brew install node
    else
        echo "Homebrew is not installed. Using Homebrew is recommended on macOS."
        echo "Please install Node.js from https://nodejs.org/ if you don't want to use Homebrew."
        exit 1
    fi
fi

echo "Installing Odyssey dependencies..."
npm install
echo "Installation complete!"
