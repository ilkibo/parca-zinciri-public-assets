export const MAX_VIDEO_SECONDS=10;
export function validateVideoDuration(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)throw new Error('Videonun süresi okunamadı. Süresi okunabilen bir MP4, MOV veya WebM seçin.');
  if(seconds>MAX_VIDEO_SECONDS)throw new Error('Video en fazla 10 saniye olabilir. Bu videoyu kısaltın veya yeniden çekin.');
  return seconds;
}
export function readVideoDuration(file){
  return new Promise((resolve,reject)=>{
    const video=document.createElement('video'),url=URL.createObjectURL(file);
    const timer=setTimeout(()=>finish(new Error('Videonun süresi okunamadı. Daha kısa bir video seçip tekrar deneyin.')),15000);
    function finish(error,duration){clearTimeout(timer);video.onloadedmetadata=null;video.onerror=null;video.removeAttribute('src');video.load();URL.revokeObjectURL(url);error?reject(error):resolve(duration);}
    video.preload='metadata';
    video.onloadedmetadata=()=>{try{finish(null,validateVideoDuration(video.duration));}catch(e){finish(e);}};
    video.onerror=()=>finish(new Error('Video okunamadı. En fazla 10 saniyelik MP4, MOV veya WebM seçin.'));
    video.src=url;
  });
}
