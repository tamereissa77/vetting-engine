import os
import requests
from dotenv import load_dotenv

load_dotenv()

OLLAMA_API_BASE = os.getenv("OLLAMA_API_BASE", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

print(f"Testing Ollama: Base={OLLAMA_API_BASE}, Model={OLLAMA_MODEL}")

url = f"{OLLAMA_API_BASE}/api/generate"
data = {
    "model": OLLAMA_MODEL,
    "prompt": "Hello, write a 3 word response.",
    "stream": False
}

try:
    resp = requests.post(url, json=data, timeout=30)
    print(f"Status Code = {resp.status_code}")
    if resp.status_code == 200:
        print(f"Response: {resp.json().get('response', '').strip()}")
    else:
        print(f"Error Response: {resp.text}")
except Exception as e:
    print(f"Exception: {e}")
