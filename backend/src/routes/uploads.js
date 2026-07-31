const express = require('express');
const upload = require('../middleware/multerConfig');
const path = require('path');
const { scanTicket } = require('../services/ocrService');

const router = express.Router();


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


router.post('/scan', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'No se subió archivo',
      });
    }

    const imagePath = path.join(req.file.destination, req.file.filename);
    const { amount, text } = await scanTicket(imagePath);

    res.json({
      ok: true,
      data: {
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype,
        size: req.file.size,
        amount, 
        text,   
      },
    });
  } catch (error) {
    console.error('Error en OCR del ticket:', error);
    res.status(500).json({
      ok: false,
      error: 'No se pudo procesar la imagen con OCR: ' + error.message,
    });
  }
});

module.exports = router;
