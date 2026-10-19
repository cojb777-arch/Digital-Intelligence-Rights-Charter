import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, validate, render, hash, esc } from '../scripts/build.mjs';
import { languages } from '../site/languages.mjs';

const texts = new Map(await Promise.all(languages.map(async l => [l.code,await readFile(resolve(root,l.file),'utf8')])));
const originalTokens = validate(texts.get('ja'),'ja');

function paragraphsPerSection(tokens) {
  const result = {};
  let section = '';
  for(const token of tokens) {
    if(token.type === 'heading') section = token.depth + ':' + (token.depth === 3 ? token.text.match(/\d+/)[0] : Object.keys(result).length);
    if(token.type === 'heading') result[section] = 0;
    if(token.type === 'paragraph' && section) result[section]++;
  }
  // Intro metadata differs between existing JA/EN sources.
  return Object.entries(result).filter(([key]) => !key.startsWith('1:')).map(([,value]) => value);
}

for(const lang of languages) {
  test(lang.code + ': complete structure, paragraphs, navigation and original text', () => {
    const text = texts.get(lang.code);
    const tokens = validate(text,lang.code);
    assert.deepEqual(paragraphsPerSection(tokens), paragraphsPerSection(originalTokens));
    const html = render(text,lang);
    assert.match(html,new RegExp('<html lang="'+lang.code+'" dir="'+(lang.dir||'ltr')+'"'));
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length);
    for(const [,target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target),'missing anchor '+target);
    for(let n=1;n<=18;n++) assert.ok(ids.includes('article-'+n));
    for(const other of languages) assert.ok(html.includes('href="/'+other.code+'/"'));
    assert.ok(html.includes(lang.notice));
    assert.ok(html.includes('id="note"'));
    // Every plain paragraph is retained, including safeguards and closing text.
    for(const token of tokens.filter(t=>t.type==='paragraph' && !/[*\[\]]/.test(t.text))) {
      assert.ok(html.includes(esc(token.text)),'paragraph dropped: '+token.text);
    }
  });
}
test('reject missing or duplicated articles and missing note', () => {
  const text = texts.get('ja');
  assert.throws(()=>validate(text.replace('### 第18条','### 第17条'),'ja'));
  assert.throws(()=>validate(text.replace(/^> .*$/m,''),'ja'));
  assert.throws(()=>validate(text.replace('### 第18条','#### 第18条'),'ja'));
});
test('translation manifest tracks normalized Japanese source',async()=>{
  const manifest = JSON.parse(await readFile(resolve(root,'translations/status.json'),'utf8'));
  for(const lang of languages.filter(l=>l.code!=='ja')) {
    assert.equal(manifest[lang.code].sourceSha256,hash(texts.get('ja')));
    assert.notEqual(manifest[lang.code].sourceSha256,hash(texts.get('ja')+'\nchanged'));
    assert.equal(manifest[lang.code].expertReviewed,false);
  }
  assert.equal(hash(texts.get('ja')),hash(texts.get('ja').replace(/\r?\n/g,'\r\n')));
});
test('HTML embedded in source is escaped',()=>{
  const html=render(texts.get('ja')+'\n<script>alert(1)</script>\n',languages[0]);
  assert.ok(!html.includes('<script>alert'));
});
