import assert from 'node:assert/strict';
import test from 'node:test';

import { redirectSystemPath } from '../src/app/+native-intent.ts';

test('Clerk callbacks open Discover on cold starts and in an open app', () => {
  for (const initial of [true, false]) {
    for (const path of [
      'app.flashbang://callback?created_session_id=session_123&state=nonce',
      'clerk://app.flashbang.hosted-callback?created_session_id=session_123&state=nonce',
      'exp://127.0.0.1:8081/--/hosted-auth-callback?state=nonce',
      'flashbang:///hosted-auth-callback?state=nonce',
    ]) {
      assert.equal(redirectSystemPath({ path, initial }), '/');
    }
  }
});

test('ordinary app links keep their route and query parameters', () => {
  for (const path of ['/me', '/picks?source=link', 'flashbang://me', 'flashbang:///picks']) {
    assert.equal(redirectSystemPath({ path, initial: false }), path);
  }
});

test('a malformed incoming URL opens Discover without crashing', () => {
  assert.equal(redirectSystemPath({ path: 'https://[invalid', initial: true }), '/');
});
