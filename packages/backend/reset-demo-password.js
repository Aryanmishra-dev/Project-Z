import argon2 from 'argon2';
import { eq } from 'drizzle-orm';

import { db } from './src/db/index.js';
import { users } from './src/db/schema.js';

const email = 'demo@test.com';
const password = 'Demo123456!';

console.log(`\nResetting password for ${email}...\n`);

try {
  // Hash the password
  const passwordHash = await argon2.hash(password);

  // Update in database
  await db.update(users).set({ passwordHash }).where(eq(users.email, email));

  console.log('✅ Password updated successfully!\n');
  console.log('📋 Demo Credentials:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}\n`);

  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
