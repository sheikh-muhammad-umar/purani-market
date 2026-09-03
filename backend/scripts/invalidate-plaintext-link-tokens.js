/**
 * One-off cleanup for the change that stopped storing email-link tokens in
 * plaintext.
 *
 * Password-reset, email-verification and email-change tokens are now persisted
 * as a SHA-256 digest and looked up by digest. Rows written before that change
 * hold the raw token, so they can no longer be matched — a user clicking an old
 * link gets "verification failed" rather than anything dangerous.
 *
 * Two reasons to run this rather than leave them:
 *   1. Those rows are the plaintext secrets the change exists to remove. They sit
 *      there until their TTL fires (30 minutes for a reset, 24 hours for the
 *      others), and any backup taken meanwhile keeps them far longer.
 *   2. Deleting them makes the failure honest: `resendVerification` and
 *      `forgotPassword` both clear outstanding rows before issuing a new one, so
 *      users simply request another link.
 *
 * Safe to run more than once. Only unused, link-type rows are touched; OTP rows
 * were already hashed with bcrypt and are left alone.
 *
 * Usage:
 *   node scripts/invalidate-plaintext-link-tokens.js            # report only
 *   node scripts/invalidate-plaintext-link-tokens.js --apply    # delete them
 */
const { MongoClient } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace';

/**
 * Types whose value arrives in a URL, and so is now stored as a digest.
 *
 * These are the stored enum values, which are lowercase — the TypeScript member
 * names are not what lands in Mongo.
 */
const LINK_TOKEN_TYPES = ['email', 'password_reset'];

/** A hex SHA-256 digest is exactly 64 hex characters. */
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

async function run() {
  const apply = process.argv.includes('--apply');
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  const candidates = await db
    .collection('verification_tokens')
    .find({ type: { $in: LINK_TOKEN_TYPES }, used: false })
    .project({ _id: 1, token: 1, type: 1, expiresAt: 1 })
    .toArray();

  // The old tokens were also 32 random bytes rendered as hex, i.e. 64 hex
  // characters — identical in shape to the digest that replaced them. Age is
  // what separates them, so anything written before the deploy is treated as
  // plaintext. Deleting a digest row by mistake costs the user one more click.
  const plaintext = candidates.filter(
    (row) => !DIGEST_PATTERN.test(String(row.token ?? '')),
  );

  console.log(`Mongo:                       ${MONGO_URI}`);
  console.log(`Unused link tokens:          ${candidates.length}`);
  console.log(`Not digest-shaped:           ${plaintext.length}`);

  const pendingEmailChanges = await db
    .collection('users')
    .countDocuments({ 'pendingEmailChange.verificationToken': { $exists: true } });
  console.log(`Users with a pending email change: ${pendingEmailChanges}`);

  if (!apply) {
    console.log(
      '\nReport only. Re-run with --apply to delete the rows above and clear' +
        '\npending email changes. Affected users request a new link.',
    );
    await client.close();
    return;
  }

  if (candidates.length > 0) {
    const result = await db
      .collection('verification_tokens')
      .deleteMany({ type: { $in: LINK_TOKEN_TYPES }, used: false });
    console.log(`\nDeleted ${result.deletedCount} outstanding link tokens`);
  }

  if (pendingEmailChanges > 0) {
    const result = await db
      .collection('users')
      .updateMany(
        { 'pendingEmailChange.verificationToken': { $exists: true } },
        { $unset: { pendingEmailChange: '' } },
      );
    console.log(`Cleared ${result.modifiedCount} pending email changes`);
  }

  console.log('\nDone. Users with an outstanding link should request a new one.');
  await client.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
