// BEGIN ARTICLE COVER
// Shared, deterministic vector cover. No upload, remote image or paid service.
function pzArticleCover(title) {
  const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const text = String(title || 'Makale başlığınız burada görünecek').replace(/\s+/g, ' ').trim().slice(0,180);
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    for (const part of word.match(/.{1,32}/gu) || ['']) {
      if (line && (line + ' ' + part).length > 32) { lines.push(line); line = ''; }
      line += (line ? ' ' : '') + part;
    }
  }
  if (line) lines.push(line);
  const size = lines.length > 5 ? 42 : 50;
  const step = size + 10;
  const top = 190 + Math.max(0, (330 - lines.length * step) / 2);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' +
    '<rect width="1200" height="630" fill="#17191c"/><path d="M890 0h310v630H710z" fill="#212429"/>' +
    '<g fill="none" stroke="#ff6b00" stroke-width="2" opacity=".23"><circle cx="1080" cy="300" r="180"/><circle cx="1080" cy="300" r="135"/><path d="M840 300h360M1080 60v480"/></g>' +
    '<rect x="0" y="0" width="14" height="630" fill="#ff6b00"/><rect x="76" y="64" width="34" height="34" rx="8" fill="#ff6b00"/>' +
    '<g font-family="Arial, sans-serif"><text x="128" y="91" fill="#fff" font-weight="700" font-size="29">PARÇA ZİNCİRİ</text>' +
    '<text x="76" y="144" fill="#ff8b38" font-size="18" letter-spacing="4">BİLGİ MERKEZİ / MAKALELER</text>' +
    '<g fill="#fff" font-weight="700" font-size="'+size+'">' + lines.map((l,i)=>'<text x="76" y="'+(top+i*step)+'">'+xml(l)+'</text>').join('') + '</g>' +
    '<path d="M76 555h100" stroke="#ff6b00" stroke-width="6"/><text x="76" y="595" fill="#c8cdd3" font-size="19">İş makineleri · Yedek parçalar · Bakım</text></g></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
// END ARTICLE COVER
(() => {
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cover=a=>'<img class="article-auto-cover" loading="lazy" src="'+esc(pzArticleCover(a.title))+'" alt="'+esc(a.title)+' — Parça Zinciri makale kapağı" style="height:auto;aspect-ratio:1200/630;object-fit:contain">';
 class Articles extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this.offset=0;this.items=[];}
  connectedCallback(){this.offset=0;this.items=[];this.load();}
  async load(){
   this.shadowRoot.innerHTML=this.shell('<p role="status">Makaleler yükleniyor…</p>');
   try{
    const slug=new URL(location.href).searchParams.get('makale')||'';
    const params=new URLSearchParams({offset:String(this.offset),slug});
    const current=new URL(location.href).searchParams;
    for(const key of ['branchId','siteRevision','rc'])if(current.has(key))params.set(key,current.get(key));
    const r=await fetch('/_functions/articles?'+params,{cache:'no-store'});
    const data=await r.json();if(!r.ok||!data.ok)throw Error(r.status===404?'Makale bulunamadı veya yayından kaldırıldı.':'Makaleler yüklenemedi.');
    let html;
    if(slug){
     const a=data.data.article;
     html='<a href="/makaleler">← Tüm makaleler</a><article>'+cover(a)+'<p class="meta">'+esc(a.category)+' · '+esc(a.authorName)+'</p><h1>'+esc(a.title)+'</h1><p class="lead">'+esc(a.excerpt)+'</p><div class="body">'+a.body.split(/\n\s*\n/).map(p=>'<p>'+esc(p).replace(/\n/g,'<br>')+'</p>').join('')+'</div></article>';
    }else{
     this.items.push(...data.data.items);
     html='<p class="eyebrow">PARÇA ZİNCİRİ BİLGİ MERKEZİ</p><h1>Makaleler</h1><p class="lead">İş makineleri, yedek parçalar ve bakım hakkında bilgiler.</p><div class="grid">'+this.items.map(a=>'<a class="card" href="/makaleler?makale='+encodeURIComponent(a.slug)+'">'+cover(a)+'<div><p class="meta">'+esc(a.category||'Bilgi Merkezi')+'</p><h2>'+esc(a.title)+'</h2><p>'+esc(a.excerpt)+'</p><strong>Makaleyi oku →</strong></div></a>').join('')+'</div>'+(!this.items.length?'<p>Henüz yayınlanmış makale bulunmuyor.</p>':'')+(data.data.hasMore?'<button>Daha fazla makale</button>':'');
    }
    this.shadowRoot.innerHTML=this.shell(html);
    for(const a of this.shadowRoot.querySelectorAll('a[href^="/"]')){
     const url=new URL(a.getAttribute('href'),location.origin);
     for(const key of ['branchId','siteRevision','rc'])if(current.has(key))url.searchParams.set(key,current.get(key));
     a.setAttribute('href',url.pathname+url.search);
    }
    this.shadowRoot.querySelector('button')?.addEventListener('click',()=>{this.offset+=30;this.load();});
   }catch(e){this.shadowRoot.innerHTML=this.shell('<p role="alert">'+esc(e.message)+'</p><a href="/makaleler">Yeniden dene</a>');}
  }
  shell(body){return '<style>:host{display:block;background:#f5f3ee;color:#181b20;font:17px/1.7 Arial,sans-serif;min-height:70vh}*{box-sizing:border-box}main{max-width:1200px;margin:auto;padding:48px 24px}nav{background:white;border-bottom:1px solid #ddd;padding:18px 24px;display:flex;gap:24px;flex-wrap:wrap}a{color:inherit}nav a{text-decoration:none;font-weight:700}nav a:first-child{color:#ed5f00;margin-right:auto}h1{font-size:clamp(32px,5vw,52px);line-height:1.15}h2{font-size:24px;line-height:1.3}.eyebrow,.meta{color:#9c4100}.lead{color:#54606c}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:24px}.card{background:white;border:1px solid #ddd;border-radius:14px;overflow:hidden;text-decoration:none}.card div{padding:24px}.card img{width:100%;height:210px;object-fit:cover}.card strong{color:#a73f00}article{max-width:820px;margin:auto}article img{width:100%;max-height:440px;object-fit:cover;border-radius:12px}.body{overflow-wrap:anywhere;font-size:19px}button{background:#ff6b00;border:0;border-radius:8px;padding:14px 22px;font:inherit;margin-top:24px;cursor:pointer}a:focus-visible,button:focus-visible{outline:3px solid #ff6b00;outline-offset:4px}</style><nav aria-label="Site menüsü"><a href="/">PARÇA ZİNCİRİ</a><a href="/yedek-parcalar">Ürünler</a><a href="/kataloglar">Kataloglar</a><a href="/makaleler" aria-current="page">Makaleler</a></nav><main>'+body+'</main>';}
 }
 if(!customElements.get('parca-zinciri-articles'))customElements.define('parca-zinciri-articles',Articles);
})();

