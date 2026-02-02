import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3000/api/v1';

async function runDemo() {
  console.log('🚀 Starting Demo User Test (Timeout: 300s)...');

  // 1. Register User
  const email = `demo_${Date.now()}@example.com`;
  const password = 'Password123!';
  console.log(`\n👤 Registering user: ${email}`);

  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName: 'Demo User' }),
  });

  if (!regRes.ok) {
    console.error('❌ Registration Failed:', await regRes.text());
    process.exit(1);
  }

  const regData = await regRes.json();
  const token = regData.data.tokens.accessToken;
  console.log('✅ Registration Successful.');

  // 2. Upload PDF
  console.log('\n📄 Uploading PDF...');
  const pdfPath = path.resolve(process.cwd(), 'e2e/fixtures/test-document.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.log('⚠️ Fixture not found, creating dummy PDF...');
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    fs.writeFileSync(
      pdfPath,
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\n0000000219 00000 n\n0000000305 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n400\n%%EOF'
    );
  }

  const fileBlob = new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', fileBlob, 'demo_test.pdf');

  const uploadRes = await fetch(`${API_URL}/pdfs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!uploadRes.ok) {
    console.error('❌ Upload Failed:', await uploadRes.text());
    process.exit(1);
  }

  const uploadData = await uploadRes.json();
  const pdfId = uploadData.data.id;
  console.log(`✅ Upload Successful. PDF ID: ${pdfId}`);

  // 3. Poll for Status
  console.log('\n⏳ Polling for completion...');
  let status = 'pending';
  let attempts = 0;

  while (
    ['pending', 'uploading', 'processing', 'extracting', 'generating'].includes(status) &&
    attempts < 300
  ) {
    attempts++;
    const pollRes = await fetch(`${API_URL}/pdfs/${pdfId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pollData = await pollRes.json();
    status = pollData.data.status;

    const debug = JSON.stringify(pollData.data).substring(0, 50);
    process.stdout.write(`\r[${attempts}/300] Status: ${status} | Data: ${debug}...   `);

    if (status === 'completed') break;
    if (status === 'failed') {
      console.log(`\n❌ Processing Failed: ${pollData.data.errorMessage}`);
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\n');

  if (status !== 'completed') {
    console.error('❌ Timeout waiting for processing.');
    process.exit(1);
  }

  console.log('✅ PDF Processing Completed!');

  // 4. Check Questions
  console.log('\n❓ Fetching Questions...');
  const qRes = await fetch(`${API_URL}/questions?pdfId=${pdfId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!qRes.ok) {
    console.error('❌ Fetch Questions Failed:', await qRes.text());
    process.exit(1);
  }

  const qData = await qRes.json();
  console.log(`✅ Retrieved ${qData.data.total} questions.`);

  // 5. Test the failing counts endpoint
  console.log('\n🔢 Testing /questions/counts endpoint...');
  const countRes = await fetch(`${API_URL}/questions/counts?pdfId=${pdfId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!countRes.ok) {
    console.error('❌ Count Endpoint Failed:', await countRes.text());
    process.exit(1);
  } else {
    console.log('✅ Count Endpoint Passed:', await countRes.json());
  }

  console.log('\n✨ DEMO TEST COMPLETED SUCCESSFULLY ✨');
}

runDemo().catch(console.error);
