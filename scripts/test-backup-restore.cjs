const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const archive=require('../src/services/backup-archive.service');
const {createService}=require('../src/services/shop-backup.service');
const maintenance=require('../src/services/maintenance.service');
async function fixture(){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'dfpro-backup-test-'));
  await fs.mkdir(path.join(root,'prisma/migrations/20261009000000_two_operator_accounts'),{recursive:true});
  await fs.mkdir(path.join(root,'public/uploads'),{recursive:true});await fs.writeFile(path.join(root,'public/uploads/current.jpg'),'original photo');
  const state={value:'original',restoreCalls:0,fail:false,versions:0,audits:[]};
  const db={$disconnect:async()=>{},$executeRawUnsafe:async()=>{state.versions++;},auditLog:{create:async x=>state.audits.push(x)}};
  const tool=async(binary,args)=>{
    if(binary==='dump')await fs.writeFile(args[args.indexOf('--file')+1],'PGDMP'+state.value);
    else if(args[0]==='--list')assert.equal((await fs.readFile(args.at(-1))).subarray(0,5).toString(),'PGDMP');
    else{state.restoreCalls++;assert(args.includes('--single-transaction'));if(state.fail){state.fail=false;throw Error('test restore failure');}state.value=(await fs.readFile(args.at(-1),'utf8')).slice(5);}
  };
  const service=createService({root,db,tool,env:{DATABASE_URL:'postgresql://test:test@localhost/test',PG_DUMP_BIN:'dump',PG_RESTORE_BIN:'restore'}});
  return {root,state,service,cleanup:()=>fs.rm(root,{recursive:true,force:true})};
}
test('Backup archive round-trip includes the dump/media and rejects corruption/traversal',async()=>{
  const f=await fixture();try{
    const file=path.join(f.root,'saved.dfpro');await maintenance.exclusive(()=>f.service.capture(file));
    const stage=await f.service.inspect(file);assert.equal(stage.manifest.files.length,2);await fs.rm(stage.parent,{recursive:true,force:true});
    const bytes=zlib.gunzipSync(await fs.readFile(file));bytes[bytes.length-1]^=1;await fs.writeFile(path.join(f.root,'corrupt.dfpro'),zlib.gzipSync(bytes));
    await assert.rejects(f.service.inspect(path.join(f.root,'corrupt.dfpro')),/checksum/);
    for(const name of ['../escape','public/uploads/../../escape','public/uploads/C:\\escape','public/uploads/CON.txt'])assert.equal(archive.safeName(name),false);
    assert.throws(()=>archive.validate({format:'DFPRO_BACKUP_V1',version:1,created_at:new Date().toISOString(),files:[{path:'../escape',size:1,sha256:'0'.repeat(64)}]}));
  }finally{await f.cleanup();}
});
test('Restore saves a safety copy, replaces media exactly, invalidates sessions and audits success',async()=>{
  const f=await fixture();try{
    const incoming=path.join(f.root,'incoming.dfpro');f.state.value='incoming';await fs.writeFile(path.join(f.root,'public/uploads/current.jpg'),'incoming photo');await f.service.capture(incoming);
    f.state.value='original';await fs.writeFile(path.join(f.root,'public/uploads/current.jpg'),'original photo');await fs.writeFile(path.join(f.root,'public/uploads/stale.jpg'),'must disappear');
    const stage=await f.service.inspect(incoming),result=await f.service.restore(stage,{name:'Owner'});
    assert.equal(f.state.value,'incoming');assert.equal(f.state.versions,1);assert.equal(f.state.audits[0].data.action,'BACKUP_RESTORED');
    assert.equal(await fs.readFile(path.join(f.root,'public/uploads/current.jpg'),'utf8'),'incoming photo');await assert.rejects(fs.access(path.join(f.root,'public/uploads/stale.jpg')));
    await fs.access(path.join(f.service.safety,result.safety_backup));assert.equal(maintenance.state().active,false);await fs.rm(stage.parent,{recursive:true,force:true});
  }finally{await f.cleanup();}
});
test('Failed restore recovers original database and files and rejects a mismatched software version',async()=>{
  const f=await fixture();try{
    const incoming=path.join(f.root,'incoming.dfpro');f.state.value='incoming';await f.service.capture(incoming);f.state.value='original';
    const stage=await f.service.inspect(incoming);f.state.fail=true;await assert.rejects(f.service.restore(stage,{name:'Owner'}),/pre-restore database and files were recovered/);
    assert.equal(f.state.value,'original');assert.equal(f.state.restoreCalls,2);assert.equal(await fs.readFile(path.join(f.root,'public/uploads/current.jpg'),'utf8'),'original photo');assert.equal(maintenance.state().active,false);
    const other=path.join(f.root,'other.dfpro');await archive.pack(stage.dir,other,{created_at:new Date().toISOString(),schema_version:'wrong-version'});await assert.rejects(f.service.inspect(other),/different software version/);await fs.rm(stage.parent,{recursive:true,force:true});
  }finally{await f.cleanup();}
});
test('Maintenance drains active work, blocks new background work and rejects a second operation',async()=>{
  let release;const running=maintenance.background(()=>new Promise(r=>{release=r;}));let entered=false;
  const locked=maintenance.exclusive(async()=>{entered=true;});assert.equal(maintenance.state().active,true);assert.equal(entered,false);
  let backgroundRan=false;await maintenance.background(()=>{backgroundRan=true;});assert.equal(backgroundRan,false);await assert.rejects(maintenance.exclusive(async()=>{}),/already running/);
  release();await running;await locked;assert.equal(entered,true);assert.equal(maintenance.state().active,false);
});
test('Interrupted restore is recovered from its saved safety archive on startup',async()=>{
  const f=await fixture();try{
    await fs.mkdir(f.service.safety,{recursive:true});const name='before-restore-123-00000000-0000-0000-0000-000000000000.dfpro';await f.service.capture(path.join(f.service.safety,name));
    await fs.writeFile(path.join(f.service.safety,'restore-recovery.json'),JSON.stringify({file:name}));f.state.value='interrupted';await f.service.recoverOnBoot();assert.equal(f.state.value,'original');await assert.rejects(fs.access(path.join(f.service.safety,'restore-recovery.json')));
  }finally{await f.cleanup();}
});
