#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# Define the path to the virtual environment's activate script
VENV_ACTIVATE="backend/venv/bin/activate"

# Check if the activate script exists
if [ ! -f "$VENV_ACTIVATE" ]; then
    echo "Error: Virtual environment not found at $VENV_ACTIVATE"
    echo "Please create it first."
    exit 1
fi

echo "Activating virtual environment..."
source "$VENV_ACTIVATE"

echo "Starting Pathfinder backend server on http://127.0.0.1:8000"
echo "Press CTRL+C to stop the server."

# Run the Uvicorn server
uvicorn backend.main:app --reload 