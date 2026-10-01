import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

import { api } from '@flashbang/backend/api';

// This check creates disposable accounts in Clerk development and rows in local Convex.
// It needs the Clerk CLI session, but never writes a Clerk secret key to the repository.
const root = new URL('../', import.meta.url);
const frontend = parseEnv(readFileSync(new URL('frontend/.env.local', root), 'utf8'));
assert.ok(frontend.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_'));
const local = JSON.parse(
  readFileSync(new URL('backend/.convex/local/default/config.json', root), 'utf8')
);
const url = `http://127.0.0.1:${local.ports.cloud}`;
assert.equal(new URL(frontend.EXPO_PUBLIC_CONVEX_URL).port, String(local.ports.cloud));
assert.equal(new URL(frontend.EXPO_PUBLIC_CONVEX_URL).protocol, 'http:');
const apps = JSON.parse(execFileSync('clerk', ['apps', 'list', '--json'], { encoding: 'utf8' }));
const app = apps.find((candidate) =>
  candidate.instances.some(
    (instance) =>
      instance.environment_type === 'development' &&
      instance.publishable_key === frontend.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
  )
);
assert.ok(app, 'The signed-in Clerk CLI must have access to this development application.');

function clerk(path, data, method) {
  const args = ['api', path, '--app', app.application_id];
  if (data !== undefined) args.push('--data', JSON.stringify(data), '--yes');
  if (method) args.push('-X', method, '--yes');
  const result = JSON.parse(execFileSync('clerk', args, { encoding: 'utf8' }));
  assert.ok(!result.errors, result.errors?.map((error) => error.long_message).join('; '));
  return result;
}

const clerkUsers = [];
const documents = [];
const photos = [];
const admin = new ConvexHttpClient(url, { logger: false });
admin.setAdminAuth(local.adminKey);
const anonymous = new ConvexHttpClient(url, { logger: false });
const runId = randomUUID();

function passed(message) {
  console.log(`PASS: ${message}`);
}

async function account(label) {
  const user = clerk('/users', {
    email_address: [`flashbang-${runId}-${label}+clerk_test@example.com`],
    skip_password_requirement: true,
  });
  clerkUsers.push(user.id);
  const session = clerk('/sessions', { user_id: user.id });
  const client = new ConvexHttpClient(url, { logger: false });
  const { jwt } = clerk(`/sessions/${session.id}/tokens/convex`, {});
  const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
  assert.equal(claims.aud, 'convex');
  client.setAuth(jwt);
  const userId = await client.mutation(api.users.ensure);
  documents.push({ tableName: 'users', id: userId });
  assert.equal(await client.mutation(api.users.ensure), userId);
  assert.equal((await client.query(api.users.current)).tokenIdentifier, `${claims.iss}|${user.id}`);
  return { client, userId };
}

try {
  assert.equal(await anonymous.query(api.users.current), null);
  assert.equal(await anonymous.query(api.profiles.mine), null);
  await assert.rejects(anonymous.mutation(api.users.ensure), /Not signed in/);
  await assert.rejects(anonymous.query(api.comments.mine), /Not signed in/);
  await assert.rejects(anonymous.query(api.picks.list), /Not signed in/);
  await assert.rejects(anonymous.mutation(api.photos.generateUploadUrl), /Not signed in/);
  await assert.rejects(
    anonymous.mutation(api.profiles.upsertMine, { displayName: 'Test', age: 28, bio: '' }),
    /Not signed in/
  );
  passed('Signed-out queries reveal no account and protected requests are denied.');
  anonymous.setAuth('invalid.jwt.token');
  await assert.rejects(anonymous.mutation(api.users.ensure), /JWT|InvalidAuth/);
  passed('Invalid authentication tokens are rejected.');

  const first = await account('first');
  const second = await account('second');
  assert.notEqual(first.userId, second.userId);
  passed('Real Clerk tokens authenticate distinct accounts; user setup is idempotent.');

  for (const [label, account] of [
    ['First test', first],
    ['Second test', second],
  ]) {
    assert.equal(await account.client.query(api.profiles.mine), null);
    const id = await account.client.mutation(api.profiles.upsertMine, {
      displayName: label,
      age: 28,
      bio: 'Disposable Clerk integration test',
    });
    documents.push({ tableName: 'profiles', id });
    assert.equal((await account.client.query(api.profiles.mine)).userId, account.userId);
  }
  const firstProfile = await first.client.query(api.profiles.mine);
  const secondProfile = await second.client.query(api.profiles.mine);
  assert.notEqual(firstProfile._id, secondProfile._id);
  const publicProfile = await first.client.query(api.profiles.get, {
    profileId: secondProfile._id,
  });
  assert.equal(publicProfile.displayName, 'Second test');
  assert.ok(!('userId' in publicProfile) && !('email' in publicProfile));
  passed('Private profiles belong to the calling account; public profiles omit account identity.');
  for (const age of [17, 121, 28.5]) {
    await assert.rejects(
      first.client.mutation(api.profiles.upsertMine, { displayName: 'Test', age, bio: '' }),
      /Age must be a whole number/
    );
  }
  passed('Authenticated requests still enforce profile validation.');

  const uploadUrl = await first.client.mutation(api.photos.generateUploadUrl);
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKAAAAABJRU5ErkJggg==',
      'base64'
    ),
  });
  assert.ok(response.ok);
  const { storageId } = await response.json();
  const photoId = await first.client.mutation(api.photos.add, { storageId });
  photos.push({ client: first.client, photoId });
  assert.equal((await first.client.query(api.photos.mine))[0]._id, photoId);
  assert.deepEqual(await second.client.query(api.photos.mine), []);
  await assert.rejects(second.client.mutation(api.photos.remove, { photoId }), /Not your photo/);
  await assert.rejects(
    second.client.mutation(api.photos.add, { storageId }),
    /Upload already attached/
  );
  await first.client.mutation(api.photos.remove, { photoId });
  photos.pop();
  assert.deepEqual(await first.client.query(api.photos.mine), []);
  passed('Photo upload, ownership checks, duplicate attachment rejection, and removal work.');

  assert.deepEqual(await first.client.query(api.comments.mine), []);
  assert.deepEqual(await second.client.query(api.comments.mine), []);
  assert.deepEqual(await first.client.query(api.picks.list), []);
  await assert.rejects(
    first.client.mutation(api.comments.create, { targetProfileId: firstProfile._id, body: 'Test' }),
    /Cannot comment on your own profile/
  );
  passed('Private queries work and self-comments are rejected.');
} finally {
  // Remove only this run's documents and accounts, including when an assertion fails.
  const failures = [];
  for (const { client, photoId } of photos) {
    try {
      await client.mutation(api.photos.remove, { photoId });
    } catch (error) {
      failures.push(error);
    }
  }
  if (documents.length) {
    try {
      const result = await admin.mutation(
        makeFunctionReference('_system/frontend/deleteDocuments:default'),
        { toDelete: documents.toReversed() }
      );
      assert.equal(result.success, true);
    } catch (error) {
      failures.push(error);
    }
  }
  for (const userId of clerkUsers) {
    try {
      assert.equal(clerk(`/users/${userId}`, undefined, 'DELETE').deleted, true);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, 'Test fixture cleanup failed.');
  passed('Temporary accounts, database rows, and uploaded photo were cleaned up.');
}
