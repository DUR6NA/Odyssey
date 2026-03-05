#!/bin/bash

# Check if npm or node is installed
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "Node.js and/or npm are not installed."
    
    # Check for Arch Linux package manager
    if command -v pacman &> /dev/null; then
        echo "Arch Linux detected. Installing nodejs and npm via pacman..."
        sudo pacman -S --needed nodejs npm
    else
        echo "Please install Node.js and npm manually."
        exit 1
    fi
fi

echo "Installing Odyssey dependencies..."
npm install
echo "Installation complete!"
