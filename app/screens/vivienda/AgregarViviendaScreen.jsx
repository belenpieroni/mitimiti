import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Modal, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useVivienda } from '../../context/ViviendaContext';
import { getGastosVivienda, getServiciosVivienda, guardarGastoVivienda, crearServicioVivienda } from '../../services/viviendaService';

// ─── Constants ────────────────────────────────────────────────────────────────

const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Semestral', 'Anual'];

const CATEGORIAS = [
  'Transferencias', 'Comidas y bebidas', 'Transporte', 'Impuestos',
  'Salud y cuidado personal', 'Supermercado', 'Suscripciones',
  'Hogar', 'Indumentaria', 'Shopping', 'Otras categorías',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function labelModelo(modelo) {
  const map = {
    proporcional: 'Proporcional',
    partes_iguales: 'Partes iguales',
    responsable_unico: 'Responsable único',
  };
  return map[modelo] ?? modelo;
}

function formatFecha(date) {
  if (!date) return '';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function calcularDivision(total, regla) {
  if (!regla?.participantes?.length || !total) return [];
  const { modelo, participantes } = regla;

  if (modelo === 'partes_iguales') {
    const share = total / participantes.length;
    return participantes.map(p => ({ nombre: p.nombre, monto: share }));
  }

  if (modelo === 'responsable_unico') {
    return participantes.map((p, i) => ({ nombre: p.nombre, monto: i === 0 ? total : 0 }));
  }

  const sumPct = participantes.reduce((acc, p) => acc + (Number(p.porcentaje) || 0), 0);
  if (sumPct === 0) {
    const share = total / participantes.length;
    return participantes.map(p => ({ nombre: p.nombre, monto: share }));
  }

  return participantes.map(p => ({
    nombre: p.nombre,
    monto: total * (Number(p.porcentaje) || 0) / sumPct,
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReglaCard({ regla, onEditarRegla }) {
  if (!regla) return null;
  const participantes = regla.participantes ?? [];
  const modelo = regla.modelo ?? 'partes_iguales';

  return (
    <View style={styles.reglaCard}>
      <View style={styles.reglaCardHeader}>
        <View style={styles.reglaBadge}>
          <Ionicons name="git-branch-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.reglaBadgeText}>{labelModelo(modelo)}</Text>
        </View>
        <TouchableOpacity style={styles.btnEditarRegla} onPress={onEditarRegla}>
          <Ionicons name="create-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.btnEditarReglaText}>Editar regla</Text>
        </TouchableOpacity>
      </View>
      {participantes.length === 0 ? (
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
          Sin participantes configurados
        </Text>
      ) : (
        participantes.map((p, i) => {
          let labelPct = '';
          if (modelo === 'partes_iguales') labelPct = `1/${participantes.length} (${Math.round(100 / participantes.length)}%)`;
          else if (modelo === 'responsable_unico') labelPct = i === 0 ? '100%' : '0%';
          else labelPct = `${Number(p.porcentaje) || 0}%`;
          return (
            <View key={i} style={styles.reglaRow}>
              <View style={styles.reglaPersona}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{iniciales(p.nombre ?? '')}</Text>
                </View>
                <Text style={styles.reglaPersonaNombre}>{p.nombre ?? 'Sin nombre'}</Text>
              </View>
              <Text style={styles.reglaPorcentaje}>{labelPct}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function CalculoEnTiempoReal({ monto, regla }) {
  if (!regla || !monto || monto <= 0) return null;
  const divisiones = calcularDivision(monto, regla);
  if (!divisiones.length) return null;

  return (
    <View style={styles.calculoSection}>
      <Text style={styles.calculoLabel}>CUÁNTO PAGA CADA UNO</Text>
      {divisiones.map((d, i) => (
        <View key={i} style={[styles.calculoRow, i < divisiones.length - 1 && styles.calculoRowBorder]}>
          <View style={styles.reglaPersona}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{iniciales(d.nombre)}</Text>
            </View>
            <Text style={styles.calculoNombre}>{d.nombre}</Text>
          </View>
          <Text style={styles.calculoMonto}>${Math.round(d.monto).toLocaleString('es-AR')}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Selector de fecha cross-platform ────────────────────────────────────────

function FechaVencimientoSelector({ fecha, onChange }) {
  const [mostrarPicker, setMostrarPicker] = useState(false);

  const dateValue = (fecha instanceof Date) ? fecha : new Date();

const handleChange = (event, selectedDate) => {
    // Si el usuario cancela, cerramos y no hacemos nada más
    if (event.type === 'dismissed') {
      setMostrarPicker(false);
      return;
    }

    // 2. Si hay fecha seleccionada, la guardamos
    if (selectedDate) {
      onChange(selectedDate);
    }

    // 3. Cerramos picker solo en Android
    if (Platform.OS === 'android') {
      setMostrarPicker(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
        onPress={() => {
          console.log('[FechaVencimiento] Abriendo picker...');
          setMostrarPicker(true);
        }}
      >
        {/* Usamos toLocaleDateString de forma segura */}
        <Text style={styles.inputText}>
          {dateValue.toLocaleDateString()}
        </Text>
      </TouchableOpacity>

      {/* Android: diálogo nativo */}
      {Platform.OS === 'android' && mostrarPicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {/* iOS: modal con spinner, sin absoluteFill para no interferir con el picker */}
      {Platform.OS === 'ios' && (
        <Modal visible={mostrarPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { paddingBottom: 40 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Fecha de vencimiento</Text>
                <TouchableOpacity
                  onPress={() => {
                    setMostrarPicker(false);
                    console.log('[FechaVencimiento] Modal iOS cerrado. Fecha final:', fecha?.toISOString());
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>Listo</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={fecha ?? new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={handleChange}
                style={{ width: '100%', backgroundColor: '#fff' }}
                locale="es-AR"
                textColor="#1E293B"
                themeVariant="light"
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AgregarViviendaScreen({ route, navigation }) {
  const editMode = route?.params?.editMode ?? false;
  const data = route?.params?.data ?? null;

  const { reglas } = useVivienda();

  const [esServicio, setEsServicio] = useState(true);
  const [nombre, setNombre] = useState('');
  const [montoDisplay, setMontoDisplay] = useState('');
  const [montoNumerico, setMontoNumerico] = useState(0);
  const [frecuencia, setFrecuencia] = useState('Mensual');
  const [categoria, setCategoria] = useState('Supermercado');
  const [modalCatVisible, setModalCatVisible] = useState(false);
  const [modalServicioVisible, setModalServicioVisible] = useState(false);
  const [regla, setRegla] = useState(null);
  const [pagador, setPagador] = useState('');

  // ── FECHA DE VENCIMIENTO: estado propio, separado de new Date() ───────────
  // El bug original usaba siempre new Date() al guardar en lugar del valor
  // elegido por el usuario. Ahora se inicializa en null y solo se setea
  // cuando el usuario selecciona una fecha en el picker.
 // 1. Inicialización
const [fechaVencimiento, setFechaVencimiento] = useState(new Date());
  // ── Carga en modo edición ──────────────────────────────────────────────────
  useEffect(() => {
    if (editMode && data) {
      setEsServicio(!!data.periodicidad);
      setNombre(data.nombre ?? '');
      if (data.monto) {
        setMontoDisplay(Number(data.monto).toLocaleString('es-AR'));
        setMontoNumerico(Number(data.monto));
      }
      if (data.periodicidad) {
        const p = data.periodicidad;
        setFrecuencia(p.charAt(0).toUpperCase() + p.slice(1));
      }
      if (data.categoria) setCategoria(data.categoria);
      // Al editar, pre-cargamos la fecha existente del registro
      if (data.proximoVencimiento) setFechaVencimiento(new Date(data.proximoVencimiento));
    }
  }, [editMode, data]);

  useEffect(() => {
    if (editMode && data?.nombre && reglas.length > 0) {
      const encontrada = reglas.find(
        r => r.nombre.toLowerCase().trim() === data.nombre.toLowerCase().trim()
      );
      if (encontrada) setRegla(encontrada);
    }
  }, [editMode, data, reglas]);

  const seleccionarServicio = useCallback((nombreSeleccionado) => {
    setNombre(nombreSeleccionado);
    const encontrada = reglas.find(
      r => r.nombre.toLowerCase().trim() === nombreSeleccionado.toLowerCase().trim()
    );
    setRegla(encontrada ?? null);
    setModalServicioVisible(false);
  }, [reglas]);

  const handleMontoChange = (text) => {
    const raw = text.replace(/^\$\s*/, '').replace(/\D/g, '');
    setMontoDisplay(raw ? Number(raw).toLocaleString('es-AR') : '');
    setMontoNumerico(Number(raw) || 0);
  };

  const handleEditarRegla = () => {
    Alert.alert('Editar regla', `Próximamente podrás editar la regla de "${nombre}"`);
  };

  const handleGuardar = async () => {
    console.log({ nombre, montoNumerico, esServicio, pagador, fechaVencimiento });
    if (!nombre.trim()) { Alert.alert('Error', 'Falta el nombre'); return; }
    if (montoNumerico <= 0) { Alert.alert('Error', 'El monto debe ser mayor a 0'); return; }
    // Validamos que el usuario haya elegido una fecha real en el picker
    if (esServicio && !fechaVencimiento) { Alert.alert('Error', 'Seleccioná la fecha de vencimiento'); return; }
    if (!esServicio && !pagador) { Alert.alert('Error', 'Debes seleccionar quién pagó'); return; }

    console.log("Iniciando guardado...");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      let response;

      if (esServicio) {
        const dataServicio = {
          nombre,
          monto: Number(montoNumerico),
          periodicidad: frecuencia.toLowerCase(),
          // ✅ FIX: usa la fecha elegida por el usuario, no new Date()
          proximoVencimiento: fechaVencimiento.toISOString(),
          participantes: regla?.participantes?.map(p => p.nombre) ?? [],
        };
        console.log("Enviando Servicio:", JSON.stringify(dataServicio, null, 2));
        response = await crearServicioVivienda(dataServicio);
      } else {
        const dataGasto = {
          nombre,
          monto: Number(montoNumerico),
          categoria,
          fecha: new Date().toISOString().split('T')[0],
          pagador,
          participantes: regla?.participantes?.map(p => p.nombre) ?? [],
        };
        console.log("Enviando Gasto:", JSON.stringify(dataGasto, null, 2));
        response = await guardarGastoVivienda(dataGasto);
      }

      clearTimeout(timeoutId);
      console.log("Respuesta del servidor:", response);
      Alert.alert('✅ Éxito', 'Guardado correctamente.');
      navigation.goBack();
    } catch (error) {
      if (error.name === 'AbortError') {
        Alert.alert('Error', 'El servidor tardó demasiado en responder.');
      } else {
        console.error("ERROR DETALLADO:", error.response?.data || error.message);
        Alert.alert('Error', 'El servidor rechazó los datos. Mirá la consola.');
      }
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnBack}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editMode ? (esServicio ? 'Editar Servicio' : 'Editar Gasto') : 'Nuevo gasto en vivienda'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, esServicio && styles.tabActive]}
            onPress={() => { if (!editMode) { setEsServicio(true); setNombre(''); setRegla(null); setFechaVencimiento(null); } }}
            disabled={editMode}
          >
            <Ionicons name="repeat" size={24} color={esServicio ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabTitle, esServicio && { color: '#fff' }]}>Servicio</Text>
            <Text style={[styles.tabSub, esServicio && { color: 'rgba(255,255,255,0.7)' }]}>Periódico</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, !esServicio && styles.tabActive]}
            onPress={() => { if (!editMode) { setEsServicio(false); setNombre(''); setRegla(null); setFechaVencimiento(null); } }}
            disabled={editMode}
          >
            <Ionicons name="bag" size={24} color={!esServicio ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabTitle, !esServicio && { color: '#fff' }]}>Gasto</Text>
            <Text style={[styles.tabSub, !esServicio && { color: 'rgba(255,255,255,0.7)' }]}>Puntual</Text>
          </TouchableOpacity>
        </View>

        {/* Nombre */}
        <Text style={styles.label}>{esServicio ? 'SERVICIO' : 'GASTO'}</Text>

        {esServicio ? (
          <>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => !editMode && setModalServicioVisible(true)}
              activeOpacity={editMode ? 1 : 0.7}
            >
              <Text style={{ fontSize: 16, color: nombre ? colors.textPrimary : colors.textSecondary }}>
                {nombre || 'Seleccioná un servicio...'}
              </Text>
              {!editMode && <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />}
            </TouchableOpacity>

            <Modal visible={modalServicioVisible} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalServicioVisible(false)} />
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Seleccioná un servicio</Text>
                    <TouchableOpacity onPress={() => setModalServicioVisible(false)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {reglas.length === 0 ? (
                      <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
                        <Ionicons name="document-text-outline" size={36} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                          No hay reglas configuradas.{'\n'}Creá una desde "Acuerdos" en Vivienda.
                        </Text>
                      </View>
                    ) : (
                      reglas.map((r) => {
                        const seleccionado = nombre === r.nombre;
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.catItem, seleccionado && { backgroundColor: '#F0F4FF' }]}
                            onPress={() => seleccionarServicio(r.nombre)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.catItemText, seleccionado && { color: colors.primary, fontWeight: 'bold' }]}>
                                {r.nombre}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                {labelModelo(r.modelo)} · {(r.participantes ?? []).map(p => p.nombre.split(' ')[0]).join(', ')}
                              </Text>
                            </View>
                            {seleccionado && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                          </TouchableOpacity>
                        );
                      })
                    )}
                    <TouchableOpacity
                      style={[styles.catItem, { borderBottomWidth: 0 }]}
                      onPress={() => {
                        setModalServicioVisible(false);
                        if (Alert.prompt) {
                          Alert.prompt('Otro servicio', 'Ingresá el nombre del servicio:',
                            (text) => { if (text?.trim()) seleccionarServicio(text.trim()); }
                          );
                        }
                      }}
                    >
                      <Text style={[styles.catItemText, { color: colors.textSecondary }]}>Otro (sin regla)...</Text>
                      <Ionicons name="add-circle-outline" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Ej: Super, Ferretería..."
            value={nombre}
            onChangeText={(text) => { setNombre(text); setRegla(null); }}
          />
        )}

        {/* Regla (si existe) */}
        {regla && (
          <>
            <Text style={styles.label}>DIVISIÓN APLICADA</Text>
            <ReglaCard regla={regla} onEditarRegla={handleEditarRegla} />
          </>
        )}

        {/* Monto */}
        <Text style={styles.label}>MONTO</Text>
        <TextInput
          style={styles.input}
          placeholder="$ 0"
          keyboardType="numeric"
          value={montoDisplay ? `$ ${montoDisplay}` : ''}
          onChangeText={handleMontoChange}
        />

        {/* Cálculo en tiempo real */}
        {regla && montoNumerico > 0 && (
          <CalculoEnTiempoReal monto={montoNumerico} regla={regla} />
        )}

        {/* ── FECHA DE VENCIMIENTO (solo Servicios) ── */}
        {esServicio && (
          <>
            <Text style={styles.label}>FECHA DE VENCIMIENTO</Text>
            <FechaVencimientoSelector
              fecha={fechaVencimiento}
              onChange={(nuevaFecha) => {
                setFechaVencimiento(nuevaFecha);
                console.log('[AgregarVivienda] fechaVencimiento en estado:', nuevaFecha.toISOString());
              }}
            />
          </>
        )}

        {/* Frecuencia (solo Servicios) */}
        {esServicio && (
          <>
            <Text style={styles.label}>FRECUENCIA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frecuenciaScroll}>
              {FRECUENCIAS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.frecBtn, frecuencia === f && styles.frecBtnActive]}
                  onPress={() => setFrecuencia(f)}
                >
                  <Text style={[styles.frecBtnText, frecuencia === f && styles.frecBtnTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Categoría (solo Gastos) */}
        {!esServicio && (
          <>
            <Text style={styles.label}>CATEGORÍA</Text>
            <TouchableOpacity style={styles.catSelector} onPress={() => setModalCatVisible(true)}>
              <Text style={styles.catSelectorText}>{categoria}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <Modal visible={modalCatVisible} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalCatVisible(false)} />
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Seleccioná una categoría</Text>
                    <TouchableOpacity onPress={() => setModalCatVisible(false)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView>
                    {CATEGORIAS.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.catItem, categoria === cat && { backgroundColor: '#F0F4FF' }]}
                        onPress={() => { setCategoria(cat); setModalCatVisible(false); }}
                      >
                        <Text style={[styles.catItemText, categoria === cat && { color: colors.primary, fontWeight: 'bold' }]}>
                          {cat}
                        </Text>
                        {categoria === cat && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </>
        )}

        {/* Pagador (solo Gastos) */}
        {!esServicio && (
          <>
            <Text style={styles.label}>¿QUIÉN PAGÓ?</Text>
            {regla?.participantes?.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {regla.participantes.map((p) => {
                  const seleccionado = pagador === p.nombre;
                  return (
                    <TouchableOpacity
                      key={p.nombre}
                      style={[styles.frecBtn, seleccionado && styles.frecBtnActive]}
                      onPress={() => setPagador(p.nombre)}
                    >
                      <Text style={[styles.frecBtnText, seleccionado && styles.frecBtnTextActive]}>
                        {p.nombre.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Nombre de quien pagó..."
                value={pagador}
                onChangeText={setPagador}
              />
            )}
          </>
        )}

        {/* Guardar */}
        <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardar}>
          <Text style={styles.btnGuardarText}>{editMode ? 'Actualizar' : 'Guardar'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  header:           { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
  btnBack:          { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle:      { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  scroll:           { padding: 20, paddingBottom: 60 },

  tabsRow:          { flexDirection: 'row', gap: 12, marginBottom: 24 },
  tab:              { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#ddd' },
  tabActive:        { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  tabTitle:         { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginTop: 8 },
  tabSub:           { fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  label:            { fontSize: 12, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input:            { backgroundColor: '#fff', padding: 16, borderRadius: 12, fontSize: 16, color: colors.textPrimary },

  reglaCard:        { backgroundColor: '#eef3f6', borderRadius: 12, borderWidth: 1, borderColor: '#b8d0dc', padding: 14 },
  reglaCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reglaBadge:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reglaBadgeText:   { fontSize: 12, fontWeight: 'bold', color: colors.textSecondary },
  btnEditarRegla:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: '#b8d0dc' },
  btnEditarReglaText:{ fontSize: 12, color: colors.textSecondary },
  reglaRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  reglaPersona:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reglaPersonaNombre:{ fontSize: 13, color: colors.textPrimary },
  reglaPorcentaje:  { fontSize: 12, color: colors.textSecondary },

  avatar:           { width: 24, height: 24, borderRadius: 12, backgroundColor: '#b8d0dc', justifyContent: 'center', alignItems: 'center' },
  avatarText:       { fontSize: 9, fontWeight: 'bold', color: '#4a6a7c' },

  calculoSection:   { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', marginTop: 8, overflow: 'hidden' },
  calculoLabel:     { fontSize: 11, fontWeight: 'bold', color: colors.textSecondary, padding: 12, paddingBottom: 4 },
  calculoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 },
  calculoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  calculoNombre:    { fontSize: 14, color: colors.textPrimary },
  calculoMonto:     { fontSize: 15, fontWeight: 'bold', color: colors.textPrimary },

  frecuenciaScroll: { flexDirection: 'row', marginTop: 4 },
  frecBtn:          { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: '#eee' },
  frecBtnActive:    { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  frecBtnText:      { color: colors.textPrimary, fontWeight: 'bold' },
  frecBtnTextActive:{ color: '#fff' },

  catSelector:      { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catSelectorText:  { fontSize: 16, color: colors.textPrimary },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:       { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  catItem:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  catItemText:      { fontSize: 16, color: colors.textPrimary },

  btnGuardar:       { backgroundColor: colors.textSecondary, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 40 },
  btnGuardarText:   { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
