// Safely grant platform-admin rights to an existing user.
// Usage: node scripts/create-admin.mjs you@example.com
// The user must already have signed up. No hard-coded passwords are used.

import { PrismaClient } from "@prisma/client";

const email = (process.argv[2] || process.env.PLATFORM_ADMIN_EMAIL || "").toLowerCase().trim();
if (!email) {
  console.error("Usage: node scripts/create-admin.mjs <email>");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}. Ask them to sign up first, then re-run.`);
    process.exit(1);
  }
  await db.user.update({ where: { id: user.id }, data: { isPlatformAdmin: true } });
  console.log(`✓ ${email} is now a platform administrator.`);
} finally {
  await db.$disconnect();
}
