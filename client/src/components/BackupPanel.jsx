import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Upload, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
export default function BackupPanel() {
  const { logout } = useAuth();
  const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [copies, setCopies] = useState([]);
  useEffect(() => { axios.get('/api/backups/safety').then(r => setCopies(r.data.data || [])).catch(() => {}); }, []);
  async function recoveryCopy(name) { setBusy('copy'); setError(''); try { const r = await axios.get('/api/backups/safety/'+name, { responseType: 'blob' }); const url = URL.createObjectURL(r.data), a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); } catch(e) { setError(await message(e)); } finally { setBusy(''); } }
  async function message(e){const data=e.response?.data;if(data instanceof Blob){try{return JSON.parse(await data.text()).message;}catch{}}return data?.message||'The operation could not complete. Check the server and PostgreSQL tools.';}
  async function download(){setBusy('download');setError('');setNotice('');try{
    const r=await axios.post('/api/backups/download',{}, {responseType:'blob',timeout:0});
    const url=URL.createObjectURL(r.data),link=document.createElement('a');link.href=url;link.download='DF-PRO-'+new Date().toISOString().slice(0,10)+'.dfpro';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Backup downloaded. Keep a copy on another device or drive.');
  }catch(e){setError(await message(e));}finally{setBusy('');}}
  async function inspect(){if(!file)return;setBusy('inspect');setError('');setNotice('');try{
    if(preview)await axios.delete('/api/backups/'+preview.id);
    setPreview(null);setConfirmation('');const body=new FormData();body.append('backup',file);
    const r=await axios.post('/api/backups/inspect',body,{timeout:0});setPreview(r.data.data);
  }catch(e){setError(await message(e));}finally{setBusy('');}}
  async function cancel(){setBusy('cancel');setError('');try{await axios.delete('/api/backups/'+preview.id);setPreview(null);setConfirmation('');}catch(e){setError(await message(e));}finally{setBusy('');}}
  async function restore(){setBusy('restore');setError('');setNotice('');try{
    await axios.post(`/api/backups/${preview.id}/restore`,{confirmation},{timeout:0});
    sessionStorage.setItem('dfpro_restore_notice','Backup restored. Sign in with an Admin or Accountant account saved in that backup.');
    await logout();window.location.reload();
  }catch(e){setError(await message(e));}finally{setBusy('');}}
  return <section className="backup-settings space-y-4">
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success-note" role="status">{notice}</p>}
    <div className="backup-card surface"><header><Database size={22}/><div><h2>Download backup</h2><p>Save shop data, vehicle photos and your logo in one DF PRO backup file.</p></div></header><button className="btn btn-primary" disabled={Boolean(busy)} onClick={download}><Download size={17}/>{busy==='download'?'Preparing backup…':'Download backup'}</button></div>
    <div className="backup-card surface"><header><Upload size={22}/><div><h2>Restore backup</h2><p>Choose a .dfpro file made by this software version. The current shop data will be replaced.</p></div></header>
      <label className="field-label">Backup file<input aria-label="Backup file" type="file" accept=".dfpro" disabled={Boolean(busy)||Boolean(preview)} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
      {!preview&&<button className="btn btn-secondary" disabled={!file||Boolean(busy)} onClick={inspect}>{busy==='inspect'?'Checking backup…':'Check backup'}</button>}
      {preview&&<div className="restore-preview"><h3>Verified backup</h3><dl><div><dt>Created</dt><dd>{new Date(preview.created_at).toLocaleString('en-PK')}</dd></div><div><dt>Photos & logo files</dt><dd>{preview.media_count}</dd></div><div><dt>Expanded size</dt><dd>{(preview.total_bytes/1024**2).toFixed(1)} MB</dd></div></dl><p>Shop activity pauses during restore. A pre-restore recovery copy is saved on the server. Afterwards, sign in using the accounts in the backup.</p><label className="field-label">Type RESTORE to replace shop data<input className="field" aria-label="Type RESTORE to replace shop data" autoComplete="off" disabled={Boolean(busy)} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><div className="flex gap-2"><button className="btn btn-primary" disabled={confirmation!=='RESTORE'||Boolean(busy)} onClick={restore}>{busy==='restore'?'Restoring shop…':'Restore backup'}</button><button className="btn btn-secondary" disabled={Boolean(busy)} onClick={cancel}>Cancel restore</button></div></div>}
    </div>
    {copies.length>0&&<div className="backup-card surface"><h2>Pre-restore recovery copies</h2>{copies.map(copy=><div className="flex flex-wrap gap-3 justify-between items-center" key={copy.name}><span className="text-sm">{new Date(copy.created_at).toLocaleString('en-PK')} · {(copy.bytes/1024**2).toFixed(1)} MB</span><button className="btn btn-secondary" disabled={Boolean(busy)} onClick={()=>recoveryCopy(copy.name)}><Download size={16}/>Download recovery copy</button></div>)}</div>}
    {busy&&<p role="status" className="muted">{busy==='restore'?'Restoring data and files. Keep this page open.':'Working… please wait.'}</p>}
  </section>;
}
