// Daily start changes no dependencies, database schema, or seed records.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function launch(stop=false){
  let pm2;
  try{pm2=require.resolve('pm2/bin/pm2');}catch(e){throw new Error('First run install.bat. Shop dependencies are not installed.');}
  if(!stop&&!require('node:fs').existsSync(path.join(root,'client/dist/index.html')))throw new Error('The shop UI has not been built. Run install.bat or update-shop.bat.');
  const result=spawnSync(process.execPath,[pm2,stop?'stop':'start','ecosystem.config.js',...(stop?[]:['--update-env'])],{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0)throw new Error('PM2 could not '+(stop?'stop':'start')+' the shop. Check the output above.');
  if(!stop){const saved=spawnSync(process.execPath,[pm2,'save'],{cwd:root,stdio:'inherit'});if(saved.status!==0)throw new Error('Shop started, but PM2 process list could not be saved.');console.log('DF PRO is running. Open http://localhost:5000');}
}
if(require.main===module){try{launch(process.argv[2]==='stop');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={launch};
