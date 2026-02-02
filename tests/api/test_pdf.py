import os

def test_upload_pdf(api_client, base_url, auth_headers):
    # Create a dummy PDF
    filename = "api-test.pdf"
    with open(filename, "wb") as f:
        f.write(b"%PDF-1.4 empty pdf content")
        
    try:
        files = {'file': (filename, open(filename, 'rb'), 'application/pdf')}
        response = api_client.post(
            f"{base_url}/api/v1/pdfs",
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 201
        data = response.json()["data"]
        assert data["filename"] == filename
        # Ensure we don't have the regression where it was nested
        assert "pdf" not in data or ("id" in data) # Flattened structure check
    finally:
        if os.path.exists(filename):
            os.remove(filename)

def test_get_pdfs_list(api_client, base_url, auth_headers):
    response = api_client.get(
        f"{base_url}/api/v1/pdfs",
        headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert "pdfs" in data
    assert isinstance(data["pdfs"], list)

def test_upload_invalid_file_type(api_client, base_url, auth_headers):
    filename = "test.txt"
    with open(filename, "w") as f:
        f.write("text content")
        
    try:
        files = {'file': (filename, open(filename, 'rb'), 'text/plain')}
        response = api_client.post(
            f"{base_url}/api/v1/pdfs",
            headers=auth_headers,
            files=files
        )
        # 400 Bad Request
        assert response.status_code == 400
    finally:
         if os.path.exists(filename):
            os.remove(filename)
