import pytest
import requests
import os

BASE_URL = "http://localhost:3000"

@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({
        "Accept": "application/json"
    })
    return session

@pytest.fixture(scope="session")
def base_url():
    return BASE_URL

@pytest.fixture(scope="session")
def auth_token(api_client, base_url):
    """Register/Login a test user and return the token."""
    email = f"api-test-{os.urandom(4).hex()}@example.com"
    password = "Password123!"
    
    # Register
    reg_response = api_client.post(f"{base_url}/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "fullName": "API Test User"
    })
    
    # If already exists (unlikely with random), login
    if reg_response.status_code == 400:
       login_response = api_client.post(f"{base_url}/api/v1/auth/login", json={
           "email": email,
           "password": password
       })
       token = login_response.json()["data"]["accessToken"]
    else:
       # Assuming register returns token or we login after
       # Check response structure. Usually auto-login or explicit login needed.
       # Let's try explicit login to be proper.
       login_response = api_client.post(f"{base_url}/api/v1/auth/login", json={
           "email": email,
           "password": password
       })
       token = login_response.json()["data"]["tokens"]["accessToken"]
       
    return token

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
