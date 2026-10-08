const prisma = require('../prisma');
const F = require('../services/finance.service');
const {
  verifyAdminOrManagerPin
} = require('../middleware/auth.middleware');
async function hydrate(id) {
  const invoice = await prisma.invoice.findUnique({
    where: {
      id
    },
    include: {
      payments: {
        include: {
          bank_account: true
        }
      },
      refunds: true,
      job_card: {
        include: {
          vehicle: true,
          services: {
            include: {
              service: true
            }
          }
        }
      },
      deposits: true
    }
  });
  const applications = await prisma.depositApplication.findMany({
    where: {
      invoice_id: id
    }
  });
  return {
    ...invoice,
    deposit_applications: applications
  };
}
function response(invoice) {
  const subtotal = invoice.line_snapshot?.reduce((s, i) => s + F.cents(i.price_charged), 0) / 100 || Number(invoice.total_amount) + Number(invoice.discount_amount);
  const deposits_applied = invoice.deposit_applications.reduce((s, d) => s + F.cents(d.amount), 0) / 100;
  return {
    invoice,
    payments: invoice.payments,
    applied_deposits: invoice.deposits,
    subtotal,
    discount_amount: Number(invoice.discount_amount),
    final_total: Number(invoice.total_amount),
    deposits_applied,
    payments_collected: invoice.payments.reduce((s, p) => s + F.cents(p.amount), 0) / 100,
    cash_tendered: Number(invoice.cash_tendered || 0),
    change_returned: Number(invoice.change_returned || 0),
    balance_due: Number(invoice.balance_due),
    status: invoice.status
  };
}
function normalizePayments(body, due) {
  let inputs = body.payments?.length ? body.payments : [{
    payment_method: body.payment_method || 'CASH',
    amount: body.collected_amount ?? due,
    bank_account_id: body.bank_account_id,
    tender_amount: body.cash_tendered
  }];
  const list = [];
  for (const input of inputs) {
    const n = F.amount(input.amount, {
      zero: true
    });
    if (!n) continue;
    const m = F.mode(input.payment_method);
    const bank = input.bank_account_id || (m.account === 'Main_Bank' ? body.bank_account_id : null);
    if (m.account === 'Main_Bank' && !bank) throw F.error('Select a bank account for each bank payment.');
    if (m.account === 'Cash_Drawer' && bank) throw F.error('Cash payments cannot be assigned to a bank.');
    const tender = m.method === 'Cash' ? F.amount(input.tender_amount ?? body.cash_tendered ?? n) : n;
    if (tender < n) throw F.error('Cash tendered cannot be less than cash collected.');
    list.push({
      amount: n,
      payment_method: m.method,
      bank_account_id: bank || null,
      tender_amount: tender,
      change_amount: (F.cents(tender) - F.cents(n)) / 100,
      notes: input.notes || null
    });
  }
  if (list.reduce((s, p) => s + F.cents(p.amount), 0) > F.cents(due)) throw F.error('Collected amount exceeds the balance due. Enter extra cash as cash tendered.');
  return list;
}
async function collect(tx, req, invoice, entries, requestKey) {
  for (let i = 0; i < entries.length; i++) {
    const p = entries[i];
    const record = await tx.payment.create({
      data: {
        ...p,
        invoice_id: invoice.id,
        recorded_by_id: req.user.id,
        request_key: requestKey + ':' + i
      }
    });
    await F.movement(tx, {
      method: p.payment_method,
      bankId: p.bank_account_id,
      delta: p.amount,
      kind: 'PAYMENT',
      sourceId: record.id
    });
  }
}
async function checkoutHandler(req, res, next) {
  try {
    const {
      job_card_id,
      applied_deposit_ids = []
    } = req.body;
    if (!job_card_id) throw F.error('A job card is required.');
    const discount = F.amount(req.body.discount_amount ?? 0, {
      zero: true
    });
    if (discount && !(await require('../services/permission.service').approval(req, 'billing.discount')).isValid) throw F.error('Admin approval required for discount.', 403);
    const id = await F.transact(async tx => {
      await F.lock(tx, 'checkout:' + job_card_id);
      const job = await tx.jobCard.findUnique({
        where: {
          id: job_card_id
        },
        include: {
          invoice: true,
          vehicle: true,
          services: {
            include: {
              service: true
            }
          }
        }
      });
      if (!job) throw F.error('Job not found.', 404);
      if (job.invoice) return job.invoice.id;
      if (!['READY_FOR_BILLING', 'Completed'].includes(job.status)) throw F.error('Complete the workshop job before billing.');
      if (!job.services.length) throw F.error('Add services before billing.');
      const subtotal = job.services.reduce((s, i) => s + F.cents(i.price_charged), 0) / 100;
      if (discount > subtotal) throw F.error('Discount exceeds the bill.');
      const total = (F.cents(subtotal) - F.cents(discount)) / 100;
      const selected = [...new Set(applied_deposit_ids)];
      let applied = 0;
      const deposits = [];
      for (const depositId of selected) {
        await F.lock(tx, 'deposit:' + depositId);
        const dep = await tx.customerDeposit.findUnique({
          where: {
            id: depositId
          }
        });
        if (!dep || dep.status !== 'ACTIVE' || dep.vehicle_id !== job.vehicle_id) throw F.error('An advance does not belong to this vehicle or is unavailable.');
        const remaining = Number(dep.remaining_amount ?? dep.amount);
        const used = Math.min(remaining, (F.cents(total) - F.cents(applied)) / 100);
        if (used <= 0) throw F.error('Selected advances exceed this bill.');
        deposits.push({
          dep,
          used,
          remaining
        });
        applied += used;
      }
      const due = (F.cents(total) - F.cents(applied)) / 100;
      const entries = normalizePayments(req.body, due);
      const collected = entries.reduce((s, p) => s + F.cents(p.amount), 0) / 100;
      const paid = (F.cents(applied) + F.cents(collected)) / 100;
      const invoice = await tx.invoice.create({
        data: {
          invoice_number: await F.number('INV', tx),
          job_card_id,
          cashier_id: req.user.id,
          total_amount: total,
          discount_amount: discount,
          paid_amount: paid,
          balance_due: (F.cents(total) - F.cents(paid)) / 100,
          status: paid === total ? 'PAID' : paid ? 'PARTIAL' : 'UNPAID',
          payment_method: entries[0]?.payment_method || deposits[0]?.dep.payment_method || 'Cash',
          cash_tendered: entries.filter(p => p.payment_method === 'Cash').reduce((s, p) => s + F.cents(p.tender_amount), 0) / 100,
          change_returned: entries.filter(p => p.payment_method === 'Cash').reduce((s, p) => s + F.cents(p.change_amount), 0) / 100,
          line_snapshot: job.services.map(s => ({
            service_id: s.service_id,
            name: s.service.name,
            category: s.service.category,
            price_charged: Number(s.price_charged)
          }))
        }
      });
      for (const {
        dep,
        used,
        remaining
      } of deposits) {
        const left = (F.cents(remaining) - F.cents(used)) / 100;
        await tx.customerDeposit.update({
          where: {
            id: dep.id
          },
          data: {
            remaining_amount: left,
            status: left ? 'ACTIVE' : 'APPLIED',
            applied_to_invoice_id: left ? null : invoice.id,
            applied_at: left ? null : new Date()
          }
        });
        await tx.depositApplication.create({
          data: {
            deposit_id: dep.id,
            invoice_id: invoice.id,
            amount: used
          }
        });
      }
      await collect(tx, req, invoice, entries, 'checkout:' + invoice.id);
      await tx.jobCard.update({
        where: {
          id: job_card_id
        },
        data: {
          status: 'COMPLETED'
        }
      });
      await F.audit(tx, req, 'INVOICE_CHECKOUT', 'Invoice ' + invoice.invoice_number + ' created.', {
        invoice_id: invoice.id,
        total,
        paid
      });
      await F.alert(tx, 'Invoice ' + invoice.invoice_number + ' — Rs. ' + total + '; collected now Rs. ' + collected + '; advance Rs. ' + applied, 'checkout:' + invoice.id);
      if (job.vehicle?.customer_phone) await tx.alertOutbox.upsert({
        where: {
          event_key: 'receipt:' + invoice.id
        },
        create: {
          event_key: 'receipt:' + invoice.id,
          type: 'SMS',
          payload: {
            phone: job.vehicle.customer_phone,
            text: 'DF PRO ' + invoice.invoice_number + ' Total Rs. ' + total + '; paid Rs. ' + paid + '; balance Rs. ' + (total - paid).toFixed(2)
          }
        },
        update: {}
      });
      return invoice.id;
    });
    const complete = await hydrate(id);
    res.json({
      status: 'success',
      data: response(complete)
    });
  } catch (e) {
    next(e);
  }
}
async function collectPaymentHandler(req, res, next) {
  try {
    const requestKey = F.key(req, 'collect');
    const id = req.params.id;
    await F.transact(async tx => {
      await F.lock(tx, 'invoice:' + id);
      const existing = await tx.payment.findFirst({
        where: {
          request_key: requestKey + ':0'
        }
      });
      if (existing) {
        if (existing.invoice_id !== id) throw F.error('Request key belongs to another invoice.');
        return;
      }
      const invoice = await tx.invoice.findUnique({
        where: {
          id
        },
        include: {
          refunds: true
        }
      });
      if (!invoice) throw F.error('Invoice not found.', 404);
      const credited = invoice.refunds.reduce((s, r) => s + F.cents(r.amount), 0);
      const entries = normalizePayments(req.body, Number(invoice.balance_due));
      if (!entries.length) throw F.error('Enter a payment.');
      await collect(tx, req, invoice, entries, requestKey);
      const added = entries.reduce((s, p) => s + F.cents(p.amount), 0);
      const paid = (F.cents(invoice.paid_amount) + added) / 100;
      await tx.invoice.update({
        where: {
          id
        },
        data: {
          paid_amount: paid,
          balance_due: (F.cents(invoice.total_amount) - credited - F.cents(paid)) / 100,
          status: F.cents(paid) === F.cents(invoice.total_amount) - credited ? 'PAID' : 'PARTIAL'
        }
      });
      await F.audit(tx, req, 'PAYMENT_COLLECTED', 'Outstanding invoice payment collected.', {
        invoice_id: id,
        amount: added / 100
      });
      await F.alert(tx, 'Invoice payment received: Rs. ' + added / 100, requestKey);
    });
    res.json({
      status: 'success',
      data: response(await hydrate(id))
    });
  } catch (e) {
    next(e);
  }
}
async function reversePaymentHandler(req, res, next) {
  try {
    const approved = await require('../services/permission.service').approval(req, 'billing.reverse');
    if (!approved.isValid || !req.body.reason) throw F.error('Admin approval and reason required.', 403);
    const requestKey = F.key(req, 'reverse');
    await F.transact(async tx => {
      await F.lock(tx, 'invoice:' + req.params.id);
      const invoice = await tx.invoice.findUnique({
        where: {
          id: req.params.id
        },
        include: {
          refunds: true
        }
      });
      if (!invoice) throw F.error('Invoice not found.', 404);
      if (invoice.refunds.length) throw F.error('A refunded invoice cannot have its payment reversed.');
      const payment = await tx.payment.findUnique({
        where: {
          id: req.body.payment_id
        }
      });
      if (!payment || payment.invoice_id !== invoice.id || Number(payment.amount) <= 0) throw F.error('Choose an original payment on this invoice.');
      const prior = await tx.payment.findUnique({
        where: {
          reversed_payment_id: payment.id
        }
      });
      if (prior) return;
      const value = Number(payment.amount);
      await tx.payment.create({
        data: {
          invoice_id: invoice.id,
          amount: -value,
          payment_method: payment.payment_method,
          bank_account_id: payment.bank_account_id,
          reversed_payment_id: payment.id,
          request_key: requestKey,
          recorded_by_id: req.user.id,
          notes: 'Reversal: ' + req.body.reason
        }
      });
      await F.movement(tx, {
        method: payment.payment_method,
        bankId: payment.bank_account_id,
        delta: -value,
        kind: 'REVERSAL',
        sourceId: payment.id
      });
      const paid = (F.cents(invoice.paid_amount) - F.cents(value)) / 100;
      await tx.invoice.update({
        where: {
          id: invoice.id
        },
        data: {
          paid_amount: paid,
          balance_due: (F.cents(invoice.total_amount) - F.cents(paid)) / 100,
          status: paid ? 'PARTIAL' : 'UNPAID'
        }
      });
      await F.audit(tx, req, 'PAYMENT_REVERSAL', String(req.body.reason), {
        invoice_id: invoice.id,
        payment_id: payment.id,
        approved_by: approved.user.id
      });
      await F.alert(tx, 'Invoice payment reversed: Rs. ' + value, requestKey);
    });
    res.json({
      status: 'success',
      data: await hydrate(req.params.id)
    });
  } catch (e) {
    next(e);
  }
}
async function listInvoicesHandler(req, res, next) {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) {
      const q = String(req.query.search);
      where.OR = [{
        invoice_number: {
          contains: q,
          mode: 'insensitive'
        }
      }, {
        job_card: {
          vehicle: {
            registration_number: {
              contains: q,
              mode: 'insensitive'
            }
          }
        }
      }];
    }
    const data = await prisma.invoice.findMany({
      where,
      take: Math.min(200, Math.max(1, Number(req.query.limit) || 50)),
      skip: Math.max(0, Number(req.query.offset) || 0),
      orderBy: {
        created_at: 'desc'
      },
      include: {
        payments: {
          include: {
            bank_account: true
          }
        },
        refunds: true,
        job_card: {
          include: {
            vehicle: true,
            services: {
              include: {
                service: true
              }
            }
          }
        },
        deposits: true
      }
    });
    res.json({
      status: 'success',
      data
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  checkoutHandler,
  collectPaymentHandler,
  reversePaymentHandler,
  listInvoicesHandler
};
