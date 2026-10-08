const prisma = require('../prisma');
const F = require('../services/finance.service');
const printer = require('../services/thermal-printer.service');
async function settings() {
  return prisma.printerSetting.upsert({
    where: {
      id: 'shop'
    },
    create: {
      id: 'shop'
    },
    update: {}
  });
}
async function getSettings(req, res, next) {
  try {
    res.json({
      status: 'success',
      data: await settings()
    });
  } catch (e) {
    next(e);
  }
}
async function updateSettings(req, res, next) {
  try {
    const {
      mode,
      host,
      printer_name,
      port = 9100,
      auto_cut = false,
      cut_feed = 3,
      paper_width = 80
    } = req.body;
    if (!['BROWSER', 'NETWORK', 'WINDOWS'].includes(mode) || typeof auto_cut !== 'boolean' || !Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(cut_feed) || cut_feed < 0 || cut_feed > 8 || ![58, 80].includes(paper_width)) throw F.error('Invalid printer settings.');
    if (mode === 'NETWORK' && !printer.isLocalHost(host)) throw F.error('Enter a local IPv4 printer address.');
    if (mode === 'WINDOWS' && (!String(printer_name || '').trim() || String(printer_name).length > 200)) throw F.error('Enter the installed Windows printer name.');
    const data = await F.transact(async tx => {
      const value = {
        mode,
        host: mode === 'NETWORK' ? host : null,
        printer_name: mode === 'WINDOWS' ? printer_name : null,
        port,
        auto_cut: mode === 'BROWSER' ? false : auto_cut,
        cut_feed,
        paper_width
      };
      const result = await tx.printerSetting.upsert({
        where: {
          id: 'shop'
        },
        create: {
          id: 'shop',
          ...value
        },
        update: value
      });
      await F.audit(tx, req, 'PRINTER_SETTINGS_UPDATED', 'Thermal printer configuration changed.', {
        mode,
        auto_cut: value.auto_cut,
        paper_width
      });
      return result;
    });
    res.json({
      status: 'success',
      data
    });
  } catch (e) {
    next(e);
  }
}
async function printDocument(req, res, next) {
  try {
    const config = await settings();
    if (config.mode === 'BROWSER') throw F.error('This printer is configured for browser printing.');
    const {
      kind,
      document_id
    } = req.body;
    if (!['TICKET', 'INVOICE'].includes(kind) || typeof document_id !== 'string') throw F.error('Choose a saved ticket or invoice.');
    const document = kind === 'TICKET' ? await prisma.jobCard.findUnique({
      where: {
        id: document_id
      },
      include: {
        vehicle: true,
        services: {
          include: {
            service: true
          }
        }
      }
    }) : await prisma.invoice.findUnique({
      where: {
        id: document_id
      },
      include: {
        refunds: true,
        payments: {
          include: {
            bank_account: true
          }
        },
        job_card: {
          include: {
            vehicle: true,
            services: {
              include: {
                service: true
              }
            }
          }
        }
      }
    });
    if (!document) throw F.error('Print document not found.', 404);
    if (kind === 'INVOICE') document.deposit_applications = await prisma.depositApplication.findMany({
      where: {
        invoice_id: document_id
      }
    });
    const branding = (await prisma.businessBranding.findFirst()) || {};
    const buffer = printer.buildEscPos(kind, document, branding, config, req.body);
    const requestKey = F.key(req, 'print');
    const claim = await F.transact(async tx => {
      await F.lock(tx, requestKey);
      const prior = await tx.printerJob.findUnique({
        where: {
          request_key: requestKey
        }
      });
      if (prior) {
        if (prior.kind !== kind || prior.document_id !== document_id) throw F.error('Print request belongs to another document.', 409);
        return {
          prior
        };
      }
      const job = await tx.printerJob.create({
        data: {
          request_key: requestKey,
          kind,
          document_id,
          requested_by: req.user.id
        }
      });
      return {
        job
      };
    });
    if (claim.prior) {
      if (claim.prior.status === 'SENT') return res.json({
        status: 'success',
        data: {
          sent: true,
          replayed: true
        }
      });
      throw F.error('This print job has an uncertain result. Check the printer before starting a new print.', 409);
    }
    try {
      if (config.mode === 'NETWORK') await printer.sendNetwork(buffer, config);else await printer.sendWindows(buffer, config);
      await prisma.printerJob.update({
        where: {
          id: claim.job.id
        },
        data: {
          status: 'SENT',
          completed_at: new Date()
        }
      });
      res.json({
        status: 'success',
        data: {
          sent: true,
          auto_cut: config.auto_cut
        }
      });
    } catch (e) {
      await prisma.printerJob.update({
        where: {
          id: claim.job.id
        },
        data: {
          status: 'UNKNOWN'
        }
      });
      throw F.error('Printer delivery could not be confirmed. Check the paper before printing again.', 409);
    }
  } catch (e) {
    next(e);
  }
}
module.exports = {
  getSettings,
  updateSettings,
  printDocument
};
