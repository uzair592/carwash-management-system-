const prisma = require('../prisma');
const F = require('../services/finance.service');
let timer;
async function reconcileArrivals() {
  const arrivals = await prisma.cameraArrival.findMany({
    where: {
      matched_job_id: null,
      alerted_at: null,
      arrived_at: {
        lte: new Date(Date.now() - 180000)
      }
    },
    take: 50
  });
  for (const arrival of arrivals) {
    const job = arrival.plate ? await prisma.jobCard.findFirst({
      where: {
        vehicle: {
          normalized_plate: arrival.plate
        },
        created_at: {
          gte: new Date(arrival.arrived_at.getTime() - 180000),
          lte: new Date(arrival.arrived_at.getTime() + 180000)
        }
      }
    }) : null;
    await F.transact(async tx => {
      const updated = await tx.cameraArrival.updateMany({
        where: {
          id: arrival.id,
          matched_job_id: null,
          alerted_at: null
        },
        data: job ? {
          matched_job_id: job.id
        } : {
          alerted_at: new Date()
        }
      });
      if (updated.count && !job) await F.alert(tx, 'Camera arrival needs review: ' + (arrival.plate || 'plate uncertain') + '. No matching work ticket found.', 'arrival:' + arrival.id);
    });
  }
}
function initArrivalWorker() {
  timer = setInterval(() => require('../services/maintenance.service').background(() => reconcileArrivals()).catch(e => console.error('[Arrival]', e.message)), 15000);
}
function stopArrivalWorker() {
  clearInterval(timer);
}
module.exports = {
  reconcileArrivals,
  initArrivalWorker,
  stopArrivalWorker
};
