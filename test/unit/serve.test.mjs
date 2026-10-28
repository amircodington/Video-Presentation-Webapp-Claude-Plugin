import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { serveStatic } from '../../scripts/lib/serve.mjs';

function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'serve-'));
  const site = join(base, 'site');
  mkdirSync(site);
  writeFileSync(join(site, 'index.html'), '<h1>home</h1>');
  writeFileSync(join(site, 'app.css'), 'body{}');
  writeFileSync(join(base, 'secret.txt'), 'top secret');
  return site;
}

// Raw request so the path is sent as-is (fetch normalises "../").
function rawGet(url, path) {
  const { hostname, port } = new URL(url);
  return new Promise((ok, fail) => {
    request({ hostname, port, path }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => ok({ status: res.statusCode, body }));
    }).on('error', fail).end();
  });
}

test('serves index.html at / with html MIME type', async () => {
  const srv = await serveStatic(fixture());
  try {
    const res = await fetch(srv.url + '/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/html/);
    assert.equal(await res.text(), '<h1>home</h1>');
    const css = await fetch(srv.url + '/app.css');
    assert.match(css.headers.get('content-type'), /^text\/css/);
  } finally {
    await srv.close();
  }
});

test('returns 404 for missing files', async () => {
  const srv = await serveStatic(fixture());
  try {
    const res = await fetch(srv.url + '/nope.html');
    assert.equal(res.status, 404);
  } finally {
    await srv.close();
  }
});

test('refuses path traversal outside the directory', async () => {
  const srv = await serveStatic(fixture());
  try {
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt']) {
      const res = await rawGet(srv.url, p);
      assert.equal(res.status, 404, p);
      assert.doesNotMatch(res.body, /top secret/);
    }
  } finally {
    await srv.close();
  }
});
