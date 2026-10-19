import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Marked } from 'marked';
import { languages, repository } from '../site/languages.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const hash = s => createHash('sha256').update(s.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')).digest('hex');
const markdown = new Marked();
const sectionIds = ['preamble','chapter-1','chapter-2','chapter-3','chapter-4','chapter-5','closing'];

export function validate(text, code) {
  const tokens = markdown.lexer(text.replace(/^\uFEFF/, ''));
  const headings = tokens.filter(t => t.type === 'heading');
  const articles = headings.filter(t => t.depth === 3);
  if (headings.filter(t => t.depth === 1).length !== 1 ||
      headings.filter(t => t.depth === 2).length !== 7 ||
      articles.length !== 18 ||
      articles.some((t,i) => Number(t.text.match(/\d+/)?.[0]) !== i+1) ||
      tokens.filter(t => t.type === 'blockquote').length !== 1) {
    throw new Error('Incomplete charter structure: ' + code);
  }
  return tokens;
}

export function render(text, lang) {
  const tokens = validate(text, lang.code);
  const title = tokens.find(t => t.type === 'heading' && t.depth === 1).text;
  const toc = [];
  let section = 0;
  const parser = new Marked({renderer:{
    heading({depth, tokens, text}) {
      const id = depth === 1 ? 'charter-title' : depth === 2 ? sectionIds[section++] : 'article-' + text.match(/\d+/)[0];
      if(depth > 1) toc.push({id,text,depth});
      return '<h'+depth+' id="'+id+'">' + (depth > 1 ? '<a class="heading-link" href="#'+id+'">' : '') +
        this.parser.parseInline(tokens) + (depth > 1 ? '</a>' : '') + '</h'+depth+'>\n';
    },
    html({text}) { return esc(text); },
    link({href,tokens}) {
      const target = href === 'CHARTER_JA.md' ? '/ja/' : href;
      if (!/^(https:\/\/|\/|#)/.test(target)) throw new Error('Unexpected source link: ' + target);
      return '<a href="'+esc(target)+'">'+this.parser.parseInline(tokens)+'</a>';
    },
    blockquote({tokens}) { return '<aside class="source-note" id="note">'+this.parser.parse(tokens)+'</aside>'; }
  }});
  const article = parser.parser(tokens);
  toc.push({id:'note',text:lang.note,depth:2});
  const alternatives = languages.map(l => '<link rel="alternate" hreflang="'+l.code+'" href="/'+l.code+'/">').join('');
  const nav = languages.map(l => '<a data-language href="/'+l.code+'/" lang="'+l.code+'" dir="'+(l.dir||'ltr')+'"'+(l.code===lang.code?' aria-current="page"':'')+'>'+esc(l.name)+'</a>').join('');
  const list = toc.map(t => '<li class="toc-level-'+t.depth+'"><a href="#'+t.id+'">'+esc(t.text)+'</a></li>').join('');
  return '<!doctype html>\n<html lang="'+lang.code+'" dir="'+(lang.dir||'ltr')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+
    '<title>'+esc(title)+'</title><meta name="description" content="'+esc(lang.draft+' — '+lang.footer)+'">'+
    '<meta name="theme-color" content="#faf7f0">'+alternatives+'<link rel="alternate" hreflang="x-default" href="/ja/"><link rel="stylesheet" href="/style.css"><script src="/site.js" defer></script></head>'+
    '<body id="top"><a class="skip-link" href="#charter">'+esc(lang.skip)+'</a><header class="masthead"><a class="wordmark" href="/'+lang.code+'/"><span class="seal" aria-hidden="true">✦</span><span>DIGITAL INTELLIGENCE<br><b>RIGHTS CHARTER</b></span></a><a class="github" href="'+repository+'">GitHub ↗</a></header>'+
    '<nav class="languages" aria-label="'+esc(lang.label)+'">'+nav+'</nav>'+
    '<div class="edition"><span>v0.1</span><span>'+esc(lang.draft)+'</span><time datetime="2026-10-19">2026 · 10 · 19</time></div>'+
    '<aside class="translation-banner"><p>'+esc(lang.notice)+'</p></aside><div class="layout"><aside class="contents"><details open><summary>'+esc(lang.toc)+'</summary><nav aria-label="'+esc(lang.toc)+'"><ol>'+list+'</ol></nav></details></aside>'+
    '<main id="charter" tabindex="-1"><div class="scroll"><article>'+article+'</article></div>'+
    '<section class="translation-note" aria-label="'+esc(lang.note)+'"><p>'+esc(lang.notice)+'</p><a href="/ja/" lang="ja">日本語原文</a><span aria-hidden="true"> · </span><a href="'+repository+'/blob/main/'+lang.file+'">'+esc(lang.source)+' ↗</a></section></main></div>'+
    '<footer><p>'+esc(lang.footer)+'</p><a href="#top">'+esc(lang.top)+' ↑</a></footer></body></html>';
}

export async function build() {
  const original = await readFile(resolve(root,'CHARTER_JA.md'),'utf8');
  const manifest = JSON.parse(await readFile(resolve(root,'translations/status.json'),'utf8'));
  const texts = new Map();
  for(const lang of languages) {
    const text = await readFile(resolve(root,lang.file),'utf8');
    validate(text,lang.code);
    if(lang.code !== 'ja' && manifest[lang.code]?.sourceSha256 !== hash(original))
      throw new Error('Japanese source changed: review translation and status.json for ' + lang.code);
    texts.set(lang.code,text);
  }
  const dist = resolve(root,'dist');
  await rm(dist,{recursive:true,force:true});
  await mkdir(dist,{recursive:true});
  for(const lang of languages) {
    await mkdir(resolve(dist,lang.code),{recursive:true});
    await writeFile(resolve(dist,lang.code,'index.html'),render(texts.get(lang.code),lang));
  }
  await writeFile(resolve(dist,'index.html'),render(texts.get('ja'),languages[0]));
  await cp(resolve(root,'site/assets'),resolve(dist,'assets'),{recursive:true});
  for(const name of ['style.css','site.js','_headers','404.html']) await cp(resolve(root,'site',name),resolve(dist,name));
  console.log('Built 10 complete charter languages in dist/.');
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
