/**
 * seed.js — Migra datos existentes de data/db.json a PostgreSQL.
 * Uso: docker compose exec backend npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'mitimiti',
  user: process.env.DB_USER || 'mitimiti',
  password: process.env.DB_PASSWORD || 'mitimiti_dev',
});

const dbJsonPath = path.join(__dirname, '../../data/db.json');

function normalizeId(id) {
  // Intenta mantener el formato UUID; si no, genera uno nuevo
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? id : require('crypto').randomUUID();
}

async function seed() {
  if (!fs.existsSync(dbJsonPath)) {
    console.log('No se encontró data/db.json — nada que migrar.');
    await pool.end();
    return;
  }

  const db = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
  let insertados = 0;
  let omitidos = 0;

  // ── Usuarios ────────────────────────────────────────────────────────────────
  for (const u of db.usuarios || []) {
    try {
      await pool.query(
        `INSERT INTO usuarios (id, name, email, password, iniciales)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, (u.email || '').toLowerCase(), u.password || '', u.iniciales || '??']
      );
      insertados++;
    } catch (e) {
      console.error(`[usuarios] Error en ${u.id}:`, e.message);
      omitidos++;
    }
  }

  // ── Perfiles ─────────────────────────────────────────────────────────────────
  for (const [nombre, datos] of Object.entries(db.perfiles || {})) {
    try {
      await pool.query(
        `INSERT INTO perfiles (nombre, alias) VALUES ($1, $2)
         ON CONFLICT (nombre) DO UPDATE SET alias = $2`,
        [nombre, datos.alias || '']
      );
      insertados++;
    } catch (e) {
      console.error(`[perfiles] Error en ${nombre}:`, e.message);
      omitidos++;
    }
  }

  // ── Juntadas ──────────────────────────────────────────────────────────────────
  for (const j of db.juntadas || []) {
    const jid = normalizeId(j.id);
    try {
      await pool.query(
        `INSERT INTO juntadas (id, nombre, descripcion, fecha)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [jid, j.nombre, j.descripcion || '', j.fecha || new Date().toISOString().split('T')[0]]
      );

      for (const p of j.participantes || []) {
        const pid = normalizeId(p.id);
        await pool.query(
          `INSERT INTO juntada_participantes (id, juntada_id, nombre, iniciales, color)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [pid, jid, p.nombre, p.iniciales || '??', p.color || '#473472']
        );
      }

      for (const g of j.gastos || []) {
        const gid = normalizeId(g.id);
        await pool.query(
          `INSERT INTO juntada_gastos
             (id, juntada_id, nombre, pagador, monto, split_mode, split_subgroups, beneficiarios, ticket_photo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [gid, jid, g.nombre, g.pagador, Number(g.monto),
           g.splitMode || 'equal', g.splitSubgroups || [], g.beneficiarios || [], g.ticketPhoto || null]
        );
      }

      for (const sg of j.subgrupos || []) {
        const sgid = normalizeId(sg.id);
        await pool.query(
          `INSERT INTO juntada_subgrupos (id, juntada_id, nombre)
           VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
          [sgid, jid, sg.nombre]
        );
        for (const integrante of sg.integrantes || []) {
          await pool.query(
            `INSERT INTO subgrupo_integrantes (subgrupo_id, nombre)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [sgid, integrante]
          );
        }
      }

      for (const pd of j.pagosDeudas || []) {
        const pdid = normalizeId(pd.id || require('crypto').randomUUID());
        await pool.query(
          `INSERT INTO juntada_pagos_deudas (id, juntada_id, de, para, monto, fecha)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
          [pdid, jid, pd.de, pd.para, Number(pd.monto), pd.fecha || new Date().toISOString().split('T')[0]]
        );
      }

      insertados++;
    } catch (e) {
      console.error(`[juntadas] Error en ${jid}:`, e.message);
      omitidos++;
    }
  }

  // ── Vivienda gastos ───────────────────────────────────────────────────────────
  for (const g of (db.vivienda?.gastos || [])) {
    const gid = normalizeId(g.id || require('crypto').randomUUID());
    try {
      await pool.query(
        `INSERT INTO vivienda_gastos (id, nombre, monto, categoria, fecha, pagador, imagen_url, participantes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
        [gid, g.nombre, Number(g.monto), g.categoria, g.fecha,
         g.pagador, g.imagenUrl || null, g.participantes || []]
      );
      insertados++;
    } catch (e) {
      console.error(`[vivienda.gastos] Error en ${gid}:`, e.message);
      omitidos++;
    }
  }

  // ── Vivienda servicios ────────────────────────────────────────────────────────
  for (const s of (db.vivienda?.serviciosPeriodicos || [])) {
    const sid = normalizeId(s.id || require('crypto').randomUUID());
    try {
      await pool.query(
        `INSERT INTO vivienda_servicios (id, nombre, monto, periodicidad, proximo_vencimiento, participantes)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [sid, s.nombre, Number(s.monto), s.periodicidad, s.proximoVencimiento, s.participantes || []]
      );
      insertados++;
    } catch (e) {
      console.error(`[vivienda.servicios] Error en ${sid}:`, e.message);
      omitidos++;
    }
  }

  // ── Vivienda acuerdos ─────────────────────────────────────────────────────────
  for (const [key, a] of Object.entries(db.vivienda?.acuerdos || {})) {
    try {
      await pool.query(
        `INSERT INTO vivienda_acuerdos (id, nombre, modelo) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET nombre = $2, modelo = $3`,
        [key, a.nombre || key, a.modelo || null]
      );
      await pool.query('DELETE FROM acuerdo_participantes WHERE acuerdo_id = $1', [key]);
      for (const p of a.participantes || []) {
        await pool.query(
          'INSERT INTO acuerdo_participantes (acuerdo_id, nombre, porcentaje) VALUES ($1, $2, $3)',
          [key, p.nombre, p.porcentaje]
        );
      }
      insertados++;
    } catch (e) {
      console.error(`[vivienda.acuerdos] Error en ${key}:`, e.message);
      omitidos++;
    }
  }

  console.log(`\n✓ Seed completado: ${insertados} registros insertados, ${omitidos} omitidos/errores.`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Error fatal en seed:', err);
  process.exit(1);
});
