const KEY='pz-mobile-web-pair-v1';
export function mountWebLogin(root,{api,onComplete,onError}){
  let active=true,pending=null,timer=null,running=false;
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Google / web hesabıyla Yönetim girişi';
  const box=document.createElement('section');box.className='panel';box.hidden=true;box.setAttribute('aria-label','Web hesabıyla giriş');
  const passwordForm=root.querySelector('#live-login');
  root.insertBefore(button,passwordForm);root.insertBefore(box,passwordForm);
  button.style.marginBottom='20px';
  const resetUi=()=>{box.hidden=true;button.hidden=false;if(passwordForm)passwordForm.hidden=false;};
  const clear=()=>{pending=null;clearTimeout(timer);sessionStorage.removeItem(KEY);};
  function show(){
    button.hidden=true;box.hidden=false;if(passwordForm)passwordForm.hidden=true;box.replaceChildren();
    const title=document.createElement('h2');title.textContent='Web hesabınızla devam edin';
    const text=document.createElement('p');text.textContent='Aşağıdaki bağlantıda Google ile giriş yapın. Bu kodu web sayfasına yazıp bağlantıyı onaylayın; ardından uygulamaya geri dönün. Kod 10 dakika geçerlidir.';
    const code=document.createElement('strong');code.textContent=pending.code;code.style.cssText='display:block;font-size:32px;letter-spacing:6px;margin:16px 0';code.setAttribute('aria-label','Eşleştirme kodu');
    const link=document.createElement('a');link.textContent='Webde Google / hesap girişini aç';link.href=pending.url;link.className='primary';link.rel='noopener noreferrer';link.target=navigator.userAgent.includes('PZAndroid/')?'_self':'_blank';
    const status=document.createElement('p');status.dataset.pairStatus='';status.setAttribute('role','status');status.textContent='Webde onayınız bekleniyor…';
    const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Vazgeç';cancel.onclick=()=>{api('pairCancel').catch(()=>{});clear();resetUi();};
    box.append(title,text,code,link,status,cancel);
  }
  async function poll(){
    if(!active||!pending||running)return;
    clearTimeout(timer);
    if(Date.parse(pending.expiresAt)<=Date.now()){clear();resetUi();onError('Eşleştirme süresi doldu. Google / web girişini yeniden başlatın.');return;}
    const current=pending;running=true;
    try{
      const result=await api('pairPoll',{id:current.id,verifier:current.verifier});
      if(!active||pending!==current)return;
      if(result.status==='complete'){clear();await onComplete();return;}
      box.querySelector('[data-pair-status]').textContent='Webde onayınız bekleniyor…';
    }catch(e){
      if(!active||pending!==current)return;
      if(e.code?.startsWith('PAIR_')){clear();resetUi();onError(e.message);return;}
      box.querySelector('[data-pair-status]').textContent='Bağlantı bekleniyor. İnternet geldiğinde yeniden denenecek.';
    }finally{running=false;if(active&&pending)timer=setTimeout(poll,4000);}
  }
  button.onclick=async()=>{
    button.disabled=true;
    try{const data=await api('pairStart');if(!active)return;pending=data;sessionStorage.setItem(KEY,JSON.stringify(data));show();poll();}
    catch(e){clear();onError(e.message);}finally{button.disabled=false;}
  };
  try{
    const data=JSON.parse(sessionStorage.getItem(KEY)||'null');
    if(data&&/^[a-f0-9]{32}$/.test(data.id)&&/^[a-f0-9]{64}$/.test(data.verifier)&&/^\d{6}$/.test(data.code)&&data.url==='https://www.parcazinciri.com/yonetim?mobileConnect='+data.id&&Date.parse(data.expiresAt)>Date.now()){pending=data;show();poll();}
    else sessionStorage.removeItem(KEY);
  }catch{sessionStorage.removeItem(KEY);}
  const resume=()=>{if(!document.hidden)poll();};
  window.addEventListener('focus',resume);window.addEventListener('pz-session-visible',resume);document.addEventListener('visibilitychange',resume);
  return ()=>{active=false;clearTimeout(timer);api('pairCancel').catch(()=>{});window.removeEventListener('focus',resume);window.removeEventListener('pz-session-visible',resume);document.removeEventListener('visibilitychange',resume);};
}
