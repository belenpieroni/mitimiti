-- Miti Miti — Schema PostgreSQL
-- Ejecutado automáticamente por db.js en cada arranque (idempotente).

-- Usuarios y auth
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  iniciales TEXT NOT NULL DEFAULT '',
  juntadas INT NOT NULL DEFAULT 0,
  servicios INT NOT NULL DEFAULT 0,
  viajes INT NOT NULL DEFAULT 0,
  notif_nuevos_gastos BOOLEAN NOT NULL DEFAULT TRUE,
  notif_recordatorios_vencimiento BOOLEAN NOT NULL DEFAULT TRUE,
  notif_nuevas_juntadas BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuario_device_tokens (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, token)
);

-- Perfiles (alias/CBU por nombre de participante)
CREATE TABLE IF NOT EXISTS perfiles (
  nombre TEXT PRIMARY KEY,
  alias TEXT NOT NULL DEFAULT ''
);

-- Juntadas
CREATE TABLE IF NOT EXISTS juntadas (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  creador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha DATE NOT NULL,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE juntadas
  ADD COLUMN IF NOT EXISTS creador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS juntada_participantes (
  id UUID PRIMARY KEY,
  juntada_id UUID NOT NULL REFERENCES juntadas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  iniciales TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#473472'
);

CREATE TABLE IF NOT EXISTS juntada_gastos (
  id UUID PRIMARY KEY,
  juntada_id UUID NOT NULL REFERENCES juntadas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  pagador TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  split_mode TEXT NOT NULL DEFAULT 'equal',
  split_subgroups TEXT[] NOT NULL DEFAULT '{}',
  beneficiarios TEXT[] NOT NULL DEFAULT '{}',
  ticket_photo TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS juntada_pagos_deudas (
  id UUID PRIMARY KEY,
  juntada_id UUID NOT NULL REFERENCES juntadas(id) ON DELETE CASCADE,
  de TEXT NOT NULL,
  para TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS juntada_subgrupos (
  id UUID PRIMARY KEY,
  juntada_id UUID NOT NULL REFERENCES juntadas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  integrantes UUID[] NOT NULL DEFAULT '{}'
);

-- Vivienda
CREATE TABLE IF NOT EXISTS viviendas (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  creador_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vivienda_miembros (
  vivienda_id UUID NOT NULL REFERENCES viviendas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vivienda_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS vivienda_gastos (
  id UUID PRIMARY KEY,
  vivienda_id UUID REFERENCES viviendas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  categoria TEXT NOT NULL,
  fecha DATE NOT NULL,
  pagador TEXT NOT NULL,
  imagen_url TEXT,
  participantes TEXT[] NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vivienda_servicios (
  id UUID PRIMARY KEY,
  vivienda_id UUID REFERENCES viviendas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  periodicidad TEXT NOT NULL,
  proximo_vencimiento DATE NOT NULL,
  participantes TEXT[] NOT NULL DEFAULT '{}',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tokens de invitación
CREATE TABLE IF NOT EXISTS invitation_tokens (
  token UUID PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'juntada',
  recurso_id UUID NOT NULL,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE TABLE IF NOT EXISTS vivienda_acuerdos (
  id TEXT PRIMARY KEY,
  vivienda_id UUID REFERENCES viviendas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  modelo TEXT NOT NULL DEFAULT 'proporcional'
);

ALTER TABLE vivienda_gastos
  ADD COLUMN IF NOT EXISTS vivienda_id UUID REFERENCES viviendas(id) ON DELETE CASCADE;

ALTER TABLE vivienda_servicios
  ADD COLUMN IF NOT EXISTS vivienda_id UUID REFERENCES viviendas(id) ON DELETE CASCADE;

ALTER TABLE vivienda_acuerdos
  ADD COLUMN IF NOT EXISTS vivienda_id UUID REFERENCES viviendas(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS acuerdo_participantes (
  acuerdo_id TEXT NOT NULL REFERENCES vivienda_acuerdos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  porcentaje NUMERIC(5,2) NOT NULL,
  PRIMARY KEY (acuerdo_id, nombre)
);

-- Tracking de recordatorios enviados por cron
CREATE TABLE IF NOT EXISTS notificacion_recordatorios_enviados (
  id BIGSERIAL PRIMARY KEY,
  servicio_id UUID NOT NULL,
  fecha_recordatorio DATE NOT NULL,
  enviado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (servicio_id, fecha_recordatorio)
);

-- Historial de notificaciones para mostrar en la app
CREATE TABLE IF NOT EXISTS notificaciones_usuario (
  id UUID PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'general',
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_usuario_creada
  ON notificaciones_usuario (usuario_id, creada_en DESC);

-- Agrega la columna de integrantes
ALTER TABLE juntada_subgrupos 
  ADD COLUMN IF NOT EXISTS integrantes UUID[] NOT NULL DEFAULT '{}';

-- Elimina la tabla intermedia vieja
DROP TABLE IF EXISTS subgrupo_integrantes;