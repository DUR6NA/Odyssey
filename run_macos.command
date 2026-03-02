#!/bin/bash

# Odyssey macOS Run Script (.command version for double-clicking)

# Ensure we are in the script's directory
cd "$(dirname "$0")"

# Clear the console
clear

echo "======================================================"
echo "          Starting Odyssey (JSON Adventure)           "
echo "======================================================"
echo ""
echo "  The web interface will be available at:"
echo "  http://localhost:3001"
echo ""
echo "  (Press Ctrl+C to stop the server)"
echo "======================================================"
echo ""

# Run the server
npm start
