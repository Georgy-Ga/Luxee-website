import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from backend-spambot root (parent of core/)
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

class CONFIG:
    SKIP_SENDING_MESSAGE = os.getenv("SKIP_SENDING_MESSAGE", "false").lower() == "true"
    HIDDEN_BROWSER = os.getenv("HIDDEN_BROWSER", "True").lower() == "true"
    WAIT_MINUTES_BETWEEN_PROFILES = float(os.getenv("WAIT_MINUTES_BETWEEN_PROFILES", "0.5"))
