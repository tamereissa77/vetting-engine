import os
import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
models_to_test = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]

print(f"Testing Gemini API Key: {GEMINI_API_KEY[:8]}...{GEMINI_API_KEY[-4:] if len(GEMINI_API_KEY) > 8 else ''}")

for model in models_to_test:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = {
        "contents": [
            {
                "parts": [
                    {
                        "text": "Hello, write a 3 word response."
                    }
                ]
            }
        ]
    }
    try:
        resp = requests.post(url, headers=headers, json=data, timeout=10)
        print(f"Model {model}: Status Code = {resp.status_code}")
        if resp.status_code == 200:
            print(f"  Response: {resp.json().get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '').strip()}")
        else:
            print(f"  Error Response: {resp.text}")
    except Exception as e:
        print(f"  Exception for {model}: {e}")
