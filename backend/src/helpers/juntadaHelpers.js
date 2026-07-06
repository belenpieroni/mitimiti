const { pool } = require('../db');

/**
 * Carga una juntada completa desde PostgreSQL con todos sus sub-documentos,
 * reconstruyendo el mismo shape de objeto que usaba db.json para que
 * el balanceService funcione sin cambios.
 *
 * @param {string} juntadaId
 * @returns {object|null}
 */
async function cargarJuntadaCompleta(juntadaId) {
  const { rows: [juntada] } = await pool.query(
    `SELECT id::text, nombre, descripcion, fecha::text, creada_en AS "creadaEn"
     FROM juntadas WHERE id = $1`,
    [juntadaId]
  );
  if (!juntada) return null;

  const [
    { rows: participantes },
    { rows: gastos },
    { rows: pagosDeudas },
    { rows: subgruposRaw },
  ] = await Promise.all([
    pool.query(
      `SELECT id::text, nombre, iniciales, color
       FROM juntada_participantes WHERE juntada_id = $1`,
      [juntadaId]
    ),
    pool.query(
      `SELECT id::text, nombre, pagador, monto::float, split_mode AS "splitMode",
              split_subgroups AS "splitSubgroups", beneficiarios,
              ticket_photo AS "ticketPhoto", creado_en AS "creadoEn"
       FROM juntada_gastos WHERE juntada_id = $1 ORDER BY creado_en`,
      [juntadaId]
    ),
    pool.query(
      `SELECT id::text, de, para, monto::float, creado_en AS "creadoEn"
       FROM juntada_pagos_deudas WHERE juntada_id = $1`,
      [juntadaId]
    ),
    pool.query(
      `SELECT id::text, nombre FROM juntada_subgrupos WHERE juntada_id = $1`,
      [juntadaId]
    ),
  ]);

  const subgrupos = await Promise.all(
    subgruposRaw.map(async (sg) => {
      const { rows: integrantes } = await pool.query(
        'SELECT nombre FROM subgrupo_integrantes WHERE subgrupo_id = $1',
        [sg.id]
      );
      return { ...sg, integrantes: integrantes.map((i) => i.nombre) };
    })
  );

  return { ...juntada, participantes, gastos, pagosDeudas, subgrupos };
}

module.exports = { cargarJuntadaCompleta };
