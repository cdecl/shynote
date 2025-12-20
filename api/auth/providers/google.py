from google.oauth2 import id_token
from google.auth.transport import requests
from fastapi import HTTPException

from ...config import GOOGLE_CLIENT_ID

def verify_google_token(token: str) -> dict:
    try:
        # Specify the CLIENT_ID of the app that accesses the backend:
        # Specify the CLIENT_ID of the app that accesses the backend:
        # Allow 10 seconds of clock skew to prevent "Token used too early" errors
        id_info = id_token.verify_oauth2_token(token, requests.Request(), GOOGLE_CLIENT_ID, clock_skew_in_seconds=10)

        # Or, if multiple clients access the backend:
        # id_info = id_token.verify_oauth2_token(token, requests.Request())
        # if id_info['aud'] not in [CLIENT_ID_1, CLIENT_ID_2]:
        #     raise ValueError('Could not verify audience.')

        if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Wrong issuer.')

        # ID token is valid. Get the user's Google Account ID and email
        return {
            "provider_id": id_info['sub'],
            "email": id_info['email']
        }
    except ValueError as e:
        print(f"DEBUG: Validation Error: {e}")
        print(f"DEBUG: Backend Expected Client ID: {GOOGLE_CLIENT_ID}")
        raise HTTPException(status_code=400, detail=f"Invalid Google Token: {str(e)}")
