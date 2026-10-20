/**
 * Creates (or promotes) an admin account without loading demo data.
 *
 *   npm run admin:create -- owner@mystore.com "Strong#Pass123" "Store Owner"
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { db, pool, schema } from './index';

async function main() {
  const [email, password, name = 'Store Admin'] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error('Usage: npm run admin:create -- <email> <password (8+ chars)> [name]');
    process.exitCode = 1;
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email.toLowerCase()) });
  if (existing) {
    await db.update(schema.users).set({ role: 'ADMIN', passwordHash, isBlocked: false }).where(eq(schema.users.id, existing.id));
    console.log(`✅ ${email} is now an admin (password updated)`);
  } else {
    await db.insert(schema.users).values({
      email: email.toLowerCase(),
      name,
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
      referralCode: customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8)(),
    });
    console.log(`✅ Admin ${email} created`);
  }
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
