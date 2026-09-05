// Stop before ten seconds to leave room for container/encoder rounding.
export async function recordVideo(){
  if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw Error('Bu cihazda uygulama içi kamera desteklenmiyor. Video seç/çek düğmesini kullanın; 10 saniye sınırı yine kontrol edilir.');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:true});
  const dialog=document.createElement('dialog');dialog.innerHTML='<h2>Video çek · En fazla 10 saniye</h2><video autoplay muted playsinline style="width:100%;max-height:50vh"></video><p role="status">Hazır</p><button data-start>Kaydı başlat</button><button data-stop disabled>Bitir</button><button data-cancel>Vazgeç</button>';
  document.body.append(dialog);dialog.showModal();dialog.querySelector('video').srcObject=stream;
  return new Promise((resolve,reject)=>{
    let recorder,timer,tick,started,cancelled=false,settled=false;const chunks=[];
    const cleanup=()=>{clearTimeout(timer);clearInterval(tick);stream.getTracks().forEach(t=>t.stop());dialog.remove();};
    const finish=(file,error)=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(file);};
    const stop=()=>{if(recorder?.state==='recording')recorder.stop();};
    const cancel=()=>{cancelled=true;stop();finish(null);};
    dialog.oncancel=e=>{e.preventDefault();cancel();};dialog.querySelector('[data-cancel]').onclick=cancel;
    dialog.querySelector('[data-stop]').onclick=stop;
    dialog.querySelector('[data-start]').onclick=()=>{
      try{
        const mime=['video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
        recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.onerror=()=>finish(null,Error('Kayıt tamamlanamadı. Kamera iznini kontrol edin.'));
        recorder.onstop=()=>{if(cancelled)return;const type=recorder.mimeType.split(';')[0];finish(new File(chunks,'parca-video.'+(type==='video/mp4'?'mp4':'webm'),{type}));};
        recorder.start();started=Date.now();dialog.querySelector('[data-start]').disabled=true;dialog.querySelector('[data-stop]').disabled=false;
        tick=setInterval(()=>{dialog.querySelector('[role="status"]').textContent=Math.min(10,Math.ceil((Date.now()-started)/1000))+' / 10 saniye';},200);timer=setTimeout(stop,9500);
      }catch(e){finish(null,e);}
    };
  });
}
