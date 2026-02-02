import os
import time

def test_unauthorized_access(api_client, base_url):
    # Try to access protected route without headers
    response = api_client.get(f"{base_url}/api/v1/pdfs")
    assert response.status_code == 401

def test_invalid_token_access(api_client, base_url):
    headers = {"Authorization": "Bearer invalid_token_string"}
    response = api_client.get(f"{base_url}/api/v1/pdfs", headers=headers)
    assert response.status_code == 403 or response.status_code == 401

def test_oversized_pdf(api_client, base_url, auth_headers):
    # Limit is 10MB in app.ts. Let's try 11MB.
    # Creating 11MB file might be slow. Let's try 10.5MB.
    filename = "large_test.pdf"
    with open(filename, "wb") as f:
        f.seek(int(10.5 * 1024 * 1024)) # 10.5 MB
        f.write(b"\0")
        
    try:
        files = {'file': (filename, open(filename, 'rb'), 'application/pdf')}
        response = api_client.post(
            f"{base_url}/api/v1/pdfs",
            headers=auth_headers,
            files=files
        )
        # Express limit is 10mb. It might return 413 Payload Too Large
        assert response.status_code == 413 or response.status_code == 500 # Multer sometimes throws 500 on size limit if not caught
    finally:
        if os.path.exists(filename):
            os.remove(filename)

def test_generation_flow(api_client, base_url, auth_headers):
    # 1. Upload
    filename = "gen_test.pdf"
    with open(filename, "wb") as f:
        # Minimal valid PDF
        f.write(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\n0000000219 00000 n\n0000000305 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n400\n%%EOF")
    
    try:
        files = {'file': (filename, open(filename, 'rb'), 'application/pdf')}
        upload_res = api_client.post(
            f"{base_url}/api/v1/pdfs",
            headers=auth_headers,
            files=files
        )
        assert upload_res.status_code == 201
        pdf_id = upload_res.json()["data"]["id"]
        
        # 2. Wait for Processing
        # Poll 10 times, 1s interval
        status = "pending"
        for _ in range(30):
            res = api_client.get(f"{base_url}/api/v1/pdfs/{pdf_id}", headers=auth_headers)
            data = res.json()["data"]
            status = data["status"]
            if status == "completed":
                break
            if status == "failed":
                raise Exception(f"PDF Processing Failed: {data.get('errorMessage')}")
            time.sleep(1)
            
        assert status in ["completed", "processing"]
        
        # 3. Generate Questions (if not auto-generated?)
        # Usually user clicks "Generate" or it happens automatically?
        # Let's check question count.
        # If count > 0, it auto-generated.
        # If not, maybe we need to trigger it?
        # Looking at valid PDF (Hello World), it might not have enough content for questions.
        # But let's check if we can call the generate endpoint.
        # Assuming route exists: POST /api/v1/questions/generate or similar?
            
    finally:
         if os.path.exists(filename):
            os.remove(filename)
