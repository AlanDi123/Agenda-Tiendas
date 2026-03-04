/**
 * Database Seed Script
 * Creates initial discount codes and default data
 */

import prisma from '../lib/prisma';

async function seed() {
  console.log('🌱 Seeding database...');

  // ============================================
  // MAJESTADALAN - SPECIAL LIFETIME CODE
  // ============================================
  await prisma.discountCode.upsert({
    where: { code: 'MAJESTADALAN' },
    update: {},
    create: {
      code: 'MAJESTADALAN',
      type: 'percentage',
      value: 100,
      currency: null,
      maxUses: null, // Unlimited
      perUserLimit: null, // Unlimited per user
      applicablePlans: JSON.stringify(['PREMIUM_LIFETIME']),
      expiresAt: null, // Never expires
      totalUsed: 0,
      active: true,
    },
  });

  console.log('✅ MAJESTADALAN code created');

  // ============================================
  // OTHER DISCOUNT CODES (examples)
  // ============================================
  
  // Welcome discount
  await prisma.discountCode.upsert({
    where: { code: 'BIENVENIDA10' },
    update: {},
    create: {
      code: 'BIENVENIDA10',
      type: 'percentage',
      value: 10,
      currency: null,
      maxUses: 1000,
      perUserLimit: 1,
      applicablePlans: JSON.stringify(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']),
      expiresAt: null,
      totalUsed: 0,
      active: true,
    },
  });

  console.log('✅ BIENVENIDA10 code created');

  // Black Friday example
  await prisma.discountCode.upsert({
    where: { code: 'BLACKFRIDAY50' },
    update: {},
    create: {
      code: 'BLACKFRIDAY50',
      type: 'percentage',
      value: 50,
      currency: null,
      maxUses: 500,
      perUserLimit: 1,
      applicablePlans: JSON.stringify(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY', 'PREMIUM_LIFETIME']),
      expiresAt: new Date('2024-11-30T23:59:59Z'),
      totalUsed: 0,
      active: true,
    },
  });

  console.log('✅ BLACKFRIDAY50 code created');

  // Fixed discount example
  await prisma.discountCode.upsert({
    where: { code: 'DESCUENTO20' },
    update: {},
    create: {
      code: 'DESCUENTO20',
      type: 'fixed',
      value: 20,
      currency: 'USD',
      maxUses: 200,
      perUserLimit: 2,
      applicablePlans: JSON.stringify(['PREMIUM_MONTHLY']),
      expiresAt: null,
      totalUsed: 0,
      active: true,
    },
  });

  console.log('✅ DESCUENTO20 code created');

  // ============================================
  // DEFAULT ADMIN USER (development only)
  // ============================================
  if (process.env.NODE_ENV === 'development') {
    const crypto = require('crypto');
    
    const adminPasswordHash = crypto
      .createHash('sha256')
      .update('admin123' + (process.env.PASSWORD_SALT || 'default-salt'))
      .digest('hex');

    await prisma.user.upsert({
      where: { email: 'admin@dommuss.com' },
      update: {},
      create: {
        email: 'admin@dommuss.com',
        passwordHash: adminPasswordHash,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        role: 'ADMIN',
        planType: 'PREMIUM_LIFETIME',
        planStatus: 'active',
      },
    });

    console.log('✅ Admin user created (admin@dommuss.com / admin123)');
  }

  console.log('🎉 Seeding completed!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
