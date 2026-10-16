import assert from 'node:assert/strict';
import test from 'node:test';
import { isHttpLoopback, isLocalHttpDemo, localDemoMediaOrigin } from '../src/lib/security/transport-policy.mjs';
import { contentSecurityPolicy } from '../src/lib/security/content-security-policy.ts';

test('transport exemption is limited to literal HTTP loopback origins', () => {
  for (const value of ['http://localhost:4000/es', 'http://127.0.0.1:3100/en', 'http://[::1]:4000/pt']) assert.equal(isHttpLoopback(value), true);
  for (const value of ['https://localhost:4000', 'https://peruwonderstours.com', 'http://peruwonderstours.com', 'http://localhost.evil', 'http://localhost@evil.test', 'http://user@localhost', 'http://192.168.1.1', 'broken']) assert.equal(isHttpLoopback(value), false, value);
});
test('compiled static header exemption requires explicit local demo configuration', () => {
  assert.equal(isLocalHttpDemo('1', 'http://localhost:4000'), true);
  for (const [flag, base] of [[undefined, 'http://localhost:4000'], ['0', 'http://localhost:4000'], ['1', undefined], ['1', 'https://peruwonderstours.com'], ['1', 'https://localhost:4000'], ['1', 'http://localhost.evil']]) assert.equal(isLocalHttpDemo(flag, base), false);
});
test('HTTP demo keeps production nonce and application protections without forcing TLS', () => {
  const local = contentSecurityPolicy('test-nonce', false, false);
  assert.doesNotMatch(local, /upgrade-insecure-requests|unsafe-eval|ws:|wss:/);
  for (const directive of ["script-src 'self' 'nonce-test-nonce' 'strict-dynamic'", "style-src-elem 'self' 'nonce-test-nonce'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'", "img-src 'self' data: blob:"]) assert.ok(local.includes(directive), directive);
  const production = contentSecurityPolicy('test-nonce', false, true);
  assert.equal(production, `${local}; upgrade-insecure-requests`);
  assert.match(contentSecurityPolicy(null, false, false), /script-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(contentSecurityPolicy(null, false, false), /unsafe-eval/);
});

test('direct demo images allow only the explicitly configured local API media origin', () => {
  assert.equal(localDemoMediaOrigin('1', 'http://localhost:4000', 'http://127.0.0.1:4002/media', 'http://localhost:3001/api/v1'), 'http://127.0.0.1:4002');
  assert.equal(localDemoMediaOrigin('1', 'http://localhost:4000', undefined, 'http://localhost:4002/api/v1'), 'http://localhost:4002');
  for (const [flag, web, media] of [[undefined, 'http://localhost:4000', 'http://localhost:4002/media'], ['1', 'https://peruwonderstours.com', 'http://localhost:4002/media'], ['1', 'http://localhost:4000', 'http://localhost.evil/media'], ['1', 'http://localhost:4000', 'http://user@localhost:4002/media'], ['1', 'http://localhost:4000', 'https://andeanperutours.com/media']]) assert.equal(localDemoMediaOrigin(flag, web, media, undefined), null);
  const csp = contentSecurityPolicy(null, false, false, localDemoMediaOrigin('1', 'http://localhost:4000', 'http://localhost:4002/media', undefined));
  assert.ok(csp.includes("img-src 'self' data: blob: http://localhost:4002;"));
  assert.doesNotMatch(csp, /unsafe-eval|upgrade-insecure-requests|andeanperutours/);
});

test('compiled headers retain public HSTS and omit it only for explicit HTTP local demos', async () => {
  const names = ['NODE_ENV', 'PWT_DEMO_BUILD', 'PUBLIC_WEB_BASE_URL'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = 'production';
    for (const [flag, base, expected] of [['1', 'http://localhost:4000', false], ['1', 'https://peruwonderstours.com', true], ['0', 'http://localhost:4000', true], ['1', 'http://localhost.evil', true]]) {
      process.env.PWT_DEMO_BUILD = flag;
      process.env.PUBLIC_WEB_BASE_URL = base;
      const { default: config } = await import(`../next.config.mjs?transport-test=${encodeURIComponent(flag + base)}`);
      assert.equal(config.images.unoptimized, !expected, 'Only an explicit loopback demo bypasses conversion');
      const rules = await config.headers();
      const common = rules.find(rule => rule.source === '/:path*');
      assert.equal(common.headers.some(header => header.key === 'Strict-Transport-Security'), expected, `${flag} ${base}`);
      assert.equal(common.headers.find(header => header.key === 'X-Content-Type-Options').value, 'nosniff');
    }
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
