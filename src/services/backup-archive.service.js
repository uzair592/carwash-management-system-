const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const MAGIC = 'DFPRO_BACKUP_V1';
const MAX_BYTES = 2 * 1024 ** 3, MAX_HEADER = 8 * 1024 ** 2;
function safeName(name) {
  return typeof name === 'string' && (name === 'database.dump' || name === 'private/session-secret' || name.startsWith('public/uploads/')) && name.split('/').every(s => s && s !== '.' && s !== '..' && !/[\\<>:"|?*\x00-\x1f]/.test(s) && !/[. ]$/.test(s) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s));
}
async function list(dir, prefix = '') {
  const result = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) throw new Error('Backup files cannot contain symbolic links.');
    const relative = prefix + e.name;
    if (e.isDirectory()) result.push(...await list(path.join(dir,e.name),relative+'/'));
    else if (e.isFile()) result.push(relative);
  }
  return result;
}
async function hash(file) { const h=crypto.createHash('sha256'); for await(const b of createReadStream(file))h.update(b); return h.digest('hex'); }
async function pack(directory, destination, metadata) {
  const files=[];
  for(const relative of await list(directory)) {
    if(!safeName(relative)) throw new Error('Unsupported backup file: '+relative);
    const file=path.join(directory,relative);files.push({path:relative,size:(await fs.stat(file)).size,sha256:await hash(file)});
  }
  const manifest={format:MAGIC,version:1,...metadata,files}; validate(manifest);
  const header=Buffer.from(MAGIC+'\n'+JSON.stringify(manifest)+'\n');
  if(header.length>MAX_HEADER)throw new Error('Backup contains too many files.');
  async function* chunks(){yield header;for(const f of files)for await(const b of createReadStream(path.join(directory,f.path)))yield b;}
  await pipeline(Readable.from(chunks()),zlib.createGzip(),createWriteStream(destination,{flags:'wx',mode:0o600}));
  return manifest;
}
function validate(m) {
  if(m?.format!==MAGIC || m.version!==1 || !Array.isArray(m.files) || m.files.length>50000 || !m.files.some(f=>f.path==='database.dump') || !Number.isFinite(Date.parse(m.created_at)))throw new Error('Not a supported DF PRO backup.');
  const names=new Set();let total=0;
  for(const f of m.files){if(!safeName(f.path)||names.has(f.path)||!Number.isSafeInteger(f.size)||f.size<0||!/^[a-f0-9]{64}$/.test(f.sha256))throw new Error('Unsafe or invalid backup manifest.');names.add(f.path);total+=f.size;}
  if(total>MAX_BYTES)throw new Error('Backup exceeds the 2 GB expanded limit.');
}
async function unpack(archive, directory) {
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  const source=createReadStream(archive), gunzip=zlib.createGunzip();
  source.on('error',e=>gunzip.destroy(e)); source.pipe(gunzip);
  let buffer=Buffer.alloc(0), magic=false, manifest, index=0, remaining=0, handle, hasher;
  async function open(){const f=manifest.files[index];const file=path.join(directory,f.path);await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});handle=await fs.open(file,'wx',0o600);remaining=f.size;hasher=crypto.createHash('sha256');}
  async function finish(){await handle.close();handle=null;if(hasher.digest('hex')!==manifest.files[index].sha256)throw new Error('Backup checksum mismatch.');index++;}
  try {
    for await(const chunk of gunzip){buffer=Buffer.concat([buffer,chunk]);
      while(buffer.length || manifest && index<manifest.files.length && remaining===0){
        if(!manifest){const newline=buffer.indexOf(10);if(newline<0){if(buffer.length>MAX_HEADER)throw new Error('Backup header is too large.');break;}if(newline>MAX_HEADER)throw new Error('Backup header is too large.');const line=buffer.subarray(0,newline).toString('utf8');buffer=buffer.subarray(newline+1);if(!magic){if(line!==MAGIC)throw new Error('Not a DF PRO backup.');magic=true;}else{manifest=JSON.parse(line);validate(manifest);}continue;}
        if(index>=manifest.files.length){if(buffer.length)throw new Error('Unexpected backup data.');break;}
        if(!handle)await open();
        if(!remaining){await finish();continue;}
        if(!buffer.length)break;
        const bytes=buffer.subarray(0,Math.min(remaining,buffer.length));await handle.writeFile(bytes);hasher.update(bytes);remaining-=bytes.length;buffer=buffer.subarray(bytes.length);
        if(!remaining)await finish();
      }
    }
    if(!manifest || handle || index!==manifest.files.length)throw new Error('Backup is incomplete.');
    const db=await fs.open(path.join(directory,'database.dump'),'r');const prefix=Buffer.alloc(5);try{await db.read(prefix,0,5,0);}finally{await db.close();}if(prefix.toString()!=='PGDMP')throw new Error('Database dump is invalid.');
    if(manifest.files.some(f=>f.path==='private/session-secret')){const key=(await fs.readFile(path.join(directory,'private/session-secret'),'utf8')).trim();if(!/^[a-f0-9]{96}$/.test(key))throw new Error('Backup signing material is invalid.');}
    return manifest;
  } catch(e){if(handle)await handle.close();source.destroy();gunzip.destroy();await fs.rm(directory,{recursive:true,force:true});throw e;}
}
module.exports={pack,unpack,safeName,validate,MAX_BYTES};
