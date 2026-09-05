// Actual transmitted bytes; never advance progress on a timer.
export function uploadFile(url, file, {method='PUT', headers={}, onProgress=()=>{}, timeoutMs=180000, createRequest=()=>new XMLHttpRequest()}={}) {
  return new Promise((resolve,reject)=>{
    const xhr=createRequest();
    xhr.open(method,url);xhr.timeout=timeoutMs;xhr.withCredentials=false;
    for(const [name,value] of Object.entries(headers))xhr.setRequestHeader(name,value);
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(e.loaded,e.total),e.total);};
    xhr.onload=()=>{
      if(xhr.status<200||xhr.status>=300){reject(new Error('Dosya yüklenemedi. Tekrar deneyin.'));return;}
      try{const result=JSON.parse(xhr.responseText);onProgress(file.size,file.size);resolve(result);}
      catch{reject(new Error('Dosya yükleme yanıtı okunamadı. Tekrar deneyin.'));}
    };
    xhr.onerror=()=>reject(new Error('Dosya yüklenirken bağlantı kesildi. Bağlantınızı kontrol edip tekrar gönderin.'));
    xhr.ontimeout=()=>reject(new Error('Dosya yüklemesi zaman aşımına uğradı. Bağlantınızı kontrol edip tekrar gönderin.'));
    xhr.onabort=()=>reject(new Error('Dosya yüklemesi durduruldu. Tekrar gönderebilirsiniz.'));
    xhr.send(file);
  });
}

export async function confirmUpload(confirm,{onWaiting=()=>{},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=12,maxWaitMs=90000,now=Date.now}={}) {
  const started=now();
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return await confirm();}
    catch(error){
      if(error.code!=='MEDIA_NOT_READY')throw error;
      if(attempt===attempts||now()-started>=maxWaitMs){const e=new Error('Dosya hâlâ işleniyor. Biraz sonra tekrar gönderin; yüklenen dosya yeniden kullanılacak.');e.code=error.code;throw e;}
      onWaiting(attempt);await wait(3000);
    }
  }
}

export function uploadPercent(loaded,total){return total>0?Math.min(90,Math.floor(Math.max(0,loaded)/total*90)):0;}
