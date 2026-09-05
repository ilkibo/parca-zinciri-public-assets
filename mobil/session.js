const KEY='pz-mobile-device-session-v1';
const unauthorized=()=>Object.assign(new Error('Oturumunuz sona erdi. Yeniden giriş yapın; cihaz taslaklarınız korunuyor.'),{status:401});
// Passwords and short-lived access tokens never enter persistent storage.
export function createSessionClient({request,storage,now=Date.now}){
  let access='',expires=0,refreshing=null,generation=0;
  function read(){
    try{const value=JSON.parse(storage.getItem(KEY)||'null');return value&&typeof value.refreshToken==='string'&&Number.isFinite(Date.parse(value.refreshExpiresAt))?value:null;}catch{return null;}
  }
  function clear(){access='';expires=0;generation++;storage.removeItem(KEY);}
  function accept(result){
    if(typeof result.portalAccessToken!=='string'||!result.portalAccessToken||!(Date.parse(result.expiresAt)>now()))throw unauthorized();
    access=result.portalAccessToken;expires=Date.parse(result.expiresAt);
  }
  async function renew(){
    if(refreshing)return refreshing;
    const version=generation;
    refreshing=(async()=>{
      const device=read();
      if(!device||Date.parse(device.refreshExpiresAt)<=now()){clear();throw unauthorized();}
      try{const result=await request({method:'refresh',refreshToken:device.refreshToken});if(version!==generation)throw unauthorized();accept(result);}
      catch(e){if(version===generation&&e.status===401)clear();throw e;}
    })().finally(()=>{refreshing=null;});
    return refreshing;
  }
  return {
    hasRememberedSession:()=>Boolean(read()),
    async login(payload){
      const result=await request({method:'login',...payload});
      if(!result.refreshToken||!(Date.parse(result.refreshExpiresAt)>now()))throw new Error('Kalıcı oturum oluşturulamadı. Yeniden deneyin.');
      generation++;accept(result);
      try{storage.setItem(KEY,JSON.stringify({refreshToken:result.refreshToken,refreshExpiresAt:result.refreshExpiresAt}));}
      catch{access='';expires=0;throw new Error('Oturum cihazda saklanamadı. Uygulama depolamasını kontrol edin.');}
      return {ok:true};
    },
    async call(method,payload={}){
      if(!access||expires<=now()+60000)await renew();
      const used=access,version=generation;
      try{return await request({method,payload,portalAccessToken:used});}
      catch(e){
        if(e.status!==401||version!==generation)throw e;
        // Retry only explicit unauthenticated responses, never uncertain writes.
        if(access===used){access='';expires=0;await renew();}
        return request({method,payload,portalAccessToken:access});
      }
    },
    async logout(){
      const device=read(),previous=access;
      clear(); // A connection failure must not keep this device signed in.
      if(device)try{await request({method:'deviceLogout',refreshToken:device.refreshToken,portalAccessToken:previous});}catch{/* device credentials already removed */}
      return {ok:true};
    }
  };
}
