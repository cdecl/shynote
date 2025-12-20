import json
import os

CONFIG_PATH = "config.json"

def load_config():
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(f"Config file not found at {CONFIG_PATH}")
    
    with open(CONFIG_PATH, 'r') as f:
        return json.load(f)

config = load_config()

GOOGLE_CLIENT_ID = config.get("GOOGLE_CLIENT_ID")
