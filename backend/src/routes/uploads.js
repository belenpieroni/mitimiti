const express = require('express');
const upload = require('../middleware/multerConfig');
const path = require('path');

const router = express.Router();

/**
 * POST /uploads
 * Carga una foto de ticket
 * Multipart form-data con campo 'file'
 */
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'No se subió archivo',
      });
    }

    res.json({
      ok: true,
      data: {
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;
