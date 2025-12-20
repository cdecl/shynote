import sys
import os

# Add the project root directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.main import app

# Vercel looks for 'app' or 'handler'. Aliasing for clarity.
handler = app
