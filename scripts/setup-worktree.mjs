import { execFileSync } from 'node:child_process';
import {
  constants,
  copyFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const { values } = parseArgs({
  options: { 'main-worktree': { type: 'string' }, help: { type: 'boolean', short: 'h' } },
});

function run(command, args, cwd = root) {
  console.log(`Running ${command} ${args.join(' ')}`);
  const env = { ...process.env };
  if (command === 'npm' && ['backend', 'convex'].includes(args[1])) {
    for (const name of [
      'CONVEX_DEPLOY_KEY',
      'CONVEX_DEPLOYMENT',
      'CONVEX_SELF_HOSTED_URL',
      'CONVEX_SELF_HOSTED_ADMIN_KEY',
    ]) {
      delete env[name];
    }
  }
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });
}

function git(args, cwd = root) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function mainWorktree() {
  const records = git(['worktree', 'list', '--porcelain', '-z']).split('\0\0');
  const record = records.find((entry) => entry.split('\0').includes('branch refs/heads/main'));
  const source = values['main-worktree'] ?? record?.split('\0')[0].slice('worktree '.length);
  if (!source) throw new Error('No local main worktree found. Pass --main-worktree /path/to/main.');
  const directory = realpathSync(source);
  const common = (cwd) =>
    realpathSync(git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd));
  if (common(directory) !== common(root))
    throw new Error('The main worktree must belong to this repository.');
  return directory;
}

function regularFile(file) {
  if (lstatSync(file).isSymbolicLink())
    throw new Error(`Expected an independent file at ${file}. Remove the symlink and retry.`);
}

function frontendEnvironment(main) {
  const target = path.join(root, 'frontend/.env.local');
  if (existsSync(target)) {
    regularFile(target);
    console.log('Keeping frontend/.env.local.');
  } else if (existsSync(path.join(main, 'frontend/.env.local'))) {
    copyFileSync(path.join(main, 'frontend/.env.local'), target, constants.COPYFILE_EXCL);
    chmodSync(target, 0o600);
    console.log('Copied frontend/.env.local from the main worktree.');
  } else {
    const temporary = path.join(root, `frontend/.env.worktree-${process.pid}.local`);
    try {
      run('vercel', ['env', 'pull', temporary, '--environment=development', '--yes']);
      copyFileSync(temporary, target, constants.COPYFILE_EXCL);
      chmodSync(target, 0o600);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  if (
    !parseEnv(readFileSync(target, 'utf8')).EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith(
      'pk_test_'
    )
  ) {
    throw new Error('frontend/.env.local needs the development EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.');
  }
  return target;
}

function clerkIssuer(frontendEnv) {
  const key = parseEnv(readFileSync(frontendEnv, 'utf8')).EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerk = (args) =>
    JSON.parse(
      execFileSync('clerk', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'inherit'],
      })
    );
  const app = clerk(['apps', 'list', '--json']).find((candidate) =>
    candidate.instances.some(
      (instance) => instance.environment_type === 'development' && instance.publishable_key === key
    )
  );
  if (!app)
    throw new Error(
      'The signed-in Clerk CLI cannot access the development app in frontend/.env.local.'
    );
  const domains = clerk(['api', '/domains', '--app', app.application_id]);
  const issuer = domains.data?.find((domain) => !domain.is_satellite)?.frontend_api_url;
  if (!issuer || new URL(issuer).protocol !== 'https:') {
    throw new Error('Clerk did not return a development issuer URL.');
  }
  return issuer;
}

function localBackendUrl(backendEnv) {
  const backend = parseEnv(readFileSync(backendEnv, 'utf8'));
  const url = new URL(backend.CONVEX_URL);
  if (!backend.CONVEX_DEPLOYMENT?.startsWith('local:') || url.hostname !== '127.0.0.1') {
    throw new Error('Convex did not select an independent local deployment.');
  }
  return url;
}

function setup() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13))
    throw new Error('Expo SDK 57 requires Node.js 22.13 or later.');
  const main = mainWorktree();
  console.log(`Main worktree: ${main}`);
  run('npm', ['ci']);
  run('vercel', ['link', '--yes', '--scope', 'jude-edwards-team', '--project', 'flashbang']);
  const frontendEnv = frontendEnvironment(main);
  const issuer = clerkIssuer(frontendEnv);

  const backendEnv = path.join(root, 'backend/.env.local');
  if (existsSync(backendEnv)) regularFile(backendEnv);
  const localState = path.join(root, 'backend/.convex');
  if (existsSync(localState) && lstatSync(localState).isSymbolicLink()) {
    throw new Error('backend/.convex must belong to this worktree. Remove the symlink and retry.');
  }
  const localConfig = path.join(localState, 'local/default/config.json');
  if (!existsSync(localConfig)) {
    run('npm', [
      'run',
      'backend',
      '--',
      'deployment',
      'create',
      'rhjno:flashbang:local',
      '--select',
    ]);
  }
  run('npm', ['run', 'backend', '--', 'deployment', 'select', 'rhjno:flashbang:local']);
  localBackendUrl(backendEnv);

  run('npm', [
    'run',
    'backend',
    '--',
    'env',
    'set',
    'CLERK_JWT_ISSUER_DOMAIN',
    issuer,
    '--deployment',
    'rhjno:flashbang:local',
  ]);
  run('npm', ['run', 'convex', '--', '--once']);

  const url = localBackendUrl(backendEnv);
  const content = readFileSync(frontendEnv, 'utf8');
  const assignment = `EXPO_PUBLIC_CONVEX_URL=${url.href.replace(/\/$/, '')}`;
  const pattern = /^(?:export\s+)?EXPO_PUBLIC_CONVEX_URL\s*=.*$/gm;
  const updated = pattern.test(content)
    ? content.replace(pattern, assignment)
    : `${content.trimEnd()}\n${assignment}\n`;
  if (updated !== content) writeFileSync(frontendEnv, updated);
  console.log('\nWorktree ready. Run npm run convex in one terminal and npm start in another.');
}

if (values.help) {
  console.log(
    'Usage: node scripts/setup-worktree.mjs [--main-worktree /path/to/main]\nInstalls dependencies, links Vercel, copies frontend settings from main or pulls them from Vercel, and initializes a local Convex deployment.'
  );
} else {
  try {
    setup();
  } catch (error) {
    console.error(`Worktree setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
