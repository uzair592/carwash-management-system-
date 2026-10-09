const prisma = require('../prisma');
const F = require('../services/finance.service');
const { dayKey, bounds, monthBounds } = require('../utils/business-time');
function input(body) {
  const date = String(body.work_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw F.error('Choose a work date.');
  bounds(date);
  if (date > dayKey()) throw F.error('Overtime cannot be recorded for a future date.');
  if (!['number','string'].includes(typeof body.minutes)) throw F.error('Enter overtime minutes.');
  const minutes = Number(body.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw F.error('Enter between 1 and 1440 overtime minutes.');
  const rate = F.amount(body.hourly_rate);
  const amount = Math.round(minutes * F.cents(rate) / 60) / 100;
  if (!amount || amount > 99999999.99) throw F.error('Overtime amount is outside the supported range.');
  const notes = String(body.notes || '').trim();
  if (!notes || notes.length > 500) throw F.error('Enter a reason of at most 500 characters.');
  return { user_id: String(body.user_id || ''), work_date: new Date(date+'T00:00:00Z'), minutes, hourly_rate: rate, amount, notes };
}
async function capacity(tx, data, exclude) {
  const worker = await tx.user.findUnique({where:{id:data.user_id}});
  if (!worker || worker.role !== 'Worker' || !worker.is_active) throw F.error('Choose an active workshop worker.');
  const rows = await tx.staffOvertime.findMany({where:{user_id:data.user_id,work_date:data.work_date,voided_at:null}});
  if (rows.filter(r=>r.id!==exclude).reduce((sum,r)=>sum+r.minutes,0)+data.minutes>1440) throw F.error('Total overtime for this worker exceeds 24 hours on this date.');
}
async function list(req,res,next) { try {
  const month = req.query.month || dayKey().slice(0,7); monthBounds(month);
  const from = new Date(month+'-01T00:00:00Z'), to = new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+1,1));
  const rows = await prisma.staffOvertime.findMany({where:{work_date:{gte:from,lt:to}},include:{user:{select:{id:true,name:true,is_active:true}}},orderBy:[{work_date:'desc'},{created_at:'desc'}]});
  res.json({status:'success',data:rows});
} catch(e){next(e);} }
async function save(req,res,next) { try {
  const data=input(req.body), updating=Boolean(req.params.id), key=updating?null:F.key(req,'overtime');
  const row=await F.transact(async tx=>{
    await F.lock(tx,'staff-overtime');
    if (!updating) {
      const previous=await tx.staffOvertime.findUnique({where:{request_key:key}});
      if(previous){if(previous.user_id!==data.user_id || previous.work_date.getTime()!==data.work_date.getTime() || previous.minutes!==data.minutes || Number(previous.hourly_rate)!==data.hourly_rate || previous.notes!==data.notes)throw F.error('This request key was already used for different overtime.',409);return previous;}
    }
    const original=updating?await tx.staffOvertime.findUnique({where:{id:req.params.id}}):null;
    if(updating && (!original || original.voided_at)) throw F.error('Active overtime entry not found.',404);
    if(updating && original.version!==req.body.version)throw F.error('This entry changed. Refresh before editing.',409);
    await capacity(tx,data,req.params.id);
    const result=updating?await tx.staffOvertime.update({where:{id:original.id},data:{...data,version:{increment:1}}}):await tx.staffOvertime.create({data:{...data,request_key:key}});
    await F.audit(tx,req,updating?'OVERTIME_UPDATED':'OVERTIME_CREATED','Workshop overtime recorded.',{entry_id:result.id,before:original,after:data});
    return result;
  });
  res.json({status:'success',data:row});
} catch(e){next(e);} }
async function remove(req,res,next) { try {
  const reason=String(req.body.reason||'').trim(); if(!reason||reason.length>500)throw F.error('A removal reason is required (maximum 500 characters).');
  const row=await F.transact(async tx=>{
    await F.lock(tx,'staff-overtime');
    const original=await tx.staffOvertime.findUnique({where:{id:req.params.id}});
    if(!original)throw F.error('Overtime entry not found.',404);
    if(original.voided_at)return original;
    if(original.version!==req.body.version)throw F.error('This entry changed. Refresh before removing.',409);
    const result=await tx.staffOvertime.update({where:{id:original.id},data:{voided_at:new Date(),void_reason:reason,version:{increment:1}}});
    await F.audit(tx,req,'OVERTIME_REMOVED',reason,{entry_id:original.id,amount:original.amount});return result;
  });res.json({status:'success',data:row});
} catch(e){next(e);} }
async function workers(req,res,next){try{res.json({status:'success',data:await prisma.user.findMany({where:{role:'Worker',is_active:true},select:{id:true,name:true,overtime_rate:true,role:true,is_active:true},orderBy:{name:'asc'}})});}catch(e){next(e);}}
module.exports={list,save,remove,input,workers};
