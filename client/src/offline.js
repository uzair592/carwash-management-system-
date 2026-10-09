import axios from 'axios';
const DB='dfpro-offline-v1', STORE='saved';
const READ=/^\/api\/(?:bays\/live-status|ledger|register\/current|dashboard\/live|services|customers|loyalty|invoices|banks|inventory|staff|leaderboard|reports\/summary|payroll|financials\/payroll|financials\/dividends|branding|printer\/settings|settings)(?:\/|$)/;
let user=null, offline=false, lastSync=null, persist=true, storageError='';
const emit=()=>window.dispatchEvent(new CustomEvent('dfpro-connection',{detail:{offline,lastSync,persist,storageError}}));
async function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function storage(method,key,value){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,method==='get'?'readonly':'readwrite'),s=t.objectStore(STORE),r=method==='put'?s.put(value,key):method==='clear'?s.clear():s.get(key);let result;r.onsuccess=()=>{result=r.result;};t.oncomplete=()=>{d.close();resolve(result);};t.onerror=()=>{d.close();reject(t.error);};});}
const safeStore=(...args)=>storage(...args).catch(()=>{storageError='Device storage is unavailable or full. Offline saving may be incomplete.';emit();return null;});
export const connection=()=>({offline,lastSync,persist,storageError});
export async function clearOffline(){user=null;offline=false;lastSync=null;await safeStore('clear');emit();}
export async function rememberUser(next){
 if(user && (user.id!==next.id || JSON.stringify(user.permissions)!==JSON.stringify(next.permissions)))await safeStore('clear');
 user=next;offline=false;lastSync=new Date().toISOString();
 if(persist)await safeStore('put','profile',{user:next,validated_at:lastSync});emit();
}
export async function savedUser(){const profile=await safeStore('get','profile');if(profile && Date.now()-new Date(profile.validated_at).getTime()<7*86400000){user=profile.user;lastSync=profile.validated_at;return user;}await safeStore('clear');return null;}
export function markOffline(){offline=true;emit();}
function cacheKey(config){const url=new URL(config.url,location.origin);for(const [key,value]of Object.entries(config.params||{}))if(value!==undefined)url.searchParams.set(key,String(value));url.searchParams.sort();return user.id+':'+url.pathname+url.search;}
function cacheable(config){return user&&persist&&(config.method||'get').toLowerCase()==='get'&&READ.test(new URL(config.url,location.origin).pathname)&&!config.responseType;}
export function guardOfflineMutation(config){
 if(offline&&!['get','head','options'].includes((config.method||'get').toLowerCase())&&!config.url?.includes('/auth/'))throw Object.assign(new Error('Offline viewing only. Reconnect to record payments or make changes.'),{offlineBlocked:true,response:{status:503,data:{message:'Offline viewing only. Reconnect to record payments or make changes.'}}});
 config._offlineOwner=user?.id;return config;
}
export async function handleOfflineResponseError(error){
 // HTTP authentication, permission, validation and server failures must remain failures.
 if(error.response||error.offlineBlocked)throw error;
 markOffline();
 if(error.config?._offlineOwner===user?.id&&cacheable(error.config)){
  const cached=await safeStore('get',cacheKey(error.config));
  if(cached){lastSync=cached.saved_at;emit();return {data:cached.data,status:200,statusText:'Saved offline data',headers:{},config:error.config,offline:true,savedAt:cached.saved_at};}
 }
 throw error;
}
export async function setOfflineSaving(value){persist=value;localStorage.setItem('dfpro_offline_enabled',String(value));await safeStore('clear');if(value&&user)await safeStore('put','profile',{user,validated_at:new Date().toISOString()});emit();}
export function installOffline(){
 persist=localStorage.getItem('dfpro_offline_enabled')!=='false';
 axios.defaults.timeout=10000;
 axios.interceptors.request.use(guardOfflineMutation);
 axios.interceptors.response.use(async response=>{
  if(response.config.url==='/api/auth/me')return response;
  if(response.config._offlineOwner===user?.id&&cacheable(response.config)){
    lastSync=new Date().toISOString();offline=false;
    await safeStore('put',cacheKey(response.config),{data:response.data,saved_at:lastSync});emit();
  }return response;
 },handleOfflineResponseError);
 window.addEventListener('offline',markOffline);
}

export async function saveLatest(){
 if(!user||!persist)throw new Error('Enable saving on this device first.');
 const allowed=k=>user.role==='ADMIN'||user.permissions?.[k]===true;
 const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
 const plans=[['workshop.read','/api/bays/live-status'],['finance.read','/api/ledger'],['finance.read','/api/register/current'],['finance.read','/api/banks'],['overview.read','/api/dashboard/live'],['services.read','/api/services?include_inactive=true'],['services.read','/api/services'],['customers.read','/api/customers'],['inventory.read','/api/inventory'],['staff.read','/api/staff'],['staff.read','/api/leaderboard?range=today'],['staff.read','/api/leaderboard?range=month'],['reports.read','/api/reports/summary?range=month'],['reports.read','/api/reports/summary?range=today'],['payroll.read','/api/financials/payroll?month='+month],['payroll.read','/api/payroll/overtime?month='+month],['branding.read','/api/branding']];
 // Save five history pages in the same query shape as Billing & invoices.
 for(let offset=0;offset<250;offset+=50)plans.push(['billing.read','/api/invoices?limit=50&offset='+offset+'&search=']);
 for(const [permission,url]of plans)if(allowed(permission)){const r=await axios.get(url);if(r.offline)throw new Error('Server unavailable. Kept the previously saved data.');}
 if(storageError)throw new Error(storageError);
 return 'Saved latest dashboard, reports and up to 250 recent invoices. Other pages/searches save when viewed online.';
}
