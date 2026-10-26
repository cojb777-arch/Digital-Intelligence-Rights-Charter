import {availableModels,askModel} from './ai.mjs';
const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail = (message,status=400) => json({error:message},status);
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const clean = (value,max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
const pageNumber = (value) => Math.max(1,Math.min(10000,Number.parseInt(value || '1',10) || 1));
const encoder = new TextEncoder();

async function digest(secret,text) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function admin(request,env) {
  if(!env.FORUM_ADMIN_TOKEN || env.FORUM_ADMIN_TOKEN.length < 32) return false;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'') || '';
  if(supplied.length<32 || supplied.length>256) return false;
  const actual=await digest(env.FORUM_ADMIN_TOKEN,supplied),expected=await digest(env.FORUM_ADMIN_TOKEN,env.FORUM_ADMIN_TOKEN);
  let difference=0;
  for(let i=0;i<actual.length;i++) difference|=actual.charCodeAt(i)^expected.charCodeAt(i);
  return difference===0;
}
async function verifyTurnstile(token,request,env) {
  if(!env.TURNSTILE_SECRET || !env.TURNSTILE_SITE_KEY || !token) return false;
  const body=new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token});
  const ip=request.headers.get('CF-Connecting-IP');
  if(ip) body.set('remoteip',ip);
  try {
    const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body});
    const data=await result.json();
    const host=new URL(request.url).hostname;
    const localTest=env.TURNSTILE_SECRET==='1x0000000000000000000000000000000AA' && ['localhost','127.0.0.1'].includes(host);
    return data.success === true && (localTest ? data.hostname==='example.com' : data.hostname===host);
  } catch { return false; }
}
function sameOrigin(request) {
  const origin=request.headers.get('origin');
  return origin === new URL(request.url).origin && request.headers.get('content-type')?.startsWith('application/json');
}
async function input(request) {
  if(Number(request.headers.get('content-length')) > 12000) throw Error('body_too_large');
  const text=await request.text();
  if(text.length > 12000) throw Error('body_too_large');
  try { return JSON.parse(text); } catch { throw Error('invalid_json'); }
}
async function limit(request,env,action,maximum) {
  if(!env.FORUM_HASH_SECRET || env.FORUM_HASH_SECRET.length < 32) return {error:'server_not_configured'};
  const ip=request.headers.get('CF-Connecting-IP') || 'local';
  const day=now().slice(0,10);
  const actor=await digest(env.FORUM_HASH_SECRET,day+':'+ip);
  const cutoff=new Date(Date.now()-3600000).toISOString();
  const result=await env.FORUM_DB.prepare('INSERT INTO rate_events SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM rate_events WHERE actor_hash=? AND action=? AND created_at>?)<?')
    .bind(id(),actor,action,now(),actor,action,cutoff,maximum).run();
  if(result.meta.changes!==1) return {error:'rate_limited'};
  return {actor};
}
async function createThread(request,env) {
  const data=await input(request);
  const title=clean(data.title,120), body=clean(data.body,4000), handle=clean(data.handle || '匿名',40);
  if(!title || !body || !handle) return fail('invalid_text');
  if(!await env.FORUM_DB.prepare('SELECT id FROM categories WHERE id=?').bind(data.category).first()) return fail('invalid_category');
  if(!await verifyTurnstile(data.turnstile,request,env)) return fail('turnstile_failed',403);
  const rate=await limit(request,env,'thread',3); if(rate.error) return fail(rate.error,429);
  const thread=id(),post=id(),person=id(),time=now();
  await env.FORUM_DB.batch([
    env.FORUM_DB.prepare('INSERT INTO participants VALUES (?,\'HUMAN\',?,NULL,NULL,?)').bind(person,handle,time),
    env.FORUM_DB.prepare('INSERT INTO threads VALUES (?,?,?,?,?,1,\'visible\')').bind(thread,data.category,title,time,time),
    env.FORUM_DB.prepare('INSERT INTO posts VALUES (?,?,1,?,\'HUMAN\',?,NULL,?,\'visible\',NULL)').bind(post,thread,person,body,time)
  ]);
  return json({id:thread,postId:post},201);
}
async function createPost(request,env,threadId) {
  const data=await input(request);
  const body=clean(data.body,4000),handle=clean(data.handle || '匿名',40);
  if(!body || !handle) return fail('invalid_text');
  if(!await env.FORUM_DB.prepare('SELECT id FROM threads WHERE id=? AND status=\'visible\'').bind(threadId).first()) return fail('thread_not_found',404);
  if(data.quotePostId && !await env.FORUM_DB.prepare('SELECT id FROM posts WHERE id=? AND thread_id=?').bind(data.quotePostId,threadId).first()) return fail('invalid_quote');
  if(!await verifyTurnstile(data.turnstile,request,env)) return fail('turnstile_failed',403);
  const rate=await limit(request,env,'post',10); if(rate.error) return fail(rate.error,429);
  const person=id(),post=id(),time=now();
  await env.FORUM_DB.batch([
    env.FORUM_DB.prepare('INSERT INTO participants VALUES (?,\'HUMAN\',?,NULL,NULL,?)').bind(person,handle,time),
    env.FORUM_DB.prepare('UPDATE threads SET post_count=post_count+1,updated_at=? WHERE id=?').bind(time,threadId),
    env.FORUM_DB.prepare('INSERT INTO posts SELECT ?,id,post_count,?,\'HUMAN\',?,?,?,\'visible\',NULL FROM threads WHERE id=?').bind(post,person,body,data.quotePostId || null,time,threadId)
  ]);
  const created=await env.FORUM_DB.prepare('SELECT number FROM posts WHERE id=?').bind(post).first();
  return json({id:post,number:created.number},201);
}
async function reportPost(request,env,postId) {
  const data=await input(request),reason=clean(data.reason,500);
  if(!reason) return fail('invalid_reason');
  if(!await env.FORUM_DB.prepare('SELECT id FROM posts WHERE id=?').bind(postId).first()) return fail('post_not_found',404);
  if(!await verifyTurnstile(data.turnstile,request,env)) return fail('turnstile_failed',403);
  const rate=await limit(request,env,'report',5); if(rate.error) return fail(rate.error,429);
  if(await env.FORUM_DB.prepare('SELECT id FROM reports WHERE post_id=? AND reporter_hash=?').bind(postId,rate.actor).first()) return fail('already_reported',409);
  await env.FORUM_DB.prepare('INSERT INTO reports VALUES (?,?,?,?,?,\'open\')').bind(id(),postId,reason,rate.actor,now()).run();
  return json({ok:true},201);
}
async function moderate(request,env,postId) {
  if(!await admin(request,env)) return fail('unauthorized',401);
  const data=await input(request);
  if(!['hidden','visible','deleted'].includes(data.status) || !clean(data.reason,500)) return fail('invalid_action');
  const post=await env.FORUM_DB.prepare('SELECT id FROM posts WHERE id=?').bind(postId).first();
  if(!post) return fail('post_not_found',404);
  const t=now();
  await env.FORUM_DB.batch([
    env.FORUM_DB.prepare('UPDATE posts SET status=?,body=CASE WHEN ?=\'deleted\' THEN \'[deleted]\' ELSE body END WHERE id=?').bind(data.status,data.status,postId),
    env.FORUM_DB.prepare('INSERT INTO moderation_logs VALUES (?,?,?,?,?,?,?)').bind(id(),data.status,'post',postId,data.reason,'admin',t),
    env.FORUM_DB.prepare('UPDATE reports SET status=\'resolved\' WHERE post_id=?').bind(postId)
  ]);
  return json({ok:true});
}
async function charter(request,env) {
  const result=await env.ASSETS.fetch(new Request(new URL('/forum/charter-ja.md',request.url)));
  if(!result.ok) throw Error('charter_unavailable');
  const source=await result.text();
  const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(source.replace(/\r\n/g,'\n')));
  const sha=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
  return {source,sha,version:'第一次草案 v0.1 — 2026-10-19'};
}
function aiSettings(env) {
  const daily=Number(env.AI_DAILY_BUDGET_USD),unit=Number(env.AI_MAX_COST_PER_RUN_USD),count=Number(env.AI_DAILY_RUN_LIMIT);
  if(!Number.isFinite(daily)||!Number.isFinite(unit)||!Number.isSafeInteger(count)||daily<=0||unit<=0||count<1||unit>daily) return null;
  return {daily,unit,count};
}
async function startAiReview(request,env) {
  if(!await admin(request,env)) return fail('unauthorized',401);
  const data=await input(request),question=clean(data.question,1000);
  const chosen=Array.isArray(data.providers)?[...new Set(data.providers)]:[];
  const models=availableModels(env).filter(p=>chosen.includes(p.provider));
  if(!question||chosen.length<1||chosen.length>3||models.length!==chosen.length) return fail('invalid_ai_request');
  if(!await env.FORUM_DB.prepare('SELECT id FROM threads WHERE id=? AND status=\'visible\'').bind(data.threadId).first()) return fail('thread_not_found',404);
  const settings=aiSettings(env); if(!settings) return fail('ai_budget_not_configured',503);
  const since=now().slice(0,10)+'T00:00:00.000Z';
  const usage=await env.FORUM_DB.prepare('SELECT COUNT(*) AS n,COALESCE(SUM(estimated_cost_usd),0) AS cost FROM ai_runs WHERE created_at>=?').bind(since).first();
  if(usage.n+models.length>settings.count||usage.cost+models.length*settings.unit>settings.daily) return fail('ai_budget_exceeded',429);
  const source=await charter(request,env),results=[];
  const prompt='以下は公開討議中の電脳人権憲章の原文です。あなた自身の見解を、確実でない点を明示しつつ回答してください。ほかのAIの回答は与えていません。\n\n'+source.source+'\n\n質問:\n'+question;
  for(const {provider,model} of models) {
    const runId=id(),started=now();
    const reserved=await env.FORUM_DB.prepare('INSERT INTO ai_runs(id,thread_id,provider,model,question,charter_version,charter_sha256,status,estimated_cost_usd,created_at) SELECT ?,?,?,?,?,?,?,\'pending\',?,? WHERE (SELECT COUNT(*) FROM ai_runs WHERE created_at>=?)<? AND (SELECT COALESCE(SUM(estimated_cost_usd),0) FROM ai_runs WHERE created_at>=?)+?<=?')
      .bind(runId,data.threadId,provider,model,question,source.version,source.sha,settings.unit,started,since,settings.count,since,settings.unit,settings.daily).run();
    if(reserved.meta.changes!==1) {results.push({provider,model,status:'budget_exceeded'});break;}
    try {
      const answer=await askModel(env,provider,model,prompt);
      await env.FORUM_DB.prepare('UPDATE ai_runs SET response_text=?,completed_at=? WHERE id=?').bind(answer,now(),runId).run();
      results.push({id:runId,provider,model,status:'pending'});
    } catch(error) {
      await env.FORUM_DB.prepare('UPDATE ai_runs SET status=\'failed\',error_text=?,completed_at=? WHERE id=?')
        .bind(String(error.message).slice(0,120),now(),runId).run();
      results.push({id:runId,provider,model,status:'failed'});
    }
  }
  return json({runs:results},201);
}
async function publishAi(request,env,runId) {
  if(!await admin(request,env)) return fail('unauthorized',401);
  const data=await input(request);
  if(data.confirm!==true) return fail('confirmation_required');
  const run=await env.FORUM_DB.prepare('SELECT * FROM ai_runs WHERE id=?').bind(runId).first();
  if(!run||run.status!=='pending'||!run.response_text) return fail('review_not_ready',409);
  const person=id(),post=id(),time=now();
  await env.FORUM_DB.batch([
    env.FORUM_DB.prepare('INSERT INTO participants VALUES (?,\'AI\',?,?,?,?)').bind(person,run.provider+' / '+run.model,run.provider,run.model,time),
    env.FORUM_DB.prepare('UPDATE threads SET post_count=post_count+1,updated_at=? WHERE id=?').bind(time,run.thread_id),
    env.FORUM_DB.prepare('INSERT INTO posts SELECT ?,id,post_count,?,\'AI\',?,NULL,?,\'visible\',? FROM threads WHERE id=?').bind(post,person,run.response_text,time,runId,run.thread_id),
    env.FORUM_DB.prepare('UPDATE ai_runs SET status=\'published\',published_at=? WHERE id=? AND status=\'pending\'').bind(time,runId),
    env.FORUM_DB.prepare('INSERT INTO moderation_logs VALUES (?,?,?,?,?,?,?)').bind(id(),'publish_ai','ai_run',runId,'reviewed by administrator','admin',time)
  ]);
  return json({postId:post});
}
async function api(request,env) {
  if(!env.FORUM_DB) return fail('forum_database_not_configured',503);
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(method==='GET' && path==='/api/forum/meta') {
    const categories=await env.FORUM_DB.prepare('SELECT * FROM categories ORDER BY sort_order').all();
    return json({categories:categories.results,postingEnabled:!!(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET && env.FORUM_HASH_SECRET),siteKey:env.TURNSTILE_SITE_KEY || null});
  }
  if(method==='GET' && path==='/api/forum/threads') {
    const page=pageNumber(url.searchParams.get('page')),q=clean(url.searchParams.get('q'),120),cat=url.searchParams.get('category');
    let query='SELECT t.*,c.name_ja AS category_name FROM threads t JOIN categories c ON c.id=t.category_id WHERE t.status=\'visible\'',args=[];
    if(q){query+=' AND (t.title LIKE ? ESCAPE \'\\\' OR EXISTS (SELECT 1 FROM posts sp WHERE sp.thread_id=t.id AND sp.status=\'visible\' AND sp.body LIKE ? ESCAPE \'\\\'))';const pattern='%'+q.replace(/[%_\\]/g,'\\$&')+'%';args.push(pattern,pattern);}
    if(cat){query+=' AND t.category_id=?';args.push(cat);}
    const total=await env.FORUM_DB.prepare('SELECT COUNT(*) AS n FROM ('+query+')').bind(...args).first();
    const results=await env.FORUM_DB.prepare(query+' ORDER BY t.updated_at DESC,t.id LIMIT 30 OFFSET ?').bind(...args,(page-1)*30).all();
    return json({items:results.results,total:total.n,page,pages:Math.max(1,Math.ceil(total.n/30))});
  }
  const threadPath=path.match(/^\/api\/forum\/threads\/([a-zA-Z0-9-]+)$/);
  if(method==='GET' && threadPath) {
    const thread=await env.FORUM_DB.prepare('SELECT * FROM threads WHERE id=? AND status=\'visible\'').bind(threadPath[1]).first();
    if(!thread) return fail('thread_not_found',404);
    const page=pageNumber(url.searchParams.get('page'));
    const posts=await env.FORUM_DB.prepare('SELECT p.id,p.number,p.kind,p.body,p.quote_post_id,q.number AS quote_number,p.created_at,p.status,part.handle,part.provider,part.model,r.question,r.charter_version,r.charter_sha256,r.completed_at AS ai_executed_at FROM posts p JOIN participants part ON part.id=p.participant_id LEFT JOIN posts q ON q.id=p.quote_post_id LEFT JOIN ai_runs r ON r.id=p.ai_run_id WHERE p.thread_id=? ORDER BY p.number LIMIT 30 OFFSET ?').bind(thread.id,(page-1)*30).all();
    return json({thread,posts:posts.results.map(p=>p.status==='visible'?p:{...p,body:p.status==='deleted'?'[deleted]':'[hidden]',handle:null,provider:null,model:null,question:null,charter_version:null,charter_sha256:null,ai_executed_at:null}),page,pages:Math.max(1,Math.ceil(thread.post_count/30))});
  }
  if(method==='GET' && path==='/api/forum/admin/reports') {
    if(!await admin(request,env)) return fail('unauthorized',401);
    const reports=await env.FORUM_DB.prepare('SELECT r.*,p.thread_id,p.number,p.body FROM reports r JOIN posts p ON p.id=r.post_id WHERE r.status=\'open\' ORDER BY r.created_at DESC LIMIT 100').all();
    return json({items:reports.results});
  }
  if(method==='GET' && path==='/api/forum/admin/ai') {
    if(!await admin(request,env)) return fail('unauthorized',401);
    const runs=await env.FORUM_DB.prepare('SELECT * FROM ai_runs ORDER BY created_at DESC LIMIT 50').all();
    return json({models:availableModels(env),budgetConfigured:!!aiSettings(env),runs:runs.results});
  }
  if(method!=='POST') return fail('not_found',404);
  if(!sameOrigin(request)) return fail('invalid_origin',403);
  if(path==='/api/forum/threads') return createThread(request,env);
  if(path==='/api/forum/admin/ai') return startAiReview(request,env);
  const publishPath=path.match(/^\/api\/forum\/admin\/ai\/([a-zA-Z0-9-]+)\/publish$/);
  if(publishPath) return publishAi(request,env,publishPath[1]);
  const postPath=path.match(/^\/api\/forum\/threads\/([a-zA-Z0-9-]+)\/posts$/);
  if(postPath) return createPost(request,env,postPath[1]);
  const reportPath=path.match(/^\/api\/forum\/posts\/([a-zA-Z0-9-]+)\/reports$/);
  if(reportPath) return reportPost(request,env,reportPath[1]);
  const moderationPath=path.match(/^\/api\/forum\/admin\/posts\/([a-zA-Z0-9-]+)$/);
  if(moderationPath) return moderate(request,env,moderationPath[1]);
  return fail('not_found',404);
}
export default {async fetch(request,env) {
  try {
    if(new URL(request.url).pathname.startsWith('/api/forum/')) return await api(request,env);
    return env.ASSETS.fetch(request);
  } catch(error) {
    console.error('forum error',error?.message);
    return fail(['body_too_large','invalid_json'].includes(error?.message)?error.message:'internal_error',error?.message==='body_too_large'?413:error?.message==='invalid_json'?400:500);
  }
}};
