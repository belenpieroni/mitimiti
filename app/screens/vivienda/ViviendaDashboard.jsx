import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Alert, // <--- Aquí agregamos Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useVivienda } from '../../context/ViviendaContext';
import { useFocusEffect } from '@react-navigation/native';
import { getGastosVivienda, getServiciosVivienda, eliminarAcuerdoReparto, eliminarServicioVivienda } from '../../services/viviendaService';
// ─── Colores para Avatares ────────────────────────────────────────────────────
const coloresDisponibles = [
  '#473472', '#526D82', '#9DB2BF', '#42b271',
  '#c084fc', '#f97316', '#ec6c6a', '#38bdf8',
];

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

function AvatarStack({ personas = [] }) {
  const visibles = personas.slice(0, 4);
  const extras = personas.length - 4;
  return (
    <View style={styles.avatarStack}>
      {visibles.map((p, i) => (
        <View key={i} style={[styles.avatar, { backgroundColor: getColorByNombre(p), marginLeft: i === 0 ? 0 : -8 }]}>
          <Text style={styles.avatarTexto}>{getIniciales(p)}</Text>
        </View>
      ))}
      {extras > 0 && (
        <View style={[styles.avatar, { backgroundColor: colors.textSecondary, marginLeft: -8 }]}>
          <Text style={styles.avatarTexto}>+{extras}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Mapa de íconos por nombre de servicio ────────────────────────────────────
const ICONS_MAP = {
  'Netflix': 'tv-outline',
  'Spotify': 'musical-notes-outline',
  'Factura de Luz': 'flash-outline',
  'Internet / Fibra': 'wifi-outline',
  'Agua': 'water-outline',
  'Otro': 'receipt-outline',
};

const GASTO_ICONS_MAP = {
  'Supermercado': 'cart-outline',
  'Comidas y bebidas': 'restaurant-outline',
  'Transporte': 'car-outline',
  'Impuestos': 'document-text-outline',
  'Salud y cuidado personal': 'medkit-outline',
  'Suscripciones': 'albums-outline',
  'Hogar': 'home-outline',
  'Indumentaria': 'shirt-outline',
  'Shopping': 'bag-outline',
  'Transferencias': 'swap-horizontal-outline',
  'Otras categorías': 'pricetag-outline',
};

// ─── Mapa de modelo (string) → { label, icon } ───────────────────────────────
const MODELO_MAP = {
  proporcional:      { label: 'Proporcional',   icon: 'bar-chart-outline' },
  partes_iguales:    { label: 'Partes iguales', icon: 'scale-outline' },
  responsable_unico: { label: 'Resp. único',    icon: 'person-outline' },
};

// ─── Opciones del dropdown de categorías ─────────────────────────────────────
const CATEGORIAS = [
  { label: 'Agua',             icon: 'water-outline' },
  { label: 'Factura de Luz',   icon: 'flash-outline' },
  { label: 'Internet / Fibra', icon: 'wifi-outline' },
  { label: 'Netflix',          icon: 'tv-outline' },
  { label: 'Spotify',          icon: 'musical-notes-outline' },
  { label: 'Otro',             icon: 'receipt-outline' },
];

// ─── Modelos de división ──────────────────────────────────────────────────────
const MODELOS = [
  { label: 'Partes iguales', icon: 'scale-outline',     value: 'partes_iguales' },
  { label: 'Proporcional',   icon: 'bar-chart-outline', value: 'proporcional' },
  { label: 'Resp. único',    icon: 'person-outline',    value: 'responsable_unico' },
];

// ─── Estado inicial del formulario ────────────────────────────────────────────
const INTEGRANTES_DEFAULT = ['Martín Alves'];

const buildFormInicial = () => ({
  integrantes: INTEGRANTES_DEFAULT,
  categoria: CATEGORIAS[0],
  modeloIdx: 0,
  categoriaCustom: '',
  proporcional: Object.fromEntries(
    INTEGRANTES_DEFAULT.map(n => [n, { sueldo: '', porcentaje: '' }])
  ),
});

export default function ViviendaDashboard({ navigation }) {
  const [gastos, setGastos]       = useState([]);
  const [servicios, setServicios] = useState([]);
  const [vistaActiva, setVistaActiva] = useState('servicios');
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);

  // Modal Acuerdos
  const [modalAcuerdosVisible, setModalAcuerdosVisible] = useState(false);
  const [vistaFormulario, setVistaFormulario] = useState(false);
  const { reglas, agregarRegla, recargar } = useVivienda();

  // Formulario "Nueva Regla"
  const [form, setForm]                         = useState(buildFormInicial());
  const [nuevoIntegrante, setNuevoIntegrante]   = useState('');
  const [mostrarInputIntegrante, setMostrarInputIntegrante] = useState(false);
  const [dropdownAbierto, setDropdownAbierto]   = useState(false);

  const [cargando, setCargando] = useState(true);

  // ── Data ──────────────────────────────────────────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      cargarData();
      recargar();
    }, [recargar])
  );

  const cargarData = async () => {
    try {
      const gastosData    = await getGastosVivienda();
      const serviciosData = await getServiciosVivienda();
      setGastos(gastosData || []);
      setServicios(serviciosData || []);
    } catch (error) {
      console.error(error);
    }
  };

 const totalMes = (gastos || []).reduce((sum, g) => sum + (g.monto || 0), 0);

  const renderDiasParaVencer = (isoDate) => {
    const diff = new Date(isoDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Vencido';
    if (days === 0) return 'Vence hoy';
    return `Vence en ${days} días`;
  };

  // ── Handlers: Integrantes ─────────────────────────────────────────────────
  const agregarIntegrante = () => {
    const nombre = nuevoIntegrante.trim();
    if (!nombre) return;
    setForm(f => ({
      ...f,
      integrantes: [...f.integrantes, nombre],
      proporcional: { ...f.proporcional, [nombre]: { sueldo: '', porcentaje: '' } },
    }));
    setNuevoIntegrante('');
    setMostrarInputIntegrante(false);
  };

  const quitarIntegrante = (idx) => {
    setForm(f => {
      const nuevos = f.integrantes.filter((_, i) => i !== idx);
      const nuevoProp = { ...f.proporcional };
      delete nuevoProp[f.integrantes[idx]];
      return { ...f, integrantes: nuevos, proporcional: nuevoProp };
    });
  };

  // ── Handlers: Categoría ───────────────────────────────────────────────────
  const seleccionarCategoria = (cat) => {
    setForm(f => ({ ...f, categoria: cat, categoriaCustom: '' }));
    setDropdownAbierto(false);
  };

  // ── Handlers: Proporcional ────────────────────────────────────────────────
  const updateProporcional = (nombre, campo, valor) => {
    setForm(f => ({
      ...f,
      proporcional: {
        ...f.proporcional,
        [nombre]: { ...f.proporcional[nombre], [campo]: valor },
      },
    }));
  };

  // ── Handlers: Modal Acuerdos ──────────────────────────────────────────────
  const cerrarModalAcuerdos = () => {
    setModalAcuerdosVisible(false);
    setVistaFormulario(false);
    setForm(buildFormInicial());
    setNuevoIntegrante('');
    setMostrarInputIntegrante(false);
    setDropdownAbierto(false);
  };

  const abrirFormulario = () => {
    setForm(buildFormInicial());
    setDropdownAbierto(false);
    setVistaFormulario(true);
  };

const guardarRegla = async () => {
  const nombreCategoria = form.categoria.label === 'Otro' && form.categoriaCustom.trim() 
    ? form.categoriaCustom.trim() : form.categoria.label;
  
  const modeloValue = MODELOS[form.modeloIdx].value;

  const nuevaRegla = {
    id: Date.now().toString(),
    nombre: nombreCategoria,
    modelo: modeloValue,
    // AQUÍ CORREGIMOS: calculamos el porcentaje y lo guardamos siempre
    participantes: form.integrantes.map(nombre => {
      let pct = 0;
      if (form.modeloIdx === 1) { // Proporcional
        pct = Number(form.proporcional[nombre]?.porcentaje ?? 0);
      } else if (form.modeloIdx === 0) { // Partes iguales
        pct = Math.round(100 / form.integrantes.length);
      } else { // Responsable único
        pct = 100;
      }
      return { nombre, porcentaje: pct };
    }),
  };
  await agregarRegla(nuevaRegla);  // esto ya hace refetch interno
  setVistaFormulario(false);        // volvés a la lista, que ya tiene reglas actualizadas
  setForm(buildFormInicial());
  setDropdownAbierto(false);
};


  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>Casa compartida</Text>
        <View style={styles.headerRow}>
          <Text style={styles.mainTitle}>Vivienda</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.btnAcuerdos} onPress={() => setModalAcuerdosVisible(true)}>
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.btnAcuerdosText}>Acuerdos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGasto} onPress={() => navigation.navigate('AgregarVivienda')}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.btnGastoText}>Gasto</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.totalCard} onPress={() => navigation.navigate('SalidasPorCategoria')}>
          <Text style={styles.totalLabel}>Total del mes</Text>
          <Text style={styles.totalAmount}>${totalMes.toLocaleString('es-AR')}</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Tu parte pendiente</Text>
              <Text style={styles.badgeValue}>$0</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Ya pagado</Text>
              <Text style={[styles.badgeValue, { color: colors.greenGlobal }]}>$0</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.tabsFiltroRow}>
          <TouchableOpacity
            style={[styles.tabFiltroBtn, vistaActiva === 'servicios' && styles.tabFiltroBtnActiva]}
            onPress={() => setVistaActiva('servicios')}
          >
            <Text style={[styles.tabFiltroText, vistaActiva === 'servicios' && styles.tabFiltroTextActiva]}>
              Servicios
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabFiltroBtn, vistaActiva === 'gastos' && styles.tabFiltroBtnActiva]}
            onPress={() => setVistaActiva('gastos')}
          >
            <Text style={[styles.tabFiltroText, vistaActiva === 'gastos' && styles.tabFiltroTextActiva]}>
              Gastos
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          {vistaActiva === 'servicios' ? 'SERVICIOS PERIÓDICOS' : 'GASTOS PUNTUALES'}
        </Text>

        {vistaActiva === 'servicios' ? (servicios || []).map(srv => {
          const isUrgente = new Date(srv.proximoVencimiento) - new Date() <= 5 * 24 * 60 * 60 * 1000;
          const iconName  = ICONS_MAP[srv.nombre] || 'receipt-outline';
          const tuParte   = srv.monto / (srv.participantes?.length || 1);
          return (
            <TouchableOpacity key={srv.id} style={styles.servicioCard} onPress={() => setServicioSeleccionado(srv)}>
              <View style={[styles.servicioIcon, isUrgente ? {} : { backgroundColor: '#F0F4F8' }]}>
                <Ionicons name={iconName} size={24} color={isUrgente ? colors.redGlobal : colors.textSecondary} />
              </View>
              <View style={styles.servicioInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 }}>
                  <Text style={[styles.servicioName, { flexShrink: 1 }]} numberOfLines={1}>{srv.nombre}</Text>
                  <View style={styles.badgePeriodo}>
                    <Ionicons name="sync" size={10} color={colors.primary} />
                    <Text style={styles.badgePeriodoText}>{srv.periodicidad}</Text>
                  </View>
                </View>
                <Text style={[styles.servicioDate, isUrgente && { color: colors.redGlobal }]}>
                  {renderDiasParaVencer(srv.proximoVencimiento)}
                </Text>
                <Text style={styles.servicioTuParte}>Tu parte: ${tuParte.toLocaleString('es-AR')}</Text>
                <View style={{ marginTop: 6 }}>
                  <AvatarStack personas={srv.participantes || []} />
                </View>
              </View>
<View style={styles.servicioRight}>
  <Text style={styles.servicioAmount}>${srv.monto.toLocaleString('es-AR')}</Text>
  {isUrgente
    ? <View style={styles.badgeUrgente}><Text style={styles.badgeUrgenteText}>Urgente</Text></View>
    : <View style={styles.badgeAlDia}><Text style={styles.badgeAlDiaText}>Al día</Text></View>
  }
  <TouchableOpacity style={styles.btnTick}>
    <Ionicons name="checkmark" size={20} color={colors.greenGlobal} />
  </TouchableOpacity>

  {/* 👇 NUEVO: botón eliminar */}
<TouchableOpacity
  style={[styles.btnTick, { borderColor: '#ec6c6a', marginTop: 6 }]}
  onPress={(e) => {
    e.stopPropagation(); 
    Alert.alert(
      'Eliminar servicio',
      `¿Querés eliminar "${srv.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
                const idSeguro = srv.id || (srv.nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
                await eliminarServicioVivienda(idSeguro);
              await cargarData();
            } catch (e) {
                Alert.alert('Error', e?.message || 'No se pudo eliminar el servicio');
            }
          },
        },
      ]
    );
  }}
>
  <Ionicons name="trash-outline" size={18} color="#ec6c6a" />
</TouchableOpacity>
</View>
            </TouchableOpacity>
          );
        }) : (gastos || []).map(gasto => {
          const iconName = GASTO_ICONS_MAP[gasto.categoria] || 'receipt-outline';
          return (
            <View key={gasto.id} style={styles.servicioCard}>
              <View style={[styles.servicioIcon, { backgroundColor: '#F0F4F8' }]}>
                <Ionicons name={iconName} size={24} color={colors.textSecondary} />
              </View>
              <View style={styles.servicioInfo}>
                <Text style={styles.servicioName}>{gasto.nombre}</Text>
                <Text style={styles.servicioDate}>{gasto.categoria}</Text>
                <Text style={styles.servicioTuParte}>
                  {new Date(gasto.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </Text>
                <Text style={styles.servicioTuParte}>Pagó: {gasto.pagador}</Text>
              </View>
              <View style={styles.servicioRight}>
                <Text style={styles.servicioAmount}>${(gasto.monto || 0).toLocaleString('es-AR')}</Text>
                <View style={styles.badgeAlDia}><Text style={styles.badgeAlDiaText}>Puntual</Text></View>
              </View>
            </View>
          );
        })}

        {vistaActiva === 'servicios' && (servicios || []).length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="repeat-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>Todavía no hay servicios cargados</Text>
          </View>
        )}

        {vistaActiva === 'gastos' && (gastos || []).length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>Todavía no hay gastos puntuales cargados</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Modal Detalles Servicio ────────────────────────────────────────── */}
      <Modal visible={!!servicioSeleccionado} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setServicioSeleccionado(null)} />
          {servicioSeleccionado && (
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => {
                  const srv = servicioSeleccionado;
                  setServicioSeleccionado(null);
                  navigation.navigate('AgregarVivienda', { editMode: true, data: srv });
                }}>
                  <Ionicons name="create-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setServicioSeleccionado(null)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <View style={[styles.servicioIcon, { width: 64, height: 64, borderRadius: 20, marginBottom: 16, backgroundColor: '#F0F4F8' }]}>
                  <Ionicons name={ICONS_MAP[servicioSeleccionado.nombre] || 'receipt-outline'} size={32} color={colors.textSecondary} />
                </View>
                <Text style={[styles.servicioName, { fontSize: 22 }]}>{servicioSeleccionado.nombre}</Text>
                <View style={[styles.badgePeriodo, { marginVertical: 8 }]}>
                  <Ionicons name="sync" size={12} color={colors.primary} />
                  <Text style={styles.badgePeriodoText}>{servicioSeleccionado.periodicidad}</Text>
                </View>
                <Text style={[styles.servicioAmount, { fontSize: 32, marginVertical: 8 }]}>
                  ${servicioSeleccionado.monto.toLocaleString('es-AR')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                    Tu parte: <Text style={{ fontWeight: 'bold' }}>
                      ${(servicioSeleccionado.monto / (servicioSeleccionado.participantes?.length || 1)).toLocaleString('es-AR')}
                    </Text>
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>•</Text>
                  <Text style={{ fontSize: 14, color: (new Date(servicioSeleccionado.proximoVencimiento) - new Date() <= 5 * 24 * 60 * 60 * 1000) ? colors.redGlobal : colors.textSecondary }}>
                    {renderDiasParaVencer(servicioSeleccionado.proximoVencimiento)}
                  </Text>
                </View>
                <View style={styles.modalDivider} />
                <Text style={styles.modalSubtitle}>Participantes ({servicioSeleccionado.participantes?.length || 0})</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, alignSelf: 'flex-start' }}>
                  {(servicioSeleccionado.participantes || []).map((p, i) => (
                    <View key={i} style={{ alignItems: 'center' }}>
                      <View style={[styles.avatar, { width: 40, height: 40, borderRadius: 20, backgroundColor: getColorByNombre(p) }]}>
                        <Text style={[styles.avatarTexto, { fontSize: 14 }]}>{getIniciales(p)}</Text>
                      </View>
                      <Text style={{ fontSize: 12, marginTop: 4 }}>{p}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.btnMarcarPagado}>
                  <Text style={styles.btnMarcarPagadoText}>Marcar como pagado</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Modal Acuerdos de Reparto ──────────────────────────────────────── */}
      <Modal visible={modalAcuerdosVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlayFade}>
            <Pressable style={StyleSheet.absoluteFill} onPress={cerrarModalAcuerdos} />

            <View style={styles.modalSheetCentered}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>
                  {vistaFormulario ? 'Nueva regla' : 'Reglas de división'}
                </Text>
                <TouchableOpacity onPress={cerrarModalAcuerdos}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {vistaFormulario ? (
                /* ── VISTA FORMULARIO ────────────────────────────────────── */
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ width: '100%' }}
                  contentContainerStyle={{ width: '100%' }}
                >
                  <View style={styles.formContainer}>

                    {/* Integrantes */}
                    <View style={styles.formSection}>
                      <Text style={styles.label}>Integrantes de la casa</Text>
                      <View style={styles.integrantesRow}>
                        {form.integrantes.map((nombre, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => quitarIntegrante(i)}
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

                        <TouchableOpacity
                          style={styles.avatarWrapper}
                          onPress={() => setMostrarInputIntegrante(v => !v)}
                        >
                          <View style={styles.avatarAdd}>
                            <Ionicons name="add" size={20} color={colors.textSecondary} />
                          </View>
                          <Text style={styles.avatarNombre}>Agregar</Text>
                        </TouchableOpacity>
                      </View>

                      {mostrarInputIntegrante && (
                        <View style={styles.inputRow}>
                          <TextInput
                            style={styles.textInput}
                            placeholder="Nombre completo"
                            placeholderTextColor={colors.textSecondary}
                            value={nuevoIntegrante}
                            onChangeText={setNuevoIntegrante}
                            onSubmitEditing={agregarIntegrante}
                            returnKeyType="done"
                            autoFocus
                          />
                          <TouchableOpacity style={styles.btnInputConfirm} onPress={agregarIntegrante}>
                            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Agregar</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Categoría */}
                    <View style={styles.formSection}>
                      <Text style={styles.label}>Categoría</Text>
                      <TouchableOpacity
                        style={styles.dropdownPlaceholder}
                        onPress={() => setDropdownAbierto(v => !v)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name={form.categoria.icon} size={18} color={colors.primary} />
                          <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{form.categoria.label}</Text>
                        </View>
                        <Ionicons
                          name={dropdownAbierto ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>

                      {dropdownAbierto && (
                        <View style={styles.dropdownMenu}>
                          {CATEGORIAS.map((cat, i) => {
                            const seleccionada = cat.label === form.categoria.label;
                            return (
                              <TouchableOpacity
                                key={i}
                                style={[styles.dropdownItem, seleccionada && styles.dropdownItemSelected]}
                                onPress={() => seleccionarCategoria(cat)}
                              >
                                <Ionicons
                                  name={cat.icon}
                                  size={18}
                                  color={seleccionada ? colors.primary : colors.textSecondary}
                                />
                                <Text style={[
                                  styles.dropdownItemText,
                                  seleccionada && { color: colors.primary, fontWeight: '600' },
                                ]}>
                                  {cat.label}
                                </Text>
                                {seleccionada && (
                                  <Ionicons name="checkmark" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {form.categoria.label === 'Otro' && (
                        <TextInput
                          style={[styles.textInput, { marginTop: 8 }]}
                          placeholder="Nombre del servicio"
                          placeholderTextColor={colors.textSecondary}
                          value={form.categoriaCustom}
                          onChangeText={v => setForm(f => ({ ...f, categoriaCustom: v }))}
                        />
                      )}
                    </View>

                    {/* Modelo de división */}
                    <View style={styles.formSection}>
                      <Text style={styles.label}>Modelo de división</Text>
                      <View style={styles.rowModelos}>
                        {MODELOS.map((m, i) => {
                          const activo = form.modeloIdx === i;
                          return (
                            <TouchableOpacity
                              key={i}
                              style={[styles.modeloBtn, activo && styles.modeloSelected]}
                              onPress={() => setForm(f => ({ ...f, modeloIdx: i }))}
                            >
                              <Ionicons name={m.icon} size={24} color={activo ? colors.primary : colors.textSecondary} />
                              <Text style={[styles.modeloText, activo && { color: colors.primary }]}>{m.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* ── Sección Proporcional (dinámica) ────────────────── */}
                    {form.modeloIdx === 1 && (
                      <View style={styles.formSection}>
                        <Text style={styles.label}>Datos por integrante</Text>
                        {form.integrantes.map((nombre, i) => (
                          <View key={i} style={styles.proporcionalRow}>
                            <View style={[styles.avatarForm, { backgroundColor: getColorByNombre(nombre), width: 36, height: 36, borderRadius: 18, flexShrink: 0 }]}>
                              <Text style={[styles.avatarFormTexto, { fontSize: 11 }]}>{getIniciales(nombre)}</Text>
                            </View>
                            <View style={styles.proporcionalInputs}>
                              <Text style={styles.proporcionalNombre} numberOfLines={1}>{nombre.split(' ')[0]}</Text>
                              <View style={styles.proporcionalFields}>
                                <View style={styles.proporcionalFieldWrap}>
                                  <Text style={styles.proporcionalFieldLabel}>Sueldo ($)</Text>
                                  <TextInput
                                    style={styles.proporcionalInput}
                                    placeholder="0"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="numeric"
                                    value={form.proporcional[nombre]?.sueldo ?? ''}
                                    onChangeText={v => updateProporcional(nombre, 'sueldo', v)}
                                  />
                                </View>
                                <View style={styles.proporcionalFieldWrap}>
                                  <Text style={styles.proporcionalFieldLabel}>Porcentaje (%)</Text>
                                  <TextInput
                                    style={styles.proporcionalInput}
                                    placeholder="0"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="numeric"
                                    value={form.proporcional[nombre]?.porcentaje ?? ''}
                                    onChangeText={v => updateProporcional(nombre, 'porcentaje', v)}
                                  />
                                </View>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Botones acción */}
                    <View style={styles.botonesAccionRow}>
                      <TouchableOpacity
                        style={[styles.btnAccion, { backgroundColor: '#eee' }]}
                        onPress={() => setVistaFormulario(false)}
                      >
                        <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnAccion, { backgroundColor: colors.primary }]}
                        onPress={guardarRegla}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Guardar regla</Text>
                      </TouchableOpacity>
                    </View>

                  </View>
                </ScrollView>

              ) : (
                /* ── VISTA LISTA ─────────────────────────────────────────── */
                <View style={{ width: '100%' }}>
                  {reglas.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="document-text-outline" size={36} color={colors.textSecondary} />
                      <Text style={styles.emptyStateText}>Todavía no hay reglas definidas</Text>
                    </View>
                  ) : (
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      style={{ width: '100%', maxHeight: 300 }}
                    >
{reglas.map((regla) => {
  // Aseguramos valores por defecto para evitar errores de renderizado
  const modeloKey = regla.modelo ?? 'partes_iguales';
  const modeloObj = MODELO_MAP[modeloKey] ?? {
    label: modeloKey,
    icon: 'git-branch-outline',
  };
  
  const iconName = ICONS_MAP[regla.nombre] ?? 'receipt-outline';

  return (
    <View key={regla.id} style={styles.reglaCard}>
      <View style={styles.reglaIconWrap}>
        <Ionicons name={iconName} size={22} color={colors.primary} />
      </View>
      
      <View style={styles.reglaInfo}>
        <Text style={styles.reglaNombre}>{regla.nombre ?? 'Sin nombre'}</Text>
        <View style={styles.reglaBadgeRow}>
          <View style={styles.reglaBadge}>
            <Ionicons name={modeloObj.icon} size={11} color={colors.primary} />
            <Text style={styles.reglaBadgeText}>{modeloObj.label}</Text>
          </View>
          <Text style={styles.reglaIntegrantes}>
            {(regla.participantes ?? []).map(p => p.nombre.split(' ')[0]).join(', ')}
          </Text>
        </View>
      </View>

      {/* BOTÓN ELIMINAR */}
<TouchableOpacity 
  style={{ padding: 8 }}
// En tu botón de eliminar dentro de ViviendaDashboard.jsx
onPress={async () => {
  try {
    // Convertimos 'Internet / Fibra' en 'internet_fibra' (o simplemente lo que prefieras)
    const idLimpio = regla.nombre.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    console.log("Intentando eliminar ID limpio:", idLimpio);
    await eliminarAcuerdoReparto(idLimpio); 
    await recargar();
  } catch (error) {
    Alert.alert("Error", "No se pudo eliminar");
  }
}}
>
  <Ionicons name="trash-outline" size={20} color="#ec6c6a" />
</TouchableOpacity>
    </View>
  );
})}
                    </ScrollView>
                  )}

                  <TouchableOpacity style={styles.btnMarcarPagado} onPress={abrirFormulario}>
                    <Text style={styles.btnMarcarPagadoText}>+ Nueva regla</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  scroll:           { padding: 20, paddingTop: 56, paddingBottom: 100 },
  headerTitle:      { color: colors.textSecondary, fontSize: 13 },
  headerRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mainTitle:        { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary },

  btnGasto:         { flexDirection: 'row', backgroundColor: colors.textSecondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', gap: 4 },
  btnGastoText:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnAcuerdos:      { flexDirection: 'row', backgroundColor: '#F0F4F8', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.textSecondary },
  btnAcuerdosText:  { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },

  totalCard:        { backgroundColor: colors.textSecondary, borderRadius: 20, padding: 20, marginBottom: 30 },
  totalLabel:       { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 },
  totalAmount:      { color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: 8 },
  badgesRow:        { flexDirection: 'row', gap: 12, marginTop: 10 },
  badge:            { backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 12, flex: 1 },
  badgeLabel:       { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  badgeValue:       { color: '#F1948A', fontSize: 16, fontWeight: 'bold' },

  sectionTitle:     { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },

  tabsFiltroRow:    { flexDirection: 'row', backgroundColor: '#EAF4FF', borderRadius: 16, padding: 4, marginBottom: 14, gap: 6 },
  tabFiltroBtn:     { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabFiltroBtnActiva:{ backgroundColor: '#526D82' },
  tabFiltroText:    { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabFiltroTextActiva:{ color: '#FFFFFF' },

  servicioCard:     { backgroundColor: colors.cardBg, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  servicioIcon:     { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FDECEC', justifyContent: 'center', alignItems: 'center' },
  servicioInfo:     { flex: 1 },
  servicioName:     { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  badgePeriodo:     { flexDirection: 'row', backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignItems: 'center', gap: 4 },
  badgePeriodoText: { fontSize: 10, fontWeight: 'bold', color: colors.primary },
  servicioDate:     { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  servicioTuParte:  { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  servicioRight:    { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' },
  servicioAmount:   { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  badgeUrgente:     { backgroundColor: '#FDECEC', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  badgeUrgenteText: { fontSize: 10, color: colors.redGlobal, fontWeight: 'bold' },
  badgeAlDia:       { backgroundColor: '#E9F7EF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  badgeAlDiaText:   { fontSize: 10, color: colors.greenGlobal, fontWeight: 'bold' },

  btnTick:          { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', marginTop: 12 },

  avatarStack:      { flexDirection: 'row' },
  avatar:           { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBg },
  avatarTexto:      { color: 'white', fontSize: 7, fontWeight: 'bold' },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalBody:        { alignItems: 'center', marginTop: 10 },
  modalSubtitle:    { fontSize: 14, fontWeight: 'bold', color: colors.textSecondary, alignSelf: 'flex-start' },
  modalDivider:     { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 20 },

  modalOverlayFade:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'stretch', padding: 20 },
  modalSheetCentered: { backgroundColor: '#fff', borderRadius: 24, width: '100%', padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, maxHeight: '90%' },

  formContainer:    { width: '100%', gap: 16, paddingBottom: 8 },
  formSection:      { width: '100%' },
  botonesAccionRow: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },

  btnMarcarPagado:     { backgroundColor: colors.textSecondary, width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  btnMarcarPagadoText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 },

  integrantesRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', width: '100%' },
  avatarWrapper:     { alignItems: 'center', position: 'relative', width: 52 },
  avatarForm:        { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarFormTexto:   { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  avatarNombre:      { fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center', maxWidth: 52 },
  avatarRemoveBadge: { position: 'absolute', top: -2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ec6c6a', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  avatarAdd:         { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textSecondary, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center' },

  inputRow:         { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center', width: '100%' },
  textInput:        { flex: 1, padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, fontSize: 14, color: colors.textPrimary, backgroundColor: '#fff' },
  btnInputConfirm:  { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 },

  dropdownPlaceholder:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 16, width: '100%', backgroundColor: '#fff' },
  dropdownMenu:         { borderWidth: 1, borderColor: '#eee', borderRadius: 16, overflow: 'hidden', marginTop: 4, backgroundColor: '#fff', width: '100%' },
  dropdownItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  dropdownItemSelected: { backgroundColor: '#F0F4FF' },
  dropdownItemText:     { fontSize: 14, color: colors.textPrimary, flex: 1 },

  rowModelos:     { flexDirection: 'row', gap: 10, width: '100%' },
  modeloBtn:      { flex: 1, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 16, backgroundColor: '#fff' },
  modeloSelected: { borderColor: colors.primary, backgroundColor: '#F0F4FF' },
  modeloText:     { fontSize: 10, marginTop: 6, textAlign: 'center', fontWeight: '500', color: colors.textSecondary },

  btnAccion: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },

  proporcionalRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12, width: '100%' },
  proporcionalInputs:    { flex: 1 },
  proporcionalNombre:    { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  proporcionalFields:    { flexDirection: 'row', gap: 8 },
  proporcionalFieldWrap: { flex: 1 },
  proporcionalFieldLabel:{ fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  proporcionalInput:     { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, fontSize: 14, color: colors.textPrimary, backgroundColor: '#fff' },

  emptyState:      { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyStateText:  { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  reglaCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#F8F9FA', borderRadius: 14, marginBottom: 10, width: '100%' },
  reglaIconWrap:   { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center' },
  reglaInfo:       { flex: 1 },
  reglaNombre:     { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  reglaBadgeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reglaBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEEDFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reglaBadgeText:  { fontSize: 11, color: colors.primary, fontWeight: '600' },
  reglaIntegrantes:{ fontSize: 11, color: colors.textSecondary },
});
