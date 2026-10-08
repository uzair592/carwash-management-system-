const prisma = require('../prisma');

/**
 * Helper to get or create the default business branding row
 */
async function getOrCreateBranding() {
  let branding = await prisma.businessBranding.findFirst();
  if (!branding) {
    branding = await prisma.businessBranding.create({
      data: {
        business_name: 'DF PRO Car Wash & Detailing Center',
        tagline: 'Premium Auto Care & Ceramic Studio',
        address: 'Main Commercial Avenue, Phase 5, DHA',
        phone: '+92 300 1234567',
        email: 'info@dfprodetailing.com',
        ntn_number: '1234567-8',
        logo_url: null,
        logo_size: 120,
        loyalty_threshold: 5,
      },
    });
  }
  return branding;
}

/**
 * GET /api/branding
 * Retrieve current business branding settings
 */
async function getBrandingHandler(req, res, next) {
  try {
    const branding = await getOrCreateBranding();
    return res.status(200).json({
      status: 'success',
      data: branding,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/branding
 * Update business branding (Admin/Manager only)
 */
async function updateBrandingHandler(req, res, next) {
  try {
    const branding = await getOrCreateBranding();
    const {
      business_name,
      tagline,
      address,
      phone,
      email,
      ntn_number,
      logo_url,
      logo_size,
      loyalty_threshold,
      invoice_template,
      token_template,
      vehicle_makes,
    } = req.body;

    const updated = await prisma.businessBranding.update({
      where: { id: branding.id },
      data: {
        business_name: business_name !== undefined ? String(business_name).trim() : undefined,
        tagline: tagline !== undefined ? String(tagline).trim() : undefined,
        address: address !== undefined ? String(address).trim() : undefined,
        phone: phone !== undefined ? String(phone).trim() : undefined,
        email: email !== undefined ? String(email).trim() : undefined,
        ntn_number: ntn_number !== undefined ? String(ntn_number).trim() : undefined,
        logo_url: logo_url !== undefined ? logo_url : undefined,
        logo_size: logo_size !== undefined ? Math.max(40, Math.min(300, parseInt(logo_size, 10) || 120)) : undefined,
        loyalty_threshold: loyalty_threshold !== undefined ? Math.max(1, parseInt(loyalty_threshold, 10) || 5) : undefined,
        invoice_template: invoice_template !== undefined ? String(invoice_template).trim() : undefined,
        token_template: token_template !== undefined ? String(token_template).trim() : undefined,
        vehicle_makes: vehicle_makes !== undefined ? String(vehicle_makes).trim() : undefined,
      },
    });

    // Audit log update
    await prisma.auditLog.create({
      data: {
        action: 'BRANDING_UPDATED',
        description: `Business branding & settings updated by ${req.user?.name || 'Admin'}`,
        performed_by_user_id: req.user?.id || null,
        performed_by_name: req.user?.name || 'Shop Admin',
        metadata: {
          business_name: updated.business_name,
          logo_size: updated.logo_size,
          loyalty_threshold: updated.loyalty_threshold,
        },
      },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Business branding settings saved successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/branding/logo
 * Upload or replace logo (base64 or file upload)
 */
async function uploadLogoHandler(req, res, next) {
  try {
    const branding = await getOrCreateBranding();
    let logoUrl = null;

    if (req.file) {
      logoUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.logo_base64) {
      logoUrl = req.body.logo_base64;
    } else if (req.body.logo_url) {
      logoUrl = req.body.logo_url;
    }

    if (!logoUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'No logo file or image data provided.',
      });
    }

    const updated = await prisma.businessBranding.update({
      where: { id: branding.id },
      data: { logo_url: logoUrl },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Logo updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/branding/logo
 * Remove business logo
 */
async function removeLogoHandler(req, res, next) {
  try {
    const branding = await getOrCreateBranding();
    const updated = await prisma.businessBranding.update({
      where: { id: branding.id },
      data: { logo_url: null },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Logo removed successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOrCreateBranding,
  getBrandingHandler,
  updateBrandingHandler,
  uploadLogoHandler,
  removeLogoHandler,
};
