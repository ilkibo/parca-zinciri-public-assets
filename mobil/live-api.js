const SITE='https://www.parcazinciri.com/_functions/';
let token='';
async function rpc(method,payload={}) {
  const body=method==='login'?{method,...payload}:{method,payload,portalAccessToken:token};
  const response=await fetch(SITE+'mobileRpc',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(!response.ok||result.ok!==true){const e=new Error(result.error||'Wix işlemi tamamlanamadı.');e.status=response.status;e.code=result.code;e.field=result.field;if(response.status===401)token='';throw e;}
  return result.data;
}
export async function liveApi(route,body) {
  if(route==='login'){const r=await rpc('login',body);token=r.portalAccessToken;return {ok:true};}
  if(!token){const e=new Error('Mevcut tedarikçi hesabınızla giriş yapın.');e.status=401;throw e;}
  if(route==='logout'){try{return await rpc('logout');}finally{token='';}}
  if(route==='products'&&body)return rpc('create',body);
  if(route==='products'){
    const items=[];let offset=0;
    do {const page=await rpc('products',{offset});items.push(...page.items);offset=page.nextOffset;}while(offset!==null);
    return items;
  }
  if(route.startsWith('products/')){const parts=route.split('/');return rpc(parts[2]==='approve'?'approve':'product',{listingKey:parts[1]});}
  return rpc(route,body||{});
}
export async function liveUpload(media,onSaved) {
  if(!media.upload?.fileId){media.upload=await rpc('uploadStart',{name:media.file.name,mime:media.file.type,size:media.file.size});}
  if(!media.upload.fileId){
    const url=new URL(media.upload.uploadUrl);
    if(url.protocol!=='https:'||!(url.hostname.endsWith('.wix.com')||url.hostname.endsWith('.wixapis.com')||url.hostname.endsWith('.wixmp.com')))throw new Error('Yükleme adresi doğrulanamadı.');
    url.searchParams.set('filename',media.upload.fileName);
    const res=await fetch(url,{method:'PUT',headers:{'Content-Type':media.file.type},body:media.file,credentials:'omit',signal:AbortSignal.timeout(180000)});
    if(!res.ok)throw new Error('Dosya yüklenemedi. Tekrar deneyin.');
    const result=await res.json();media.upload.fileId=result.file?.id||result.file?._id;
    if(!media.upload.fileId)throw new Error('Yüklenen dosyanın kimliği alınamadı.');
    // A signed upload URL is a temporary credential; don't retain it after upload.
    delete media.upload.uploadUrl;
    await onSaved();
  }
  return rpc('uploadConfirm',{ticketId:media.upload.ticketId,fileId:media.upload.fileId});
}
