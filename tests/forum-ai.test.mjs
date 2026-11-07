import test from 'node:test';
import assert from 'node:assert/strict';
import {askModel,availableModels} from '../forum/worker/ai.mjs';

test('only configured AI models are available',()=>{
  assert.deepEqual(availableModels({OPENAI_API_KEY:'secret',OPENAI_MODEL:'test-openai'}),[{provider:'openai',model:'test-openai'}]);
  assert.deepEqual(availableModels({}),[]);
});

test('adapters send one independent prompt and parse each provider response',async()=>{
  const original=globalThis.fetch,calls=[];
  const responses=[
    {output:[{content:[{type:'output_text',text:'OpenAI answer'}]}]},
    {content:[{type:'text',text:'Anthropic answer'}]},
    {candidates:[{content:{parts:[{text:'Gemini answer'}]}}]}
  ];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,headers:options.headers,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>responses[calls.length-1]};
  };
  try {
    const env={OPENAI_API_KEY:'a',ANTHROPIC_API_KEY:'b',GEMINI_API_KEY:'c'};
    assert.equal(await askModel(env,'openai','openai-test','same question'),'OpenAI answer');
    assert.equal(await askModel(env,'anthropic','anthropic-test','same question'),'Anthropic answer');
    assert.equal(await askModel(env,'gemini','gemini-test','same question'),'Gemini answer');
    assert.equal(calls.length,3);
    assert.equal(calls[0].body.input,'same question');
    assert.equal(calls[1].body.messages[0].content,'same question');
    assert.equal(calls[2].body.contents[0].parts[0].text,'same question');
    assert.equal(calls[0].body.store,false);
    assert.ok(calls.every(c=>c.body.max_output_tokens===1200||c.body.max_tokens===1200||c.body.generationConfig?.maxOutputTokens===1200));
  } finally {globalThis.fetch=original;}
});

test('empty provider answer is rejected',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>({ok:true,json:async()=>({output:[]})});
  try {await assert.rejects(askModel({OPENAI_API_KEY:'a'},'openai','test','prompt'),/invalid_provider_response/);}
  finally {globalThis.fetch=original;}
});
