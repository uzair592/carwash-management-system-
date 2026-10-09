const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const multer=require('multer');
const maintenance=require('../services/maintenance.service');
const {getService}=require('../services/shop-backup.service');
const prisma=require('../prisma');
const directory=path.join(os.tmpdir(),'dfpro-backup-uploads');require('node:fs').mkdirSync(directory,{recursive:true,mode:0o700});
const upload=multer({dest:directory,limits:{fileSize:2*1024**3+16*1024**2,files:1},fileFilter:(req,file,cb)=>cb(path.extname(file.originalname).toLowerCase()==='.dfpro'?null:Object.assign(new Error('Choose a DF PRO .dfpro backup file.'),{status:400}),true)}).single('backup');
const stages=new Map();
async function expire(){for(const [id,s]of stages)if(s.expires<Date.now()&&s.status!=='restoring'){stages.delete(id);await fs.rm(s.parent,{recursive:true,force:true});}}
setInterval(()=>expire().catch(()=>{}),60000).unref();
function preview(stage){const m=stage.manifest;return {created_at:m.created_at,schema_version:m.schema_version,file_count:m.files.length,total_bytes:m.files.reduce((s,f)=>s+f.size,0),media_count:m.files.filter(f=>f.path.startsWith('public/uploads/')).length};}
async function download(req,res,next){let dir;try{
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'dfpro-download-'));const file=path.join(dir,'backup.dfpro');
  await maintenance.exclusive(async()=>{await getService().capture(file);const verified=await getService().inspect(file);await fs.rm(verified.parent,{recursive:true,force:true});await prisma.auditLog.create({data:{action:'BACKUP_DOWNLOADED',description:'Verified shop backup downloaded by Admin.',performed_by_user_id:req.user.id,performed_by_name:req.user.name}});});
  res.set('Cache-Control','no-store');res.download(file,'DF-PRO-'+new Date().toISOString().replace(/[:.]/g,'-')+'.dfpro',error=>{fs.rm(dir,{recursive:true,force:true}).catch(()=>{});if(error&&!res.headersSent)next(error);});
}catch(e){if(dir)await fs.rm(dir,{recursive:true,force:true});e.status=e.status||400;next(e);}}
async function inspect(req,res,next){try{
  if(maintenance.state().active)throw Object.assign(new Error('Wait for the current backup or restore.'),{status:409});
  if(!req.file)throw new Error('Choose a backup file.');await expire();
  if([...stages.values()].filter(s=>s.owner===req.user.id).length>=3)throw new Error('Too many staged backups. Cancel an existing preview first.');
  const stage=await getService().inspect(req.file.path),id=crypto.randomBytes(24).toString('hex');
  stages.set(id,{...stage,owner:req.user.id,status:'ready',expires:Date.now()+3600000});
  res.json({status:'success',data:{id,...preview(stage)}});
}catch(e){e.status=e.status||400;next(e);}finally{if(req.file)await fs.rm(req.file.path,{force:true});}}
function owned(req){const s=stages.get(req.params.id);if(!s||s.owner!==req.user.id||s.expires<Date.now())throw Object.assign(new Error('Backup preview expired. Upload it again.'),{status:404});return s;}
async function discard(req,res,next){try{const s=owned(req);if(s.status==='restoring')throw new Error('A restore is already running.');stages.delete(req.params.id);await fs.rm(s.parent,{recursive:true,force:true});res.json({status:'success'});}catch(e){next(e);}}
async function restore(req,res,next){let s;try{
  s=owned(req);if(req.body.confirmation!=='RESTORE')throw new Error('Type RESTORE to confirm replacing the shop data.');
  if(s.status!=='ready')throw Object.assign(new Error('This restore has already been started. Upload again for a new action.'),{status:409});
  s.status='restoring';
  const result=await getService().restore(s,req.user,async()=>{
    require('../utils/security').resetSigningSecret();
    const settings=require('../services/settings.service');await settings.initSettings();for(const [key,value]of Object.entries(settings.getAllSettings())){try{settings.settingsEmitter.emit('settingsUpdated',{key,value});}catch(error){console.error('[Backup] Hardware refresh failed:',error.message);}}
  });
  stages.delete(req.params.id);
  res.json({status:'success',data:result,message:'Restore complete. Sign in using an account saved in the backup.'});
}catch(e){if(s)s.status='failed';e.status=e.status||400;next(e);}finally{if(s&&s.status==='restoring')await fs.rm(s.parent,{recursive:true,force:true});}}
async function safetyDownload(req,res,next){try{
  if(!/^before-restore-\d+-[a-f0-9-]+\.dfpro$/.test(req.params.name))throw new Error('Invalid safety backup name.');
  const file=path.join(getService().safety,req.params.name);await fs.access(file);res.set('Cache-Control','no-store');res.download(file,req.params.name);
}catch(e){next(e);}}
async function listSafety(req,res,next){try{
  const dir=getService().safety;let names=[];try{names=await fs.readdir(dir);}catch(e){if(e.code!=='ENOENT')throw e;}
  const files=[];for(const name of names.filter(n=>/^before-restore-\d+-[a-f0-9-]+\.dfpro$/.test(n))){const stat=await fs.stat(path.join(dir,name));if(stat.isFile())files.push({name,created_at:stat.mtime.toISOString(),bytes:stat.size});}
  files.sort((a,b)=>b.created_at.localeCompare(a.created_at));res.json({status:'success',data:files.slice(0,10)});
}catch(e){next(e);}}
module.exports={listSafety,upload,download,inspect,restore,discard,safetyDownload};
