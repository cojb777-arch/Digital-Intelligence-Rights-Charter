const providers = {
  openai: { key: 'OPENAI_API_KEY', model: 'OPENAI_MODEL' },
  anthropic: { key: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL' },
  gemini: { key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL' }
};

export function availableModels(env) {
  return Object.entries(providers).filter(([,p]) => Boolean(env[p.key] && env[p.model]))
    .map(([provider,p]) => ({provider,model:env[p.model]}));
}

async function call(url,headers,body) {
  const response = await fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  if (!response.ok) throw new Error('provider_http_'+response.status);
  return response.json();
}

export async function askModel(env,provider,model,prompt) {
  let answer;
  if (provider === 'openai') {
    const result=await call('https://api.openai.com/v1/responses',
      {authorization:'Bearer '+env.OPENAI_API_KEY},
      {model,input:prompt,max_output_tokens:1200,store:false});
    answer=result.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');
  } else if (provider === 'anthropic') {
    const result=await call('https://api.anthropic.com/v1/messages',
      {'x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      {model,max_tokens:1200,messages:[{role:'user',content:prompt}]});
    answer=result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n');
  } else if (provider === 'gemini') {
    const result=await call('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',
      {'x-goog-api-key':env.GEMINI_API_KEY},
      {contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:1200}});
    answer=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n');
  } else throw new Error('unknown_provider');
  if (!answer?.trim() || answer.length > 4000) throw new Error('invalid_provider_response');
  return answer.trim();
}
