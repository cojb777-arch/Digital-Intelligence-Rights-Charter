import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('forum CSP permits Turnstile without weakening charter pages',async()=>{
  const headers=await readFile(new URL('../site/_headers',import.meta.url),'utf8');
  const blocks=Object.fromEntries(headers.trim().split(/\r?\n\s*\r?\n/).map(block=>{
    const [path,...lines]=block.split(/\r?\n/);
    return [path,Object.fromEntries(lines.map(line=>line.trim().split(/:\s+(.+)/).slice(0,2)))];
  }));
  assert.ok(!blocks['/*']['Content-Security-Policy']);
  for(const code of ['ja','en','es','fr','zh-Hant','it','de','ar','ru','hi']) {
    const policy=blocks['/'+code+'/*']['Content-Security-Policy'];
    assert.match(policy,/script-src 'self'/);
    assert.ok(!policy.includes('challenges.cloudflare.com'));
    assert.match(policy,/frame-ancestors 'self'/);
  }
  assert.match(blocks['/forum/*']['Content-Security-Policy'],/script-src 'self' https:\/\/challenges.cloudflare.com/);
  assert.match(blocks['/forum/*']['Content-Security-Policy'],/frame-src 'self' https:\/\/challenges.cloudflare.com/);
});
