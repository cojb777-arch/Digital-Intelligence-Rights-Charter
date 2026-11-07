import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../forum/worker/index.mjs';
import {accessIdentity} from '../forum/worker/access.mjs';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';

test('admin page and API fail closed without Access configuration',async()=>{
  const env={FORUM_DB:{},ASSETS:{fetch:()=>new Response('asset')}};
  for(const path of ['/forum/admin/','/forum/admin/index.html','/forum/%61dmin/']) {
    const page=await worker.fetch(new Request('https://example.com'+path),env);
    assert.equal(page.status,403,path);
  }
  const api=await worker.fetch(new Request('https://example.com/api/forum/admin/reports'),env);
  assert.equal(api.status,403);
});

test('public forum contains only a discreet admin link',async()=>{
  const html=await readFile(new URL('../forum/index.html',import.meta.url),'utf8');
  assert.match(html,/class="admin-scroll-edge" href="\/forum\/admin\/"/);
  assert.doesNotMatch(html,/id="admin-view"|id="admin-token"/);
  assert.doesNotMatch(html,/\?admin=1/);
});

test('translation requires an explicit enable flag and daily limit',async()=>{
  const env={FORUM_DB:{},AI:{run:()=>{throw Error('must stay disabled');}}};
  const response=await worker.fetch(new Request('https://example.com/api/forum/translations',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:'{}'}),env);
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'translation_disabled');
});

test('Access JWT requires valid signature, issuer, audience, and allowed email',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256');
  const jwk=await exportJWK(publicKey);jwk.kid='test';jwk.alg='RS256';
  const keys=createLocalJWKSet({keys:[jwk]});
  const issuer='https://example-team.cloudflareaccess.com';
  const env={CF_ACCESS_TEAM_DOMAIN:'example-team',CF_ACCESS_AUD:'forum-admin',ADMIN_EMAIL:'owner@example.com'};
  const token=async(email,audience='forum-admin',from=issuer)=>new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer(from).setAudience(audience).setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const request=jwt=>new Request('https://example.com/forum/admin/',{headers:{'Cf-Access-Jwt-Assertion':jwt}});
  assert.equal(await accessIdentity(request(await token('owner@example.com')),env,()=>keys),'owner@example.com');
  assert.equal(await accessIdentity(request(await token('other@example.com')),env,()=>keys),null);
  assert.equal(await accessIdentity(request(await token('owner@example.com','other-app')),env,()=>keys),null);
  assert.equal(await accessIdentity(request(await token('owner@example.com','forum-admin','https://other.cloudflareaccess.com')),env,()=>keys),null);
});
