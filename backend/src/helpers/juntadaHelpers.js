const { pool } = require('../db');


async function cargarJuntadaCompleta(juntadaId) {
  const { rows: [juntada] } = await pool.query(
    `SELECT id::text, nombre, descripcion, fecha::text,
            creador_id::text AS "creadorId", creada_en AS "creadaEn"
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
      `SELECT jp.id::text, jp.nombre, jp.iniciales, jp.color, p.alias
       FROM juntada_participantes jp
       LEFT JOIN perfiles p ON LOWER(jp.nombre) = LOWER(p.nombre)
       WHERE jp.juntada_id = $1`,
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

async function cargarJuntadasCompletas(juntadaIds) {
  if (!juntadaIds || juntadaIds.length === 0) return [];

  const { rows: juntadas } = await pool.query(
    `SELECT id::text, nombre, descripcion, fecha::text,
            creador_id::text AS "creadorId", creada_en AS "creadaEn"
     FROM juntadas WHERE id = ANY($1::uuid[])`,
    [juntadaIds]
  );

  if (juntadas.length === 0) return [];

  const { rows: todosParticipantes } = await pool.query(
    `SELECT jp.id::text, jp.juntada_id::text AS "juntadaId", jp.nombre, jp.iniciales, jp.color, p.alias
     FROM juntada_participantes jp
     LEFT JOIN perfiles p ON LOWER(jp.nombre) = LOWER(p.nombre)
     WHERE jp.juntada_id = ANY($1::uuid[])`,
    [juntadaIds]
  );

  const { rows: todosGastos } = await pool.query(
    `SELECT id::text, juntada_id::text AS "juntadaId", nombre, pagador, monto::float, split_mode AS "splitMode",
            split_subgroups AS "splitSubgroups", beneficiarios,
            ticket_photo AS "ticketPhoto", creado_en AS "creadoEn"
     FROM juntada_gastos WHERE juntada_id = ANY($1::uuid[]) ORDER BY creado_en`,
    [juntadaIds]
  );

  const { rows: todosPagosDeudas } = await pool.query(
    `SELECT id::text, juntada_id::text AS "juntadaId", de, para, monto::float, creado_en AS "creadoEn"
     FROM juntada_pagos_deudas WHERE juntada_id = ANY($1::uuid[])`,
    [juntadaIds]
  );

  const { rows: todosSubgrupos } = await pool.query(
    `SELECT id::text, juntada_id::text AS "juntadaId", nombre FROM juntada_subgrupos WHERE juntada_id = ANY($1::uuid[])`,
    [juntadaIds]
  );

  const subgrupoIds = todosSubgrupos.map(sg => sg.id);
  let todosIntegrantes = [];
  if (subgrupoIds.length > 0) {
    const { rows } = await pool.query(
      `SELECT subgrupo_id::text AS "subgrupoId", nombre FROM subgrupo_integrantes WHERE subgrupo_id = ANY($1::uuid[])`,
      [subgrupoIds]
    );
    todosIntegrantes = rows;
  }

  const integrantesMap = {};
  todosIntegrantes.forEach(i => {
    if (!integrantesMap[i.subgrupoId]) integrantesMap[i.subgrupoId] = [];
    integrantesMap[i.subgrupoId].push(i.nombre);
  });

  const subgruposConIntegrantes = todosSubgrupos.map(sg => ({
    ...sg,
    integrantes: integrantesMap[sg.id] || []
  }));

  const participantesMap = {};
  todosParticipantes.forEach(p => {
    if (!participantesMap[p.juntadaId]) participantesMap[p.juntadaId] = [];
    participantesMap[p.juntadaId].push(p);
  });

  const gastosMap = {};
  todosGastos.forEach(g => {
    if (!gastosMap[g.juntadaId]) gastosMap[g.juntadaId] = [];
    gastosMap[g.juntadaId].push(g);
  });

  const pagosDeudasMap = {};
  todosPagosDeudas.forEach(p => {
    if (!pagosDeudasMap[p.juntadaId]) pagosDeudasMap[p.juntadaId] = [];
    pagosDeudasMap[p.juntadaId].push(p);
  });

  const subgruposMap = {};
  subgruposConIntegrantes.forEach(sg => {
    if (!subgruposMap[sg.juntadaId]) subgruposMap[sg.juntadaId] = [];
    subgruposMap[sg.juntadaId].push(sg);
  });

  const juntadasMap = {};
  juntadas.forEach(j => {
    juntadasMap[j.id] = {
      ...j,
      participantes: participantesMap[j.id] || [],
      gastos: gastosMap[j.id] || [],
      pagosDeudas: pagosDeudasMap[j.id] || [],
      subgrupos: subgruposMap[j.id] || [],
    };
  });

  return juntadaIds.map(id => juntadasMap[id]).filter(Boolean);
}

module.exports = { cargarJuntadaCompleta, cargarJuntadasCompletas };
