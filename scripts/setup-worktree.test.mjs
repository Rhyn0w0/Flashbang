import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseEnv } from 'node:util';

function fixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'flashbang setup '));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const main = path.join(directory, 'main checkout');
  const worktree = path.join(directory, 'feature checkout');
  const bin = path.join(directory, 'bin');
  mkdirSync(path.join(main, 'scripts'), { recursive: true });
  mkdirSync(path.join(main, 'frontend'));
  mkdirSync(path.join(main, 'backend'));
  mkdirSync(bin);
  copyFileSync(
    new URL('./setup-worktree.mjs', import.meta.url),
    path.join(main, 'scripts/setup-worktree.mjs')
  );
  writeFileSync(path.join(main, 'frontend/.env.example'), '# template\n');
  writeFileSync(path.join(main, 'backend/.gitignore'), '.env.local\n.convex/\n');
  writeFileSync(path.join(main, '.gitignore'), '.env*\n!.env.example\n');
  const git = (args) => execFileSync('git', args, { cwd: main, stdio: 'pipe' });
  git(['init', '-b', 'main']);
  git(['add', '.']);
  git([
    '-c',
    'user.name=Setup test',
    '-c',
    'user.email=setup@example.com',
    'commit',
    '-m',
    'Fixture',
  ]);
  git(['worktree', 'add', '-b', 'feature', worktree]);

  const fakeCli = String.raw`#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const command = path.basename(process.argv[1]);
fs.appendFileSync('commands.jsonl', JSON.stringify({command,args}) + '\n');
if (command === 'vercel' && args[0] === 'env') {
  if (process.env.FAIL_PULL) process.exit(2);
  fs.writeFileSync(args[2], 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_from_vercel\nEXPO_PUBLIC_CONVEX_URL=https://cloud.convex.cloud\n');
}
if (command === 'npm' && args.includes('create')) {
  fs.mkdirSync('backend/.convex/local/default', {recursive:true});
  fs.writeFileSync('backend/.convex/local/default/config.json', '{"database":"independent"}');
}
if (command === 'npm' && args.includes('select')) {
  fs.writeFileSync('backend/.env.local', 'CONVEX_DEPLOYMENT=local:test\nCONVEX_URL=http://127.0.0.1:4321\n');
}
if (command === 'npm' && args.includes('--once')) {
  fs.writeFileSync('backend/.env.local', 'CONVEX_DEPLOYMENT=local:test\nCONVEX_URL=http://127.0.0.1:4323\n');
}
if (command === 'clerk' && args[0] === 'apps') {
  const key = fs.readFileSync('frontend/.env.local', 'utf8').match(/EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=(.*)/)[1];
  console.log(JSON.stringify([{application_id:'app_fixture', instances:[{environment_type:'development', publishable_key:key}]}]));
}
if (command === 'clerk' && args[0] === 'api') {
  console.log(JSON.stringify({data:[{is_satellite:false,frontend_api_url:'https://fixture.clerk.accounts.dev'}]}));
}
if (command === 'npm' && args.includes('CLERK_JWT_ISSUER_DOMAIN')) {
  fs.writeFileSync('backend/.convex/issuer.txt', args[args.indexOf('CLERK_JWT_ISSUER_DOMAIN') + 1]);
}
`;
  for (const command of ['npm', 'vercel', 'clerk']) {
    writeFileSync(path.join(bin, command), fakeCli, { mode: 0o755 });
  }
  const setup = (extraEnv = {}) =>
    spawnSync(process.execPath, ['scripts/setup-worktree.mjs'], {
      cwd: worktree,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, ...extraEnv },
      encoding: 'utf8',
    });
  const env = () => parseEnv(readFileSync(path.join(worktree, 'frontend/.env.local'), 'utf8'));
  const commands = () =>
    readFileSync(path.join(worktree, 'commands.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  return { main, worktree, setup, env, commands };
}

test('copies settings from main, uses an independent backend, and preserves edits on rerun', (t) => {
  const f = fixture(t);
  const source =
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_from_main\nEXPO_PUBLIC_CONVEX_URL=https://shared.convex.cloud\nCUSTOM_SETTING=main\n';
  writeFileSync(path.join(f.main, 'frontend/.env.local'), source);
  mkdirSync(path.join(f.main, 'backend/.convex/local/default'), { recursive: true });
  writeFileSync(
    path.join(f.main, 'backend/.convex/local/default/config.json'),
    '{"database":"main"}'
  );
  let result = f.setup();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.env(), {
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_from_main',
    EXPO_PUBLIC_CONVEX_URL: 'http://127.0.0.1:4323',
    CUSTOM_SETTING: 'main',
  });
  assert.equal(readFileSync(path.join(f.main, 'frontend/.env.local'), 'utf8'), source);
  assert.equal(
    readFileSync(path.join(f.worktree, 'backend/.convex/issuer.txt'), 'utf8'),
    'https://fixture.clerk.accounts.dev'
  );
  assert.equal(
    readFileSync(path.join(f.worktree, 'backend/.convex/local/default/config.json'), 'utf8'),
    '{"database":"independent"}'
  );
  const target = path.join(f.worktree, 'frontend/.env.local');
  writeFileSync(
    target,
    readFileSync(target, 'utf8').replace('CUSTOM_SETTING=main', 'CUSTOM_SETTING=edited')
  );
  result = f.setup();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.env().CUSTOM_SETTING, 'edited');
  assert.equal(f.commands().filter(({ args }) => args.includes('create')).length, 1);
  assert.equal(
    f.commands().filter(({ command, args }) => command === 'vercel' && args[0] === 'env').length,
    0
  );
});

test('pulls development settings when main has none, then sets the local backend URL', (t) => {
  const f = fixture(t);
  const result = f.setup();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.env(), {
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_from_vercel',
    EXPO_PUBLIC_CONVEX_URL: 'http://127.0.0.1:4323',
  });
});

test('a failed pull leaves no partial frontend configuration and succeeds on retry', (t) => {
  const f = fixture(t);
  const failed = f.setup({ FAIL_PULL: '1' });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /Worktree setup failed/);
  const retry = f.setup();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(f.env().EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, 'pk_test_from_vercel');
});

test('rejects a frontend env symlink instead of changing main settings', (t) => {
  const f = fixture(t);
  const source = path.join(f.main, 'frontend/.env.local');
  writeFileSync(source, 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_main\n');
  symlinkSync(source, path.join(f.worktree, 'frontend/.env.local'));
  const result = f.setup();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Remove the symlink/);
  assert.equal(readFileSync(source, 'utf8'), 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_main\n');
});
