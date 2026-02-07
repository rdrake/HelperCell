#!/bin/bash

# Terminate all processes if one fails or the script is stopped
set -e

echo "Starting Flask Backend..."
# Run Flask in the background (&)
cd /helpercell/server
python -m flask run --host=0.0.0.0 --port=5000 &

echo "Starting JupyterLab..."
# Run Jupyter in the foreground so the container stays alive
cd ..
exec jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root --NotebookApp.token='' --NotebookApp.password=''