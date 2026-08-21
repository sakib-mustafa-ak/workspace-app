#!/usr/bin/env node
/**
 * Generate VAPID keys for web push notifications
 * Run: npx tsx apps/api/scripts/generate-vapid-keys.ts
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('');
console.log('Add these to your .env file:');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:admin@yourdomain.com');