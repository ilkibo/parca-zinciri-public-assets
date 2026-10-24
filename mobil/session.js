const KEY='pz-mobile-device-session-v1';
const unauthorized=()=>Object.assign(new Error('Oturumunuz sona erdi. Yeniden giriş yapın; cihaz taslaklarınız korunuyor.'),{status:401});
// Passwords and short-lived access tokens never enter persistent storage.
export function createSessionClient({request,storage,now=Date.now}){
  let access='',expires=0,refreshing=null,generation=0;
  let observedRefresh;
  function read(){
    try{const value=JSON.parse(storage.getItem(KEY)||'null');return value&&typeof value.refreshToken==='string'&&Number.isFinite(Date.parse(value.refreshExpiresAt))?value:null;}catch{return null;}
  }
  function clear(){access='';expires=0;generation++;refreshing=null;storage.removeItem(KEY);}
  function syncDevice(){
    const token=read()?.refreshToken||null;
    if(observedRefresh!==token){observedRefresh=token;access='';expires=0;generation++;refreshing=null;}
    return token;
  }
  function accept(result){
    if(typeof result.portalAccessToken!=='string'||!result.portalAccessToken||!(Date.parse(result.expiresAt)>now()))throw unauthorized();
    access=result.portalAccessToken;expires=Date.parse(result.expiresAt);
  }
  async function renew(){
    if(refreshing)return refreshing;
    const version=generation;
    const job=(async()=>{
      const device=read();
      if(!device||Date.parse(device.refreshExpiresAt)<=now()){clear();throw unauthorized();}
      try{const result=await request({method:'refresh',refreshToken:device.refreshToken});if(version!==generation||read()?.refreshToken!==device.refreshToken)throw unauthorized();accept(result);}
      catch(e){if(version===generation&&e.status===401&&read()?.refreshToken===device.refreshToken)clear();throw e;}
    })();
    refreshing=job;
    try{return await job;}finally{if(refreshing===job)refreshing=null;}
  }
  function saveLogin(result){
    if(!result.refreshToken||!(Date.parse(result.refreshExpiresAt)>now()))throw new Error('Kalıcı oturum oluşturulamadı. Yeniden deneyin.');
    generation++;refreshing=null;accept(result);
    try{storage.setItem(KEY,JSON.stringify({refreshToken:result.refreshToken,refreshExpiresAt:result.refreshExpiresAt}));observedRefresh=result.refreshToken;}
    catch{access='';expires=0;throw new Error('Oturum cihazda saklanamadı. Uygulama depolamasını kontrol edin.');}
    return {ok:true};
  }
  return {
    hasRememberedSession:()=>Boolean(read()),
    cancelPair(){generation++;},
    async login(payload){
      const result=await request({method:'login',...payload});
      return saveLogin(result);
    },
    async completePair(payload){
      const version=generation,previous=read()?.refreshToken;
      const result=await request({method:'pairPoll',payload});
      if(result.status==='complete'){
        if(version!==generation||read()?.refreshToken!==previous){await request({method:'deviceLogout',refreshToken:result.refreshToken}).catch(()=>{});throw unauthorized();}
        saveLogin(result);
      }
      return {status:result.status};
    },
    async call(method,payload={}){
      const deviceAtStart=syncDevice();
      if(!access||expires<=now()+60000)await renew();
      const used=access,version=generation;
      try{const result=await request({method,payload,portalAccessToken:used});if(version!==generation||read()?.refreshToken!==deviceAtStart)throw unauthorized();return result;}
      catch(e){
        if(read()?.refreshToken!==deviceAtStart){syncDevice();throw unauthorized();}
        if(e.status!==401||version!==generation)throw e;
        // Retry only explicit unauthenticated responses, never uncertain writes.
        if(access===used){access='';expires=0;await renew();}
        const retryVersion=generation;
        const result=await request({method,payload,portalAccessToken:access});
        if(retryVersion!==generation||read()?.refreshToken!==deviceAtStart)throw unauthorized();
        return result;
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
