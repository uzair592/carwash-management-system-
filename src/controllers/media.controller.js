const prisma = require('../prisma');
const path = require('path');
const fs = require('fs');

/**
 * Normalizes input type string to VehicleMediaType enum: BEFORE, AFTER, DAMAGE_PROOF
 */
function normalizeMediaType(input) {
  const norm = String(input || 'BEFORE').trim().toUpperCase();
  if (norm === 'AFTER') return 'AFTER';
  if (norm === 'DAMAGE' || norm === 'DAMAGE_PROOF') return 'DAMAGE_PROOF';
  return 'BEFORE';
}

/**
 * POST /api/job-cards/:id/media
 * Uploads an inspection/liability photo for a JobCard
 */
async function uploadJobCardMediaHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { type, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No image file uploaded. Field "image" or "file" is required.',
      });
    }

    // Verify Job Card exists
    const jobCard = await prisma.jobCard.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    if (!jobCard) {
      // Clean up uploaded file if JobCard not found
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        status: 'error',
        message: `Job Card with ID "${id}" does not exist.`,
      });
    }

    const mediaType = normalizeMediaType(type);
    const relativeFilePath = `/uploads/vehicles/${req.file.filename}`;

    const createdMedia = await prisma.vehicleMedia.create({
      data: {
        job_card_id: id,
        file_path: relativeFilePath,
        type: mediaType,
        notes: notes ? String(notes).trim() : null,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: `Inspection photo uploaded successfully for ${jobCard.vehicle.registration_number}.`,
      data: createdMedia,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/job-cards/:id/media
 * Retrieves all media photos linked to a JobCard
 */
async function getJobCardMediaHandler(req, res, next) {
  try {
    const { id } = req.params;

    const media = await prisma.vehicleMedia.findMany({
      where: { job_card_id: id },
      orderBy: { uploaded_at: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: media,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/job-cards/media/:mediaId
 * Deletes an inspection media record and removes local file from disk
 */
async function deleteJobCardMediaHandler(req, res, next) {
  try {
    const { mediaId } = req.params;

    const targetMedia = await prisma.vehicleMedia.findUnique({
      where: { id: mediaId },
    });

    if (!targetMedia) {
      return res.status(404).json({
        status: 'error',
        message: `Media record "${mediaId}" not found.`,
      });
    }

    // Delete local file if it exists
    const filename = path.basename(targetMedia.file_path);
    const fullPath = path.join(__dirname, '../../public/uploads/vehicles', filename);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.warn('Could not remove file from disk:', err.message);
      }
    }

    await prisma.vehicleMedia.delete({
      where: { id: mediaId },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Inspection media photo deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadJobCardMediaHandler,
  getJobCardMediaHandler,
  deleteJobCardMediaHandler,
};
