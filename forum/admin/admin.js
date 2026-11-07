const $=selector=>document.querySelector(selector);
const el=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
async function request(path,options={}) {
  const response=await fetch('/api/forum'+path,{credentials:'same-origin',...options});
  const data=await response.json();
  if(!response.ok) throw Error(data.error||'通信に失敗しました');
  return data;
}
const status=message=>$('#admin-status').textContent=message;
function button(label,callback) {
  const node=el('button',label);node.type='button';node.addEventListener('click',()=>callback().catch(error=>status(error.message)));
  return node;
}
async function loadReports() {
  const data=await request('/admin/reports');
  $('#reports').replaceChildren();
  for(const report of data.items) {
    const item=el('li',`${report.reason} — #${report.number} ${report.body}`);
    for(const state of ['hidden','visible','deleted']) item.append(button(state,async()=>{
      const reason=prompt('操作理由を入力してください');if(!reason)return;
      await request('/admin/posts/'+encodeURIComponent(report.post_id),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:state,reason})});
      item.remove();
    }));
    $('#reports').append(item);
  }
}
async function loadAi() {
  const data=await request('/admin/ai');
  $('#ai-models').replaceChildren(el('legend','モデル'));
  for(const model of data.models) {
    const label=el('label',`${model.provider} / ${model.model}`),checkbox=document.createElement('input');
    checkbox.type='checkbox';checkbox.name='provider';checkbox.value=model.provider;label.prepend(checkbox);$('#ai-models').append(label);
  }
  $('#ai-form button').disabled=!data.budgetConfigured||!data.models.length;
  $('#ai-runs').replaceChildren();
  for(const run of data.runs) {
    const item=el('li',`${run.provider} / ${run.model} — ${run.status}`);
    item.append(el('p',`実行: ${run.created_at} · 憲章: ${run.charter_version} · 質問: ${run.question}`));
    if(run.response_text)item.append(el('p',run.response_text));
    if(run.error_text)item.append(el('p',run.error_text));
    if(run.status==='pending'&&run.response_text)item.append(button('内容を確認して公開',async()=>{
      if(!confirm('この回答を公開しますか？'))return;
      await request('/admin/ai/'+encodeURIComponent(run.id)+'/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirm:true})});
      await loadAi();
    }));
    $('#ai-runs').append(item);
  }
}
$('#load-reports').addEventListener('click',()=>loadReports().catch(error=>status(error.message)));
$('#load-ai').addEventListener('click',()=>loadAi().catch(error=>status(error.message)));
$('#ai-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,button=form.querySelector('button');
  try {
    button.disabled=true;
    const providers=[...form.querySelectorAll('[name=provider]:checked')].map(node=>node.value);
    if(!providers.length) throw Error('モデルを選択してください');
    await request('/admin/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({threadId:$('#ai-thread').value,question:form.querySelector('[name=question]').value,providers})});
    await loadAi();
  } catch(error) {status(error.message);} finally {button.disabled=false;}
});
Promise.all([request('/threads'),loadAi()]).then(([threads])=>{
  for(const thread of threads.items){const option=el('option',thread.title);option.value=thread.id;$('#ai-thread').append(option);}
}).catch(error=>status(error.message));
