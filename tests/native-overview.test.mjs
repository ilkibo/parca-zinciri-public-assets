import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

// Isolated local fixture only. No real user browser, credentials or production writes.
const {chromium}=createRequire(import.meta.url)('playwright');
const source=readFileSync(new URL('../parca-zinciri-supplier-portal-native-slot.js',import.meta.url));

test('native overview uses server inventory and rejects legacy/stale data', {timeout:60000}, async t=>{
  const server=createServer((req,res)=>{
    res.setHeader('Content-Type',req.url==='/portal.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
    res.end(req.url==='/portal.js'?source:'<!doctype html><meta charset="utf-8"><parca-zinciri-supplier-portal></parca-zinciri-supplier-portal><script src="/portal.js"></script>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();const errors=[];
  page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
  try{
    await page.addInitScript(()=>{
      localStorage.setItem('pz_supplier_portal_profile',JSON.stringify({companyName:'LEGACY PRIVATE FIRM'}));
      localStorage.setItem('pz_supplier_portal_requests',JSON.stringify([{id:'LEGACY RFQ',matched:true}]));
    });
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.evaluate(()=>{
      window.host=document.querySelector('parca-zinciri-supplier-portal');window.mode='defer';window.pending=[];window.calls=[];
      window.reply=(d,result)=>host.setAttribute('data-pz-portal-api-result',JSON.stringify({reqId:d.reqId,result}));
      window.good=(items,name='SERVER FIRM',nextOffset=null)=>({ok:true,data:{items,identity:{companyName:name},nextOffset}});
      host.addEventListener('pz-portal-api',e=>{
        const d=e.detail;calls.push(d.method);
        if(d.method==='getSupplierNotifications'){setTimeout(()=>reply(d,good([])),5);return;}
        if(d.method!=='getMobileInventory')throw Error('Unexpected fixture method '+d.method);
        if(mode==='defer'){pending.push(d);return;}
        let result=good([]);
        if(mode==='rows')result=d.payload.offset?good([{title:'Page two',status:'rejected'}]):good([{status:'pending'},{status:'approved'},{status:'pending'}],'<img src=x onerror=alert(1)>',3);
        if(mode==='error')result={ok:false,error:{code:'FORBIDDEN'}};
        if(mode==='malformed')result={ok:true,data:{nextOffset:null}};
        if(mode==='cursor')result=good([],'SERVER FIRM',0);
        setTimeout(()=>reply(d,result),5);
      });
      window.auth=company=>host.setAttribute('data-pz-state',JSON.stringify({auth:{ui:company?'active_supplier':'unauthenticated',context:company?{companyId:company,role:'supplier_owner'}:null}}));
    });
    const host=page.locator('parca-zinciri-supplier-portal');
    const refresh=async mode=>{await page.evaluate(m=>{window.mode=m;},mode);await host.locator('[data-action="reload-live-inventory"]').click();};
    await t.test('login does not show persisted/demo identity, metrics, requests or activities',async()=>{
      assert.equal(await page.evaluate(()=>calls.length),0);
      await page.evaluate(()=>auth('firm-a'));
      await host.getByText('Ürün özeti sunucudan yükleniyor…',{exact:true}).waitFor();
      assert.deepEqual(await host.locator('.stat .val').allTextContents(),['—','—','—','—']);
      const text=await host.innerText();
      for(const forbidden of ['Marmara Endüstriyel','LEGACY PRIVATE FIRM','LEGACY RFQ','TLP-24081','TKL-1182','Sonuçlanan İşlemler'])assert.equal(text.includes(forbidden),false,forbidden);
    });
    await t.test('all inventory pages are counted with honest product labels',async()=>{
      await page.evaluate(()=>reply(pending.shift(),good([])));
      await host.getByText('Henüz ürün kaydınız yok.',{exact:true}).waitFor();
      await refresh('rows');
      await page.waitForFunction(()=>document.querySelector('parca-zinciri-supplier-portal').shadowRoot.querySelector('.stat .val')?.textContent==='4');
      assert.deepEqual(await host.locator('.stat .val').allTextContents(),['4','2','1','1']);
      assert.equal(await host.getByText('Bu bölümün canlı veri bağlantısı henüz tamamlanmadı. Talep, teklif, satış veya aktivite sayısı gösterilmiyor.',{exact:true}).count(),1);
    });
    await t.test('server identity is escaped rather than interpreted as markup',async()=>{
      await page.evaluate(()=>{mode='defer';host._loadLiveInventory();});
      await page.evaluate(()=>reply(pending.shift(),good([],'<img src=x onerror=alert(1)>')));
      await host.locator('.user-chip').getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();
      assert.equal(await host.locator('.user-chip img').count(),0);
    });
    await t.test('errors and malformed payloads never pretend zero inventory',async()=>{
      for(const mode of ['error','malformed','cursor']){
        await refresh(mode);await host.getByRole('alert').waitFor();
        assert.deepEqual(await host.locator('.stat .val').allTextContents(),['—','—','—','—']);
        assert.equal(await host.getByText('Henüz ürün kaydınız yok.',{exact:true}).count(),0);
      }
    });
    await t.test('retry succeeds with a genuine empty state',async()=>{
      await refresh('empty');await host.getByText('Henüz ürün kaydınız yok.',{exact:true}).waitFor();
      assert.deepEqual(await host.locator('.stat .val').allTextContents(),['0','0','0','0']);
    });
    await t.test('late old-company success cannot leak identity or records',async()=>{
      await refresh('defer');await page.evaluate(()=>{mode='empty';auth('firm-b');});
      await host.getByText('Henüz ürün kaydınız yok.',{exact:true}).waitFor();
      await page.evaluate(()=>reply(pending.shift(),good([{status:'approved'}],'OLD FIRM')));
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      assert.equal((await host.innerText()).includes('OLD FIRM'),false);
      assert.deepEqual(await host.locator('.stat .val').allTextContents(),['0','0','0','0']);
    });
    await t.test('late old-session error cannot overwrite same-company re-entry',async()=>{
      await refresh('defer');await page.evaluate(()=>{auth(null);mode='empty';auth('firm-b');});
      await host.getByText('Henüz ürün kaydınız yok.',{exact:true}).waitFor();
      await page.evaluate(()=>reply(pending.shift(),{ok:false,error:{code:'FORBIDDEN'}}));
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      assert.equal(await host.getByRole('alert').count(),0);
    });
    await t.test('background inventory response preserves unrelated form DOM and focus',async()=>{
      await refresh('defer');await page.evaluate(()=>{host._setRoute('settings');window.input=host.shadowRoot.querySelector('#leadDefault');input.value='PRESERVE DRAFT';input.focus();});
      await page.evaluate(()=>reply(pending.shift(),good([])));
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      assert.deepEqual(await page.evaluate(()=>({same:input===host.shadowRoot.querySelector('#leadDefault'),value:input.value,focus:host.shadowRoot.activeElement===input})),{same:true,value:'PRESERVE DRAFT',focus:true});
    });
    await t.test('disconnect/reconnect rejects pending data and reloads naturally',async()=>{
      await page.evaluate(()=>{mode='defer';host._setRoute('overview');host.remove();mode='empty';document.body.appendChild(host);});
      await host.getByText('Henüz ürün kaydınız yok.',{exact:true}).waitFor();
      await page.evaluate(()=>reply(pending.shift(),good([{status:'pending'}],'DETACHED FIRM')));
      await page.evaluate(()=>new Promise(requestAnimationFrame));
      assert.equal((await host.innerText()).includes('DETACHED FIRM'),false);
    });
    await t.test('mobile viewport has no horizontal overflow',async()=>{
      await page.setViewportSize({width:390,height:844});
      assert.equal(await host.locator('[data-main]').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
    });
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
