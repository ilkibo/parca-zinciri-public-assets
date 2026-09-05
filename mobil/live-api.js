import {uploadFile,confirmUpload} from './upload.js';
import {createSessionClient} from './session.js';
const SITE='https://www.parcazinciri.com/_functions/';
async function request(body) {
  const response=await fetch(SITE+'mobileRpc',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(!response.ok||result.ok!==true){const e=new Error(result.error||'Wix işlemi tamamlanamadı.');e.status=response.status;e.code=result.code;e.field=result.field;throw e;}
  return result.data;
}
const session=createSessionClient({request,storage:{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)}});
const rpc=(method,payload)=>session.call(method,payload);
export const hasRememberedSession=()=>session.hasRememberedSession();
export async function liveApi(route,body) {
  if(route==='login')return session.login(body);
  if(route==='resetPassword')return request({method:'resetPassword',email:body.email});
  if(route==='logout')return session.logout();
  if(route==='products'&&body)return rpc('create',body);
  if(route==='products')return (await rpc('products',{})).items;
  if(route==='productPage')return rpc('products',body||{});
  if(route.startsWith('products/')){const parts=route.split('/');return rpc(parts[2]==='approve'?'approve':'product',{listingKey:parts[1]});}
  return rpc(route,body||{});
}
export async function liveUpload(media,onSaved,onProgress=()=>{}) {
  onProgress({phase:'preparing',loaded:media.upload?.fileId?media.file.size:0});
  let uploadUrl;
  if(!media.upload?.fileId){const started=await rpc('uploadStart',{name:media.file.name,mime:media.file.type,size:media.file.size});uploadUrl=started.uploadUrl;delete started.uploadUrl;media.upload=started;}
  if(!media.upload.fileId){
    const url=new URL(uploadUrl);
    if(url.protocol!=='https:'||!(url.hostname.endsWith('.wix.com')||url.hostname.endsWith('.wixapis.com')||url.hostname.endsWith('.wixmp.com')))throw new Error('Yükleme adresi doğrulanamadı.');
    url.searchParams.set('filename',media.upload.fileName);
    const result=await uploadFile(url,media.file,{headers:{'Content-Type':media.file.type},onProgress:(loaded,total)=>onProgress({phase:'uploading',loaded:total?loaded/total*media.file.size:0})});
    media.upload.fileId=result.file?.id||result.file?._id;
    if(!media.upload.fileId)throw new Error('Yüklenen dosyanın kimliği alınamadı.');
    // A signed upload URL is a temporary credential; don't retain it after upload.
    delete media.upload.uploadUrl;
    await onSaved();
  }
  onProgress({phase:'processing',loaded:media.file.size});
  return confirmUpload(()=>rpc('uploadConfirm',{ticketId:media.upload.ticketId,fileId:media.upload.fileId}),{onWaiting:()=>onProgress({phase:'processing',loaded:media.file.size})});
}
