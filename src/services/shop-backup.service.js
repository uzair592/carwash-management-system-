const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const archive=require('./backup-archive.service');
const maintenance=require('./maintenance.service');
const {run,databaseEnv}=require('../../scripts/backup-shop');
function createService({root=path.resolve(__dirname,'../..'),db=require('../prisma'),tool=run,env=process.env}={}){
  const safety=path.join(root,'backups','safety'),marker=path.join(safety,'restore-recovery.json');
  const privateDir=env.PRIVATE_DATA_DIR||path.join(root,'private');
  const schema=()=>require('node:fs').readdirSync(path.join(root,'prisma/migrations')).filter(n=>/^\d/.test(n)).sort().at(-1);
  async function capture(file){
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dfpro-capture-'));
    try{
      await tool(env.PG_DUMP_BIN||'pg_dump',['-Fc','--file',path.join(dir,'database.dump')],databaseEnv(env.DATABASE_URL));
      try{await fs.cp(path.join(root,'public/uploads'),path.join(dir,'public/uploads'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
      try{await fs.mkdir(path.join(dir,'private'),{recursive:true});await fs.copyFile(path.join(privateDir,'session-secret'),path.join(dir,'private/session-secret'));}catch(e){if(e.code!=='ENOENT')throw e;}
      return await archive.pack(dir,file,{created_at:new Date().toISOString(),schema_version:schema()});
    }catch(e){await fs.rm(file,{force:true});throw e;}finally{await fs.rm(dir,{recursive:true,force:true});}
  }
  async function inspect(file){
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dfpro-stage-'));
    try{
      const manifest=await archive.unpack(file,path.join(dir,'contents'));
      if(manifest.schema_version!==schema())throw new Error('This backup belongs to a different software version. Use the matching DF PRO version before restoring it.');
      await tool(env.PG_RESTORE_BIN||'pg_restore',['--list',path.join(dir,'contents/database.dump')],{...process.env});
      return {dir:path.join(dir,'contents'),parent:dir,manifest};
    }catch(e){await fs.rm(dir,{recursive:true,force:true});throw e;}
  }
  async function replaceUploads(contents){
    const target=path.join(root,'public/uploads'),newDir=target+'-restore-'+crypto.randomUUID(),oldDir=target+'-previous-'+crypto.randomUUID();
    await fs.mkdir(newDir,{recursive:true});
    try{
      try{await fs.cp(path.join(contents,'public/uploads'),newDir,{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
      let old=false;
      try{await fs.rename(target,oldDir);old=true;}catch(e){if(e.code!=='ENOENT')throw e;}
      try{await fs.rename(newDir,target);}catch(e){if(old)await fs.rename(oldDir,target);throw e;}
      if(old)await fs.rm(oldDir,{recursive:true,force:true});
    }finally{await fs.rm(newDir,{recursive:true,force:true});}
  }
  async function apply(contents){
    await db.$disconnect();
    const database=databaseEnv(env.DATABASE_URL);
    await tool(env.PG_RESTORE_BIN||'pg_restore',['--clean','--if-exists','--no-owner','--no-privileges','--exit-on-error','--single-transaction','--dbname',database.PGDATABASE,path.join(contents,'database.dump')],database);
    await replaceUploads(contents);
    try{
      const secret=await fs.readFile(path.join(contents,'private/session-secret'));
      await fs.mkdir(privateDir,{recursive:true,mode:0o700});
      const temp=path.join(privateDir,'session-secret.new');await fs.writeFile(temp,secret,{mode:0o600});await fs.rename(temp,path.join(privateDir,'session-secret'));
    }catch(e){if(e.code!=='ENOENT')throw e;}
  }
  async function writeMarker(value){await fs.mkdir(safety,{recursive:true,mode:0o700});const temp=marker+'.new';await fs.writeFile(temp,JSON.stringify(value),{mode:0o600});await fs.rename(temp,marker);}
  async function restore(stage,actor,afterRestore=async()=>{}){
    return maintenance.exclusive(async()=>{
      await fs.mkdir(safety,{recursive:true,mode:0o700});
      const name='before-restore-'+Date.now()+'-'+crypto.randomUUID()+'.dfpro',file=path.join(safety,name);
      await capture(file); // No destructive action before verified safety capture.
      const pre=await inspect(file);
      try{
        await writeMarker({file:name,created_at:new Date().toISOString()});
        try{
          await apply(stage.dir);
          await db.$executeRawUnsafe('UPDATE "users" SET "session_version"="session_version"+1');
          await afterRestore();
          await db.auditLog.create({data:{action:'BACKUP_RESTORED',description:'Shop database and uploads restored from a verified DF PRO backup.',performed_by_name:actor.name,metadata:{backup_created_at:stage.manifest.created_at,safety_backup:name}}});
        }catch(e){
          try{await apply(pre.dir);await afterRestore();await fs.rm(marker,{force:true});}catch(rollbackError){maintenance.hold();throw new Error('Restore and recovery failed. The shop remains paused. Keep the pre-restore backup and restart the server to retry recovery.');}
          throw new Error('Restore failed. The pre-restore database and files were recovered.');
        }
        await fs.rm(marker,{force:true});
        return {safety_backup:name};
      }finally{await fs.rm(pre.parent,{recursive:true,force:true});}
    });
  }
  async function recoverOnBoot(){
    let pending;try{pending=JSON.parse(await fs.readFile(marker,'utf8'));}catch(e){if(e.code==='ENOENT')return;throw e;}
    if(!/^before-restore-\d+-[a-f0-9-]+\.dfpro$/.test(pending.file))throw new Error('Invalid restore recovery marker.');
    const stage=await inspect(path.join(safety,pending.file));
    try{await apply(stage.dir);await fs.rm(marker,{force:true});console.log('[Backup] Interrupted restore recovered from the safety backup.');}finally{await fs.rm(stage.parent,{recursive:true,force:true});}
  }
  return {capture,inspect,restore,recoverOnBoot,safety};
}
let instance;module.exports={createService,getService:()=>instance||(instance=createService())};
