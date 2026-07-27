import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Modal, Platform, KeyboardAvoidingView, Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useVivienda } from '../../context/ViviendaContext';
import { 
  getGastosVivienda, getServiciosVivienda, guardarGastoVivienda, crearServicioVivienda,
  actualizarGastoVivienda, actualizarServicioVivienda, getMiVivienda
} from '../../services/viviendaService';
import { useAuth } from '../../context/AuthContext';


const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Semestral', 'Anual'];

const CATEGORIAS = [
  'Transferencias', 'Comidas y bebidas', 'Transporte', 'Impuestos',
  'Salud y cuidado personal', 'Supermercado', 'Suscripciones',
  'Hogar', 'Indumentaria', 'Shopping', 'Otras categorías',
];

const SERVICIOS_OPCIONES = [
  'Agua', 'Luz', 'Gas', 'Internet', 'Netflix', 'Expensas', 'Limpieza', 'Otro'
];

const coloresDisponibles = [
  '#473472', '#526D82', '#9DB2BF', '#42b271',
  '#c084fc', '#f97316', '#ec6c6a', '#38bdf8',
];


function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function getIniciales(nombre) {
  if (typeof nombre !== 'string') return '??';
  const partes = nombre.trim().split(' ');
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}

function getColorByNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return coloresDisponibles[Math.abs(hash) % coloresDisponibles.length];
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
    const pct = `${Math.round(100 / participantes.length)}%`;
    return participantes.map(p => ({ nombre: p.nombre, monto: share, pctLabel: pct }));
  }

  if (modelo === 'responsable_unico') {
    return participantes.map((p, i) => ({ nombre: p.nombre, monto: i === 0 ? total : 0, pctLabel: i === 0 ? '100%' : '0%' }));
  }

  const sumPct = participantes.reduce((acc, p) => acc + (Number(p.porcentaje) || 0), 0);
  if (sumPct === 0) {
    const share = total / participantes.length;
    const pct = `${Math.round(100 / participantes.length)}%`;
    return participantes.map(p => ({ nombre: p.nombre, monto: share, pctLabel: pct }));
  }

  return participantes.map(p => ({
    nombre: p.nombre,
    monto: total * (Number(p.porcentaje) || 0) / sumPct,
    pctLabel: `${Number(p.porcentaje) || 0}%`
  }));
}


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
        {onEditarRegla && (
          <TouchableOpacity style={styles.btnEditarRegla} onPress={onEditarRegla}>
            <Ionicons name="create-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.btnEditarReglaText}>Editar regla</Text>
          </TouchableOpacity>
        )}
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
    <View style={{ marginTop: 16 }}>
      {divisiones.map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.avatar, { width: 28, height: 28, marginRight: 10 }]}>
              <Text style={[styles.avatarText, { fontSize: 11 }]}>{iniciales(d.nombre)}</Text>
            </View>
            <Text style={{ fontSize: 15, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{d.nombre}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 80, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginRight: 12 }}>{d.pctLabel}</Text>
            <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '500' }}>
              ${Math.round(d.monto).toLocaleString('es-AR')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function CalculoGastoPuntualEnTiempoReal({ total, participantes }) {
  if (!total || total <= 0 || !participantes.length) return null;
  const share = total / participantes.length;
  const pct = `${Math.round(100 / participantes.length)}%`;

  return (
    <View style={{ marginTop: 16 }}>
      {participantes.map((nombre, i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.avatar, { width: 28, height: 28, marginRight: 10, backgroundColor: getColorByNombre(nombre) }]}>
              <Text style={[styles.avatarText, { fontSize: 11, color: '#fff' }]}>{getIniciales(nombre)}</Text>
            </View>
            <Text style={{ fontSize: 15, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{nombre}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 80, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginRight: 12 }}>{pct}</Text>
            <Text style={{ fontSize: 16, color: colors.textPrimary, fontWeight: '500' }}>
              ${Math.round(share).toLocaleString('es-AR')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}


function FechaVencimientoSelector({ fecha, onChange }) {
  const [mostrarPicker, setMostrarPicker] = useState(false);

  const dateValue = (fecha instanceof Date) ? fecha : new Date();

const handleChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setMostrarPicker(false);
      return;
    }

    if (selectedDate) {
      onChange(selectedDate);
    }

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
        
        <Text style={styles.inputText}>
          {dateValue.toLocaleDateString()}
        </Text>
      </TouchableOpacity>

      
      {Platform.OS === 'android' && mostrarPicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      
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

export default function AgregarViviendaScreen({ route, navigation }) {
  const editMode = route?.params?.editMode ?? false;
  const data = route?.params?.data ?? null;

  const { reglas } = useVivienda();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [esServicio, setEsServicio] = useState(true);
  const [nombre, setNombre] = useState('');
  const [montoDisplay, setMontoDisplay] = useState('');
  const [montoNumerico, setMontoNumerico] = useState(0);
  const [frecuencia, setFrecuencia] = useState('Mensual');
  const [categoria, setCategoria] = useState('Supermercado');
  const [modalCatVisible, setModalCatVisible] = useState(false);
  const [modalServicioVisible, setModalServicioVisible] = useState(false);
  const [modalAcuerdosVisible, setModalAcuerdosVisible] = useState(false);
  const [acuerdoId, setAcuerdoId] = useState(null);
  const [regla, setRegla] = useState(null);
  const [pagador, setPagador] = useState('');
  const [isVariable, setIsVariable] = useState(false);
  const [esOtroServicio, setEsOtroServicio] = useState(false);

  const [miembrosVivienda, setMiembrosVivienda] = useState([]);
  const [participantesGasto, setParticipantesGasto] = useState([]);

  const [fechaVencimiento, setFechaVencimiento] = useState(new Date());

  useEffect(() => {
    async function loadVivienda() {
      try {
        const mv = await getMiVivienda();
        if (mv && mv.miembros) {
          const names = mv.miembros.map(m => m.name);
          setMiembrosVivienda(names);
          if (!editMode && !esServicio) {
            setParticipantesGasto(names);
            const defaultPagador = (user && user.name && names.includes(user.name)) 
              ? user.name 
              : (names[0] || '');
            setPagador(defaultPagador);
          }
        }
      } catch (e) {
        console.error('Error al cargar miembros de vivienda:', e);
      }
    }
    loadVivienda();
  }, [editMode, esServicio, user]);

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
      if (data.proximoVencimiento) setFechaVencimiento(new Date(data.proximoVencimiento));
      if (data.acuerdoId) setAcuerdoId(data.acuerdoId);
      setIsVariable(!!(data.isVariable || data.is_variable));
      if (data.pagador) setPagador(data.pagador);
      if (data.participantes) setParticipantesGasto(data.participantes);
    }
  }, [editMode, data]);

  useEffect(() => {
    if (editMode && data && reglas.length > 0) {
      const targetId = data.acuerdoId || data.acuerdo_id;
      if (targetId) {
        const encontrada = reglas.find(r => r.id === targetId);
        if (encontrada) {
          setRegla(encontrada);
          setAcuerdoId(encontrada.id);
        }
      }
    }
  }, [editMode, data, reglas]);

  useEffect(() => {
    if (!esServicio && pagador && !participantesGasto.includes(pagador)) {
      setPagador('');
    }
  }, [participantesGasto, pagador, esServicio]);

  const seleccionarAcuerdo = useCallback((idAcuerdo) => {
    setAcuerdoId(idAcuerdo);
    const encontrada = reglas.find(r => r.id === idAcuerdo);
    setRegla(encontrada ?? null);
    setModalAcuerdosVisible(false);
  }, [reglas]);

  const seleccionarServicio = useCallback((nombreSeleccionado) => {
    setEsOtroServicio(false);
    setNombre(nombreSeleccionado);
    setModalServicioVisible(false);
  }, []);

  const handleMontoChange = (text) => {
    const raw = text.replace(/^\$\s*/, '').replace(/\D/g, '');
    setMontoDisplay(raw ? Number(raw).toLocaleString('es-AR') : '');
    setMontoNumerico(Number(raw) || 0);
  };

  const handleGuardar = async () => {
    console.log('[AgregarViviendaScreen] handleGuardar click event triggered!');
    console.log('[AgregarViviendaScreen] Form state - esServicio:', esServicio);
    console.log('[AgregarViviendaScreen] Form state - nombre:', nombre);
    console.log('[AgregarViviendaScreen] Form state - montoNumerico:', montoNumerico);
    console.log('[AgregarViviendaScreen] Form state - pagador:', pagador);
    console.log('[AgregarViviendaScreen] Form state - participantesGasto:', participantesGasto);
    console.log('[AgregarViviendaScreen] Form state - acuerdoId:', acuerdoId);

    if (esServicio && !acuerdoId) {
      console.log('[AgregarViviendaScreen] Validation failed: Service requires an agreement');
      Alert.alert('Error', 'Debes seleccionar un acuerdo para continuar');
      return;
    }
    if (!nombre.trim()) {
      console.log('[AgregarViviendaScreen] Validation failed: Empty name');
      Alert.alert('Error', 'Falta el nombre del servicio/gasto');
      return;
    }
    if (!isVariable && montoNumerico <= 0) {
      console.log('[AgregarViviendaScreen] Validation failed: Amount <= 0');
      Alert.alert('Error', 'El monto debe ser mayor a 0');
      return;
    }
    if (esServicio && !fechaVencimiento) {
      console.log('[AgregarViviendaScreen] Validation failed: Service requires due date');
      Alert.alert('Error', 'Seleccioná la fecha de vencimiento');
      return;
    }
    if (!esServicio && !pagador) {
      console.log('[AgregarViviendaScreen] Validation failed: Expense requires a payer');
      Alert.alert('Error', 'Debes seleccionar quién pagó');
      return;
    }
    if (!esServicio && (!participantesGasto || !participantesGasto.length)) {
      console.log('[AgregarViviendaScreen] Validation failed: Expense requires at least 1 participant');
      Alert.alert('Error', 'Debes seleccionar al menos un participante para dividir el gasto.');
      return;
    }

    setIsSaving(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[AgregarViviendaScreen] Request timed out. Aborting fetch call...');
      controller.abort();
    }, 8000);

    try {
      let response;

      if (esServicio) {
        const dataServicio = {
          acuerdoId,
          nombreServicio: nombre,
          monto: isVariable ? null : Number(montoNumerico),
          frecuencia: frecuencia,
          proximoVencimiento: fechaVencimiento.toISOString(),
          isVariable,
        };
        console.log('[AgregarViviendaScreen] Dispatching crear/actualizar servicio:', dataServicio);
        if (editMode) {
          response = await actualizarServicioVivienda(data.id, dataServicio, { signal: controller.signal });
        } else {
          response = await crearServicioVivienda(dataServicio, { signal: controller.signal });
        }
      } else {
        const dataGasto = {
          acuerdoId: null,
          nombreServicio: nombre,
          monto: Number(montoNumerico),
          categoria,
          fecha: new Date().toISOString().split('T')[0],
          pagador,
          participantes: participantesGasto,
        };
        console.log('[AgregarViviendaScreen] Dispatching crear/actualizar gasto:', dataGasto);
        if (editMode) {
          response = await actualizarGastoVivienda(data.id, dataGasto, { signal: controller.signal });
        } else {
          response = await guardarGastoVivienda(dataGasto, { signal: controller.signal });
        }
      }

      console.log('[AgregarViviendaScreen] Save operation succeeded! Response:', response);
      clearTimeout(timeoutId);
      Alert.alert('✅ Éxito', 'Guardado correctamente.');
      navigation.goBack();
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("[AgregarViviendaScreen] ERROR DETALLADO:", error.response?.data || error.message || error);
      if (error.name === 'AbortError') {
        Alert.alert('Error', 'El servidor tardó demasiado en responder.');
      } else {
        Alert.alert('Error', error.message || 'El servidor rechazó los datos. Mirá la consola.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnBack}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editMode ? (esServicio ? 'Editar Servicio' : 'Editar Gasto') : 'Nuevo gasto en vivienda'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        
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

        
        {esServicio && (
          <>
            <Text style={styles.label}>ACUERDO ASOCIADO</Text>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setModalAcuerdosVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16, color: acuerdoId ? colors.textPrimary : colors.textSecondary }}>
                {regla?.nombre || 'Seleccioná un acuerdo...'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </>
        )}



        
        <Modal visible={modalAcuerdosVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalAcuerdosVisible(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccioná un acuerdo</Text>
                <TouchableOpacity onPress={() => setModalAcuerdosVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                {reglas.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
                    <Ionicons name="document-text-outline" size={36} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                      No hay acuerdos configurados.{'\n'}Creá uno desde "Acuerdos" en Vivienda.
                    </Text>
                  </View>
                ) : (
                  reglas.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.catItem, acuerdoId === r.id && { backgroundColor: '#F0F4FF' }]}
                      onPress={() => seleccionarAcuerdo(r.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.catItemText, acuerdoId === r.id && { color: colors.primary, fontWeight: 'bold' }]}>
                          {r.nombre}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                          {labelModelo(r.modelo)} · {(r.participantes ?? []).map(p => p.nombre.split(' ')[0]).join(', ')}
                        </Text>
                      </View>
                      {acuerdoId === r.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        
        <Text style={styles.label}>{esServicio ? 'SERVICIO' : 'GASTO'}</Text>

        {esServicio ? (
          <>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setModalServicioVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 16, color: (nombre || esOtroServicio) ? colors.textPrimary : colors.textSecondary }}>
                {esOtroServicio ? 'Otro servicio (escribí abajo)' : (nombre || 'Seleccioná un servicio...')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            {esOtroServicio && (
              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Escribí el nombre del servicio..."
                value={nombre}
                onChangeText={setNombre}
                autoFocus
              />
            )}

            <Modal visible={modalServicioVisible} transparent animationType="slide">
              <View style={styles.modalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalServicioVisible(false)} />
                <View style={styles.modalSheet}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Tipo de servicio</Text>
                    <TouchableOpacity onPress={() => setModalServicioVisible(false)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {SERVICIOS_OPCIONES.map((srv) => {
                      if (srv === 'Otro') return null;
                      const seleccionado = nombre === srv;
                      return (
                        <TouchableOpacity
                          key={srv}
                          style={[styles.catItem, seleccionado && { backgroundColor: '#F0F4FF' }]}
                          onPress={() => seleccionarServicio(srv)}
                        >
                          <Text style={[styles.catItemText, seleccionado && { color: colors.primary, fontWeight: 'bold' }]}>
                            {srv}
                          </Text>
                          {seleccionado && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={[styles.catItem, { borderBottomWidth: 0 }]}
                      onPress={() => {
                        setEsOtroServicio(true);
                        setNombre('');
                        setModalServicioVisible(false);
                      }}
                    >
                      <Text style={[styles.catItemText, { color: colors.textSecondary }]}>Otro (personalizado)...</Text>
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
            onChangeText={setNombre}
          />
        )}

        
        <Text style={styles.label}>MONTO</Text>
        {esServicio && (
          <View style={[
            styles.switchRow,
            {
              borderWidth: 1,
              borderRadius: 8,
              padding: 16,
              borderColor: isVariable ? '#E65100' : '#E0E0E0',
              backgroundColor: isVariable ? 'rgba(230, 81, 0, 0.05)' : '#fff'
            }
          ]}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.switchLabel}>Importe variable</Text>
              <Text style={styles.switchHint}>
                {isVariable 
                  ? 'El monto se cargará cuando llegue la factura.' 
                  : 'Activar si el importe varía por período.'}
              </Text>
            </View>
            <Switch
              value={isVariable}
              onValueChange={setIsVariable}
              trackColor={{ false: '#D1D5DB', true: '#E65100' }}
              thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (isVariable ? '#E65100' : '#f4f3f4')}
            />
          </View>
        )}
        {esServicio && isVariable && (
          <View style={styles.variableBanner}>
            <Ionicons name="information-circle-outline" size={20} color="#E65100" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.variableBannerTitle}>Servicio de importe variable</Text>
              <Text style={styles.variableBannerSub}>
                El monto y comprobante se cargarán desde la pantalla de servicios, cuando llegue la boleta.
              </Text>
            </View>
          </View>
        )}
        {!(isVariable && esServicio) && (
          <TextInput
            style={[styles.input]}
            placeholder='$ 0'
            keyboardType="numeric"
            value={montoDisplay ? `$ ${montoDisplay}` : ''}
            onChangeText={handleMontoChange}
          />
        )}

        
        {!esServicio && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>PARTICIPANTES DEL GASTO</Text>
            <View style={styles.integrantesRow}>
              {participantesGasto.map((nombre, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    setParticipantesGasto(prev => prev.filter(n => n !== nombre));
                  }}
                  style={styles.avatarWrapper}
                >
                  <View style={[styles.avatarForm, { backgroundColor: getColorByNombre(nombre) }]}>
                    <Text style={styles.avatarFormTexto}>{getIniciales(nombre)}</Text>
                  </View>
                  <View style={styles.avatarRemoveBadge}>
                    <Ionicons name="remove" size={10} color="#fff" />
                  </View>
                  <Text style={styles.avatarNombre} numberOfLines={1}>{nombre.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
              {miembrosVivienda
                .filter(nombre => !participantesGasto.includes(nombre))
                .map((nombre, i) => (
                  <TouchableOpacity
                    key={`excluido-${i}`}
                    onPress={() => {
                      setParticipantesGasto(prev => [...prev, nombre]);
                    }}
                    style={styles.avatarWrapper}
                  >
                    <View style={styles.avatarAdd}>
                      <Ionicons name="add" size={20} color={colors.textSecondary} />
                    </View>
                    <Text style={styles.avatarNombre} numberOfLines={1}>{nombre.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        )}

        
        {esServicio && regla && montoNumerico > 0 && (
          <CalculoEnTiempoReal monto={montoNumerico} regla={regla} />
        )}
        {!esServicio && montoNumerico > 0 && (
          <CalculoGastoPuntualEnTiempoReal total={montoNumerico} participantes={participantesGasto} />
        )}

        
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

        
        {!esServicio && (
          <>
            <Text style={styles.label}>¿QUIÉN PAGÓ?</Text>
            {participantesGasto.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {participantesGasto.map((nombre) => {
                  const seleccionado = pagador === nombre;
                  return (
                    <TouchableOpacity
                      key={nombre}
                      style={[styles.frecBtn, seleccionado && styles.frecBtnActive]}
                      onPress={() => setPagador(nombre)}
                    >
                      <Text style={[styles.frecBtnText, seleccionado && styles.frecBtnTextActive]}>
                        {nombre.split(' ')[0]}
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

        
        <TouchableOpacity 
          style={[styles.btnGuardar, isSaving && { opacity: 0.6 }]} 
          onPress={handleGuardar}
          disabled={isSaving}
        >
          <Text style={styles.btnGuardarText}>
            {isSaving ? 'Guardando...' : (editMode ? 'Actualizar' : 'Guardar')}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  header:           { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
  btnBack:          { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle:      { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  scroll:           { padding: 20, paddingBottom: 140 },

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

  participantesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  participanteChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF3F8', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  participanteChipText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  participanteInputRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  btnAddParticipante: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.textSecondary, justifyContent: 'center', alignItems: 'center' },

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

  switchRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF8F0', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#FFE0B2' },
  switchLabel:      { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  switchHint:       { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  inputDisabled:    { backgroundColor: '#F0F0F0', color: '#aaa' },

  integrantesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', width: '100%', marginTop: 8 },
  avatarWrapper: { alignItems: 'center', position: 'relative', width: 52 },
  avatarForm: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarFormTexto: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  avatarNombre: { fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center', maxWidth: 52 },
  avatarRemoveBadge: { position: 'absolute', top: -2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ec6c6a', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  avatarAdd: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textSecondary, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center' },

  variableBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCC80',
    padding: 14,
    marginTop: 12,
  },
  variableBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 3,
  },
  variableBannerSub: {
    fontSize: 12,
    color: '#BF360C',
    lineHeight: 17,
  },

  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
    marginTop: 8,
  },
  attachmentBtn: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderWidth: 1.5,
    borderColor: '#E4E7EC',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  attachmentBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  attachmentBtnSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  attachmentPreviewText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 8,
  },
});
