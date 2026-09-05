const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=id=>'pz-read-notices:'+id.memberId;
function seen(id){try{return new Set(JSON.parse(localStorage.getItem(key(id))||'[]'));}catch{return new Set();}}
function mark(id,items){const values=seen(id);items.forEach(n=>values.add(n.id));try{localStorage.setItem(key(id),JSON.stringify([...values].slice(-500)));}catch{}}
export async function checkNotifications(api,identity){
  const page=await api('notifications',{}),read=seen(identity),count=page.items.filter(n=>!read.has(n.id)).length;
  const badge=document.querySelector('#notification-count');if(badge)badge.textContent=count?'('+count+')':'';
  return page;
}
export async function mountNotifications(root,{api,identity,onOpen}){
  root.innerHTML='<h1>Bildirimler</h1><p class="help">Ürün onayları, düzenleme istekleri ve ret gerekçeleri burada görünür. Uygulama açıkken otomatik kontrol edilir.</p><div data-notices></div><button class="secondary" data-more hidden>Daha fazla</button>';
  let offset=0;const target=root.querySelector('[data-notices]'),more=root.querySelector('[data-more]');
  async function load(){more.disabled=true;try{const page=await api('notifications',{offset});if(!root.contains(target))return;
    const read=seen(identity);for(const n of page.items){const card=document.createElement('button');card.className='panel';card.style.cssText='display:block;width:100%;text-align:left;margin-bottom:12px';card.innerHTML='<strong>'+esc(n.title)+(read.has(n.id)?'':' · Yeni')+'</strong><p>'+esc(n.message)+'</p><small>'+esc(new Date(n.createdAt).toLocaleString('tr-TR'))+'</small>';card.onclick=()=>onOpen(n.listingKey);target.append(card);}
    if(!target.children.length)target.textContent='Henüz bildirim yok.';mark(identity,page.items);const badge=document.querySelector('#notification-count');if(badge)badge.textContent='';offset=page.nextOffset;more.hidden=offset===null;
  }catch(e){target.textContent=e.message;more.hidden=false;more.textContent='Tekrar dene';}finally{more.disabled=false;}}
  more.onclick=load;await load();
}
