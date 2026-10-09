require('dotenv').config();
const path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function npm(args){const command=process.platform==='win32'?'npm.cmd':'npm';const r=spawnSync(command,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});if(r.error||r.status!==0)throw new Error('Setup command failed: npm '+args.join(' '));}
async function setup(mode){
 if(!['install','update'].includes(mode))throw new Error('Choose install or update.');
 if(!process.env.DATABASE_URL)throw new Error('Configure DATABASE_URL in the shop .env first.');
 npm(['run','prisma:generate']);
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient();let existing;
 try{const tables=await db.$queryRawUnsafe("SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");existing=tables[0].count>0;}finally{await db.$disconnect();}
 if(mode==='install'&&existing)throw new Error('This database already has tables. Use update-shop.bat after reviewing the baseline instructions in docs/REPAIR_RELEASE.md.');
 if(existing){console.log('Saving and verifying pre-update backups...');await require('./backup-shop').backupShop();}
 npm(['--prefix','client','ci']);
 npm(['run','prisma:deploy']);
 npm(['run','prisma:generate']);
 if(!existing)npm(['run','prisma:seed']);
 npm(['run','build:client']);
 require('./shop-launch').launch();
 console.log('Setup complete. For daily use, open start-shop.bat.');
}
if(require.main===module)setup(process.argv[2]).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={setup};
