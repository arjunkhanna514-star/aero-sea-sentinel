#!/usr/bin/env node
// src/db/hashPassword.js
// Usage: node src/db/hashPassword.js "MyPassword123!"
// Generates a bcrypt hash for manual user creation / password resets
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node src/db/hashPassword.js "<password>"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

bcrypt.hash(password, 12).then(hash => {
  console.log('\nPassword:', password);
  console.log('Hash:    ', hash);
  console.log('\nSQL:');
  console.log(`UPDATE users SET password_hash='${hash}' WHERE email='your@email.io';`);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
