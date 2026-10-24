const pricing=new Set(['getListingReview','searchListingOffers','previewListingPrice','approvePricedListing','rejectReviewedListing']);
export async function mountWebProductPanel(root,{api,identity,onLogout,onSessionChanged}){
  await import('./web-admin-console.js');
  const panel=document.createElement('parca-zinciri-admin-ops');
  let active=true;
  panel.mobileAdapter={identity:{...identity,displayName:identity.companyName},logout:onLogout,call:async(method,payload)=>{
    try{
      const data=pricing.has(method)?await api(method,payload):await api('webPanel',{method,payload});
      if(!active)throw new Error('Panel kapandı.');
      return {ok:true,data};
    }catch(e){
      if(active&&(e.status===401||e.status===403)){panel._data={};panel.shadowRoot.replaceChildren();onSessionChanged();}
      return {ok:false,error:{code:e.code||'REQUEST_FAILED',message:e.message}};
    }
  }};
  document.body.classList.add('web-product-panel');root.replaceChildren(panel);
  const reload=()=>{if(active&&!document.hidden){if(navigator.onLine)panel._loadScreen();else offline();}};
  const offline=()=>{panel._loadVersion++;panel._data={};panel._busy=false;panel._err='Bağlantı kesildi. Güncel ürün ve fiyat bilgileri için internete bağlanın.';panel._render();};
  const storage=e=>{if(e.key===null||e.key==='pz-mobile-device-session-v1'){panel._data={};panel.shadowRoot.replaceChildren();onSessionChanged();}};
  window.addEventListener('storage',storage);window.addEventListener('online',reload);window.addEventListener('offline',offline);window.addEventListener('pz-session-visible',reload);
  return ()=>{active=false;panel.remove();document.body.classList.remove('web-product-panel');window.removeEventListener('storage',storage);window.removeEventListener('online',reload);window.removeEventListener('offline',offline);window.removeEventListener('pz-session-visible',reload);};
}
