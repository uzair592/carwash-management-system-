const {chromium}=require('playwright'),assert=require('node:assert/strict'),express=require('express'),path=require('node:path');
const app=express();app.use(express.json());let calls=0,denied=false;
app.get('/api/auth/me',(req,res)=>denied?res.status(401).json({message:'Session revoked'}):res.json({user:{id:'owner',name:'Owner',role:'ADMIN',permissions:{}}}));
app.get('/api/services',(req,res)=>{calls++;res.json({data:[{id:'s1',name:'Full wash',price:500,is_active:true,category:'Wash',pricing_matrix:{SEDAN:500}}]});});
app.get('/api/bays/live-status',(req,res)=>res.json({queue:[],ready_for_billing:[],bays:{}}));
app.get('/api/ledger',(req,res)=>res.json({data:[{account_type:'Cash_Drawer',current_balance:1500}]}));
app.get('/api/register/current',(req,res)=>res.json({data:{is_open:true}}));
app.get('/api/branding',(req,res)=>res.json({data:{business_name:'DF PRO'}}));
app.get('/api/*',(req,res)=>res.json({data:[]}));
app.use(express.static(path.join(__dirname,'../client/dist')));
(async()=>{const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});const context=await browser.newContext(),page=await context.newPage();
try{
 page.on('pageerror',e=>console.error('PAGE',e.message));
 await page.goto(origin);await page.evaluate(()=>localStorage.setItem('carwash_auth_token','test-token'));await page.reload();
 await page.waitForFunction(()=>navigator.serviceWorker.controller);console.log('PASS service worker active');await page.getByText('Live',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.body.innerText.includes('Full wash'));
 await page.getByRole('button',{name:'Save latest for offline',exact:true}).click();await page.getByText('Saved latest dashboard, reports and up to 250 recent invoices. Other pages/searches save when viewed online.',{exact:true}).waitFor();
 const cached=await page.evaluate(async()=>{const r=await fetch('/manifest.webmanifest');return r.json();});assert.equal(cached.display,'standalone');
 // Cache authenticated GETs through the real Axios bridge, then stop all network access.
 console.log('PASS live data cached');await context.setOffline(true);await page.reload();
 await page.getByText('Offline · view only',{exact:true}).waitFor({timeout:20000});console.log('PASS offline shell reopened');
 await page.getByRole('button',{name:'Inventory & finance',exact:true}).click();
 await page.getByRole('button',{name:'Services Catalog',exact:true}).click();
 await page.getByText('Full wash',{exact:true}).first().waitFor();
 assert.equal(await page.getByRole('button',{name:'Add New Service',exact:true}).isEnabled(),false);
 const result=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('dfpro-offline-v1');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
  const rows=await new Promise(resolve=>{const r=db.transaction('saved').objectStore('saved').getAll();r.onsuccess=()=>resolve(r.result);});db.close();return rows.length;
 });assert(result>1);
 await context.setOffline(false);await page.reload();await page.getByText('Live',{exact:true}).waitFor();
 denied=true;await page.reload();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
 const count=await page.evaluate(async()=>{const d=await new Promise(resolve=>{const r=indexedDB.open('dfpro-offline-v1');r.onsuccess=()=>resolve(r.result);});const n=await new Promise(resolve=>{const r=d.transaction('saved').objectStore('saved').count();r.onsuccess=()=>resolve(r.result);});d.close();return n;});assert.equal(count,0);
 console.log('PASS PWA install manifest, production shell offline reload, account cache, read-only navigation, reconnection and revoked-session purge.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
