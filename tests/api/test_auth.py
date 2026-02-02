def test_health_check(api_client, base_url):
    response = api_client.get(f"{base_url}/api/v1/health")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "healthy"

def test_register_duplicate_email(api_client, base_url, auth_token):
    # Try to register with an email that (likely/hopefully) exists from auth_token fixture
    # Actually, auth_token fixture creates a user. We don't know the email easily unless we export it.
    # Let's just create a collision manually.
    email = "collision@example.com"
    password = "Password123!"
    
    # 1. Register
    api_client.post(f"{base_url}/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "fullName": "Collision User"
    })
    
    # 2. Register again
    response = api_client.post(f"{base_url}/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "fullName": "Collision User 2"
    })
    
    # Expect 400 or 409
    assert response.status_code in [400, 409]

def test_login_invalid_credentials(api_client, base_url):
    response = api_client.post(f"{base_url}/api/v1/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "WrongPassword123!"
    })
    assert response.status_code == 401
