import React, { useState } from 'react';
import LiquidarServicioModal from '../../components/LiquidarServicioModal';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useVivienda } from '../../context/ViviendaContext';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import {
  getGastosVivienda,
  getServiciosVivienda,
  eliminarAcuerdoReparto,
  eliminarServicioVivienda,
  getMiVivienda,
  crearMiVivienda,
  obtenerInvitacionVivienda,
  marcarPagadoVivienda,
  eliminarGastoVivienda
} from '../../services/viviendaService';
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

function getPrimerNombre(nombre) {
  if (typeof nombre !== 'string') return '';
  const limpio = nombre.trim();
  if (!limpio) return '';
  return limpio.split(/\s+/)[0];
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

const MODELO_MAP = {
  proporcional: { label: 'Proporcional', icon: 'bar-chart-outline' },
  partes_iguales: { label: 'Partes iguales', icon: 'scale-outline' },
  responsable_unico: { label: 'Resp. único', icon: 'person-outline' },
};

const CATEGORIAS = [
  { label: 'Agua', icon: 'water-outline' },
  { label: 'Factura de Luz', icon: 'flash-outline' },
  { label: 'Internet / Fibra', icon: 'wifi-outline' },
  { label: 'Netflix', icon: 'tv-outline' },
  { label: 'Spotify', icon: 'musical-notes-outline' },
  { label: 'Otro', icon: 'receipt-outline' },
];

const MODELOS = [
  { label: 'Partes iguales', icon: 'scale-outline', value: 'partes_iguales' },
  { label: 'Proporcional', icon: 'bar-chart-outline', value: 'proporcional' },
  { label: 'Resp. único', icon: 'person-outline', value: 'responsable_unico' },
];

const buildFormInicial = (integrantesIniciales = ['Yo']) => {
  const form = {
    integrantes: [...integrantesIniciales],
    nombreAcuerdo: '',
    modeloIdx: 0,
    proporcional: {}
  };
  integrantesIniciales.forEach(nombre => {
    form.proporcional[nombre] = { sueldo: '', porcentaje: '' };
  });
  return form;
};

export default function ViviendaDashboard({ navigation }) {
  const { user } = useAuth();
  const integranteInicial = user?.name || user?.nombre || 'Yo';
  const [gastos, setGastos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [vistaActiva, setVistaActiva] = useState('servicios');
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [liquidarVisible, setLiquidarVisible] = useState(false);
  const [servicioALiquidar, setServicioALiquidar] = useState(null);

  const [modalAcuerdosVisible, setModalAcuerdosVisible] = useState(false);
  const [vistaFormulario, setVistaFormulario] = useState(false);
  const { reglas, agregarRegla, actualizarRegla, recargar } = useVivienda();
  const [editandoAcuerdoId, setEditandoAcuerdoId] = useState(null);

  const [form, setForm] = useState(buildFormInicial([integranteInicial]));
  const [modalInicioViviendaVisible, setModalInicioViviendaVisible] = useState(false);
  const [modalMiembrosVisible, setModalMiembrosVisible] = useState(false);
  const [miVivienda, setMiVivienda] = useState(null);
  const [nuevaViviendaNombre, setNuevaViviendaNombre] = useState(() => `Vivienda de ${integranteInicial}`);

  const [cargando, setCargando] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      cargarData();
      recargar();
    }, [recargar])
  );

  const cargarData = async () => {
    try {
      const viviendaActual = await getMiVivienda();
      setMiVivienda(viviendaActual || null);
      if (!viviendaActual) {
        setModalInicioViviendaVisible(true);
        setGastos([]);
        setServicios([]);
        return;
      }

      setModalInicioViviendaVisible(false);
      const gastosData = await getGastosVivienda();
      const serviciosData = await getServiciosVivienda();
      setGastos(gastosData || []);
      setServicios(serviciosData || []);
    } catch (error) {
      console.error(error);
      setModalInicioViviendaVisible(true);
    }
  };

  const totalMes = [...(gastos || []), ...(servicios || [])]
    .reduce((sum, item) => sum + (item.monto || 0), 0);

  const tuPartePendiente = [...(gastos || []), ...(servicios || [])]
    .filter(item => item.status !== 'PAGADO')
    .reduce((sum, item) => sum + (item.monto_responsabilidad_usuario || 0), 0);

  const yaPagado = [...(gastos || []), ...(servicios || [])]
    .filter(item => item.status === 'PAGADO')
    .reduce((sum, item) => sum + (item.monto_responsabilidad_usuario || 0), 0);

  const nombreHeader = getPrimerNombre(user?.name || user?.nombre || '') || 'Vivienda';

  const renderDiasParaVencer = (isoDate) => {
    const diff = new Date(isoDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Vencido';
    if (days === 0) return 'Vence hoy';
    return `Vence en ${days} días`;
  };

  const quitarIntegrante = (idx) => {
    const nombre = form.integrantes[idx];
    Alert.alert(
      'Quitar integrante',
      '¿Deseas eliminar a este integrante de este acuerdo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            setForm(f => {
              const nuevos = f.integrantes.filter((_, i) => i !== idx);
              const nuevoProp = { ...f.proporcional };
              delete nuevoProp[nombre];
              return { ...f, integrantes: nuevos, proporcional: nuevoProp };
            });
          }
        }
      ]
    );
  };

  const agregarIntegrante = (nombre) => {
    setForm(f => {
      if (f.integrantes.includes(nombre)) return f;
      const nuevos = [...f.integrantes, nombre];
      const nuevoProp = { ...f.proporcional };
      nuevoProp[nombre] = { sueldo: '', porcentaje: '' };
      return { ...f, integrantes: nuevos, proporcional: nuevoProp };
    });
  };

  const updateProporcional = (nombre, campo, valor) => {
    setForm(f => {
      const nuevoProp = {
        ...f.proporcional,
        [nombre]: { ...f.proporcional[nombre], [campo]: valor },
      };

      if (campo === 'sueldo') {
        const total = f.integrantes.reduce((sum, n) => {
          const val = n === nombre ? valor : nuevoProp[n]?.sueldo;
          return sum + (Number(val) || 0);
        }, 0);

        if (total > 0) {
          f.integrantes.forEach(n => {
            const val = n === nombre ? valor : nuevoProp[n]?.sueldo;
            const sueldoNum = Number(val) || 0;
            const pct = Math.round((sueldoNum / total) * 100);
            nuevoProp[n] = {
              ...nuevoProp[n],
              porcentaje: String(pct || '')
            };
          });
        }
      }

      return {
        ...f,
        proporcional: nuevoProp
      };
    });
  };

  const cerrarModalAcuerdos = () => {
    setModalAcuerdosVisible(false);
    setVistaFormulario(false);
    const integrantesActuales = miVivienda?.miembros ? miVivienda.miembros.map(m => m.name) : [integranteInicial];
    setForm(buildFormInicial(integrantesActuales));
    setEditandoAcuerdoId(null);
  };

  const abrirFormularioAcuerdo = () => {
    const integrantesActuales = miVivienda?.miembros ? miVivienda.miembros.map(m => m.name) : [integranteInicial];
    setForm(buildFormInicial(integrantesActuales));
    setEditandoAcuerdoId(null);
    setVistaFormulario(true);
  };

  const abrirFormularioEdicion = (regla) => {
    const mIdx = MODELOS.findIndex(m => m.value === regla.modelo);
    const integrantes = regla.participantes.map(p => p.nombre);
    const proporcional = {};

    const todosMiembros = miVivienda?.miembros || [];
    todosMiembros.forEach(m => {
      proporcional[m.name] = { sueldo: '', porcentaje: '' };
    });

    regla.participantes.forEach(p => {
      proporcional[p.nombre] = {
        sueldo: p.sueldo != null ? String(p.sueldo) : '',
        porcentaje: p.porcentaje != null ? String(p.porcentaje) : ''
      };
    });

    setForm({
      integrantes,
      nombreAcuerdo: regla.nombre || '',
      modeloIdx: mIdx !== -1 ? mIdx : 0,
      proporcional,
    });
    setEditandoAcuerdoId(regla.id);
    setVistaFormulario(true);
  };

  const guardarAcuerdoForm = async () => {
    const nombreAcuerdo = form.nombreAcuerdo.trim() || 'Acuerdo sin nombre';
    const modeloValue = MODELOS[form.modeloIdx].value;

    const nuevaRegla = {
      nombre: nombreAcuerdo,
      modelo: modeloValue,
      participantes: form.integrantes.map(nombre => {
        let pct = 0;
        let sueldoVal = null;
        if (form.modeloIdx === 1) { 
          pct = Number(form.proporcional[nombre]?.porcentaje ?? 0);
          sueldoVal = form.proporcional[nombre]?.sueldo ? Number(form.proporcional[nombre].sueldo) : null;
        } else if (form.modeloIdx === 0) { 
          pct = Math.round(100 / form.integrantes.length);
        } else { 
          pct = 100;
        }
        return { nombre, porcentaje: pct, sueldo: sueldoVal };
      }),
    };

    try {
      if (editandoAcuerdoId) {
        await actualizarRegla(editandoAcuerdoId, nuevaRegla);
      } else {
        await agregarRegla(nuevaRegla);
      }
      setVistaFormulario(false);
      const integrantesActuales = miVivienda?.miembros ? miVivienda.miembros.map(m => m.name) : [integranteInicial];
      setForm(buildFormInicial(integrantesActuales));
      setEditandoAcuerdoId(null);
      if (typeof setDropdownAbierto === 'function') {
        setDropdownAbierto(false);
      }
    } catch (e) {
      console.error('Error al guardar acuerdo:', e);
      Alert.alert('Error', 'No se pudo guardar el acuerdo');
    }
  };

  const handleCrearMiVivienda = async () => {
    try {
      const nombre = (nuevaViviendaNombre || '').trim() || `Vivienda de ${integranteInicial}`;
      const creada = await crearMiVivienda({ nombre });
      setMiVivienda(creada);
      setModalInicioViviendaVisible(false);
      setNuevaViviendaNombre(`Vivienda de ${integranteInicial}`);
      await cargarData();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo crear la vivienda.');
    }
  };

  const handleCompartirInvitacionVivienda = async () => {
    try {
      const invitacion = await obtenerInvitacionVivienda();
      const nombre = miVivienda?.nombre || invitacion?.viviendaNombre || 'mi vivienda';
      const mensaje = `¡Te invito a unirte a "${nombre}" en MitiMiti!\n\nHacé clic acá para sumarte: ${invitacion.deepLink}`;
      await Share.share({ title: 'Invitación a vivienda', message: mensaje });
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo generar el enlace de vivienda.');
    }
  };


  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>Casa compartida</Text>
        <View style={styles.headerRow}>
          <Text style={styles.mainTitle} numberOfLines={1} ellipsizeMode="tail">
            {nombreHeader}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.headerActionsScroll}
            contentContainerStyle={styles.headerActions}
          >
            {miVivienda && (
              <TouchableOpacity style={styles.btnAcuerdos} onPress={handleCompartirInvitacionVivienda}>
                <Ionicons name="link-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.btnAcuerdosText}>Invitar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.btnAcuerdos}
              onPress={() => {
                if (!miVivienda) return Alert.alert('Vivienda', 'Primero creá o uníte a una vivienda.');
                setModalAcuerdosVisible(true);
              }}
            >
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.btnAcuerdosText}>Acuerdos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnGasto}
              onPress={() => {
                if (!miVivienda) return Alert.alert('Vivienda', 'Primero creá o uníte a una vivienda.');
                navigation.navigate('AgregarVivienda');
              }}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.btnGastoText}>Gasto</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.totalCard}
          onPress={() => miVivienda ? navigation.navigate('SalidasPorCategoria') : Alert.alert('Vivienda', 'Primero creá o uníte a una vivienda.')}
        >
          <Text style={styles.totalLabel}>Total del mes</Text>
          <Text style={styles.totalAmount}>${totalMes.toLocaleString('es-AR')}</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Tu parte pendiente</Text>
              <Text style={styles.badgeValue}>${tuPartePendiente.toLocaleString('es-AR')}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Ya pagado</Text>
              <Text style={[styles.badgeValue, { color: colors.greenGlobal }]}>${yaPagado.toLocaleString('es-AR')}</Text>
            </View>
          </View>

          {!!miVivienda?.miembros?.length && (
            <TouchableOpacity style={styles.integrantesQuick} onPress={() => setModalMiembrosVisible(true)}>
              <Text style={styles.integrantesQuickLabel}>Integrantes</Text>
              <AvatarStack personas={(miVivienda.miembros || []).map((m) => m.name)} />
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>
          )}
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

        {vistaActiva === 'servicios' ? (servicios || []).filter(s => s.status !== 'PAGADO').map(srv => {
          const targetDate = new Date(srv.proximoVencimiento);
          const today = new Date();
          const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const diffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
          const isVencido = diffDays < 0;
          const isUrgente = diffDays >= 0 && diffDays <= 3;

          const iconName = ICONS_MAP[srv.nombre] || 'receipt-outline';
          const montoSafe = srv.monto != null ? srv.monto : 0;
          const tuParte = srv.monto_responsabilidad_usuario || 0;
          return (
            <TouchableOpacity key={srv.id} style={styles.servicioCard} onPress={() => setServicioSeleccionado(srv)}>
              <View style={[styles.servicioIcon, (isUrgente || isVencido) ? {} : { backgroundColor: '#F0F4F8' }]}>
                <Ionicons name={iconName} size={24} color={(isUrgente || isVencido) ? colors.redGlobal : colors.textSecondary} />
              </View>
              <View style={styles.servicioInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 }}>
                  <Text style={[styles.servicioName, { flexShrink: 1 }]} numberOfLines={1}>{srv.nombre}</Text>
                  <View style={styles.badgePeriodo}>
                    <Ionicons name="sync" size={10} color={colors.primary} />
                    <Text style={styles.badgePeriodoText}>{srv.periodicidad}</Text>
                  </View>
                </View>
                <Text style={[styles.servicioDate, (isUrgente || isVencido) && { color: colors.redGlobal, fontWeight: isVencido ? 'bold' : 'normal' }]}>
                  {isVencido ? 'Venció el' : 'Vence:'} {targetDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                </Text>
                <Text style={styles.servicioTuParte}>Tu parte: {srv.monto != null ? `$${tuParte.toLocaleString('es-AR')}` : '$ –'}</Text>
                <View style={{ marginTop: 6 }}>
                  <AvatarStack personas={srv.participantes || []} />
                </View>
              </View>
              <View style={styles.servicioRight}>
                <Text style={styles.servicioAmount}>{srv.monto != null ? `$${srv.monto.toLocaleString('es-AR')}` : '$ –'}</Text>
                {srv.isVariable ? (
                  srv.status === 'PENDIENTE'
                    ? <View style={styles.badgePendiente}><Text style={styles.badgePendienteText}>Esperando Factura</Text></View>
                    : srv.status === 'PAGADO'
                      ? <View style={styles.badgeAlDia}><Text style={styles.badgeAlDiaText}>Pagado</Text></View>
                      : <View style={styles.badgeLiquidado}><Text style={styles.badgeLiquidadoText}>Listo para pagar</Text></View>
                ) : (
                  srv.status === 'PAGADO'
                    ? <View style={styles.badgeAlDia}><Text style={styles.badgeAlDiaText}>Pagado</Text></View>
                    : isUrgente
                      ? <View style={styles.badgeUrgente}><Text style={styles.badgeUrgenteText}>Urgente</Text></View>
                      : <View style={styles.badgeLiquidado}><Text style={styles.badgeLiquidadoText}>Listo para pagar</Text></View>
                )}

                {srv.isVariable && srv.status === 'PENDIENTE' ? (
                  <TouchableOpacity style={[styles.btnTick, { borderColor: '#E65100' }]} onPress={(e) => {
                    e.stopPropagation();
                    setServicioALiquidar(srv);
                    setLiquidarVisible(true);
                  }}>
                    <Ionicons name="wallet-outline" size={18} color="#E65100" />
                  </TouchableOpacity>
                ) : srv.status === 'PROCESADO' || (!srv.isVariable && srv.status !== 'PAGADO') ? (
                  <TouchableOpacity style={[styles.btnTick, { borderColor: colors.primary }]} onPress={(e) => {
                    e.stopPropagation();
                    Alert.alert(
                      'Marcar como pagado',
                      `¿Estás seguro de que deseas marcar el servicio "${srv.nombre}" como pagado?`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Confirmar',
                          onPress: async () => {
                            try {
                              await marcarPagadoVivienda('servicios', srv.id);
                              await cargarData();
                            } catch (err) {
                              Alert.alert('Error', err?.message || 'Error al marcar como pagado');
                            }
                          }
                        }
                      ]
                    );
                  }}>
                    <Ionicons name="checkmark-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.btnTick}>
                    <Ionicons name="checkmark" size={20} color={colors.greenGlobal} />
                  </View>
                )}

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
        }) : (gastos || []).filter(gasto => gasto.status !== 'PAGADO').map(gasto => {
          const targetDate = new Date(gasto.fecha);
          const today = new Date();
          const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
          const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const diffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
          const isVencido = diffDays < 0;
          const isUrgente = diffDays >= 0 && diffDays <= 3;
          
          const iconName = GASTO_ICONS_MAP[gasto.categoria] || 'receipt-outline';
          return (
            <View key={gasto.id} style={styles.servicioCard}>
              <View style={[styles.servicioIcon, { backgroundColor: '#F0F4F8' }]}>
                <Ionicons name={iconName} size={24} color={(isUrgente || isVencido) ? colors.redGlobal : colors.textSecondary} />
              </View>
              <View style={styles.servicioInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[styles.servicioDate, { marginBottom: 0, textTransform: 'uppercase', fontWeight: 'bold', fontSize: 10, color: colors.primary }]}>
                    {gasto.categoria}
                  </Text>
                </View>
                <Text style={styles.servicioName}>{gasto.nombre}</Text>
                <Text style={[styles.servicioDate, (isUrgente || isVencido) && { color: colors.redGlobal, fontWeight: isVencido ? 'bold' : 'normal' }]}>
                  {isVencido ? 'Venció el' : 'Vence:'} {targetDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                </Text>
                <Text style={styles.servicioDate}>
                  Pagó: <Text style={{fontWeight: '600', color: colors.textPrimary}}>{gasto.pagador}</Text>
                </Text>
                <Text style={[styles.servicioTuParte, { fontSize: 13, marginTop: 4 }]}>
                  Tu parte: <Text style={{ fontWeight: 'bold', color: '#E65100' }}>
                    ${(gasto.monto_responsabilidad_usuario || 0).toLocaleString('es-AR')}
                  </Text>
                </Text>
              </View>
              <View style={styles.servicioRight}>
                <Text style={styles.servicioAmount}>${(gasto.monto || 0).toLocaleString('es-AR')}</Text>
                {gasto.status === 'PAGADO' ? (
                  <View style={styles.badgeAlDia}><Text style={styles.badgeAlDiaText}>Pagado</Text></View>
                ) : (
                  <View style={styles.badgeLiquidado}><Text style={styles.badgeLiquidadoText}>Listo para pagar</Text></View>
                )}

                {gasto.status !== 'PAGADO' ? (
                  <TouchableOpacity style={[styles.btnTick, { borderColor: colors.primary, marginTop: 6 }]} onPress={(e) => {
                    e.stopPropagation();
                    Alert.alert(
                      'Marcar como pagado',
                      `¿Estás seguro de que deseas marcar el gasto "${gasto.nombre}" como pagado?`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Confirmar',
                          onPress: async () => {
                            try {
                              await marcarPagadoVivienda('gastos', gasto.id);
                              await cargarData();
                            } catch (err) {
                              Alert.alert('Error', err?.message || 'Error al marcar como pagado');
                            }
                          }
                        }
                      ]
                    );
                  }}>
                    <Ionicons name="checkmark-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.btnTick, { marginTop: 6 }]}>
                    <Ionicons name="checkmark" size={20} color={colors.greenGlobal} />
                  </View>
                )}

                {gasto.pagador === integranteInicial && (
                  <TouchableOpacity
                    style={[styles.btnTick, { borderColor: '#ec6c6a', marginTop: 6 }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (gasto.status === 'PAGADO') {
                        Alert.alert('Acción denegada', 'No podés eliminar un gasto que ya figura como PAGADO. Revertí el pago primero para poder borrarlo.');
                        return;
                      }
                      Alert.alert(
                        'Eliminar gasto',
                        `¿Querés eliminar "${gasto.nombre}"?`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Eliminar',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await eliminarGastoVivienda(gasto.id);
                                await cargarData();
                              } catch (error) {
                                console.log('Error al eliminar gasto:', error);
                                Alert.alert('Error', error?.message || 'No se pudo eliminar el gasto');
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ec6c6a" />
                  </TouchableOpacity>
                )}
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
                  {servicioSeleccionado.monto != null ? `$${servicioSeleccionado.monto.toLocaleString('es-AR')}` : '$ –'}
                </Text>
                {servicioSeleccionado.isVariable ? (
                  <View style={[
                    servicioSeleccionado.status === 'PENDIENTE' ? styles.badgePendiente :
                      servicioSeleccionado.status === 'PAGADO' ? styles.badgeAlDia : styles.badgeLiquidado,
                    { alignSelf: 'center', marginBottom: 8 }
                  ]}>
                    <Text style={
                      servicioSeleccionado.status === 'PENDIENTE' ? styles.badgePendienteText :
                        servicioSeleccionado.status === 'PAGADO' ? styles.badgeAlDiaText : styles.badgeLiquidadoText
                    }>
                      {servicioSeleccionado.status === 'PENDIENTE' ? 'Esperando Factura' :
                        servicioSeleccionado.status === 'PAGADO' ? 'Pagado' : 'Listo para pagar'}
                    </Text>
                  </View>
                ) : (
                  <View style={[
                    servicioSeleccionado.status === 'PAGADO' ? styles.badgeAlDia : styles.badgeLiquidado,
                    { alignSelf: 'center', marginBottom: 8 }
                  ]}>
                    <Text style={
                      servicioSeleccionado.status === 'PAGADO' ? styles.badgeAlDiaText : styles.badgeLiquidadoText
                    }>
                      {servicioSeleccionado.status === 'PAGADO' ? 'Pagado' : 'Listo para pagar'}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                    Tu parte: <Text style={{ fontWeight: 'bold' }}>
                      {servicioSeleccionado.monto_responsabilidad_usuario != null
                        ? `$${servicioSeleccionado.monto_responsabilidad_usuario.toLocaleString('es-AR')}`
                        : '$ –'}
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
                {servicioSeleccionado.status !== 'PAGADO' && (
                  <TouchableOpacity
                    style={[
                      styles.btnMarcarPagado,
                      servicioSeleccionado.isVariable && servicioSeleccionado.status === 'PENDIENTE'
                        ? { backgroundColor: '#E65100' }
                        : { backgroundColor: colors.primary }
                    ]}
                    onPress={async () => {
                      if (servicioSeleccionado.isVariable && servicioSeleccionado.status === 'PENDIENTE') {
                        const srv = servicioSeleccionado;
                        setServicioSeleccionado(null);
                        setServicioALiquidar(srv);
                        setLiquidarVisible(true);
                      } else {
                        Alert.alert(
                          'Marcar como pagado',
                          `¿Estás seguro de que deseas marcar el servicio "${servicioSeleccionado.nombre}" como pagado?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Confirmar',
                              onPress: async () => {
                                try {
                                  await marcarPagadoVivienda('servicios', servicioSeleccionado.id);
                                  setServicioSeleccionado(null);
                                  await cargarData();
                                } catch (err) {
                                  Alert.alert('Error', err?.message || 'Error al marcar como pagado');
                                }
                              }
                            }
                          ]
                        );
                      }
                    }}
                  >
                    <Text style={styles.btnMarcarPagadoText}>
                      {servicioSeleccionado.isVariable && servicioSeleccionado.status === 'PENDIENTE'
                        ? 'Cargar Monto de la Factura'
                        : 'Marcar como pagado'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

      <LiquidarServicioModal
        visible={liquidarVisible}
        servicio={servicioALiquidar}
        onClose={() => { setLiquidarVisible(false); setServicioALiquidar(null); }}
        onLiquidado={() => { setLiquidarVisible(false); setServicioALiquidar(null); cargarData(); }}
      />

      <Modal visible={modalAcuerdosVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlayFade}>
            <Pressable style={StyleSheet.absoluteFill} onPress={cerrarModalAcuerdos} />

            <View style={styles.modalSheetCentered}>
              <View style={styles.modalHeader}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>
                  {vistaFormulario ? 'Nuevo acuerdo de división' : 'Acuerdos activos'}
                </Text>
                <TouchableOpacity onPress={cerrarModalAcuerdos}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {vistaFormulario ? (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ width: '100%' }}
                  contentContainerStyle={{ width: '100%' }}
                >
                  <View style={styles.formContainer}>

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
                        {(miVivienda?.miembros || [])
                          .map(m => m.name)
                          .filter(nombre => !form.integrantes.includes(nombre))
                          .map((nombre, i) => (
                            <TouchableOpacity
                              key={`disponible-${i}`}
                              onPress={() => agregarIntegrante(nombre)}
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

                    <View style={styles.formSection}>
                      <Text style={styles.label}>Nombre del acuerdo</Text>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Ej: Proporcional por sueldos, Regla 60-40, Fondo Común..."
                        placeholderTextColor={colors.textSecondary}
                        value={form.nombreAcuerdo}
                        onChangeText={v => setForm(f => ({ ...f, nombreAcuerdo: v }))}
                      />
                    </View>

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

                    <View style={styles.botonesAccionRow}>
                      <TouchableOpacity
                        style={[styles.btnAccion, { backgroundColor: '#eee' }]}
                        onPress={() => setVistaFormulario(false)}
                      >
                        <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnAccion, { backgroundColor: colors.primary }]}
                        onPress={guardarAcuerdoForm}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Guardar acuerdo</Text>
                      </TouchableOpacity>
                    </View>

                  </View>
                </ScrollView>

              ) : (
                <View style={{ width: '100%' }}>
                  {reglas.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="document-text-outline" size={36} color={colors.textSecondary} />
                      <Text style={styles.emptyStateText}>Todavía no hay acuerdos definidos</Text>
                    </View>
                  ) : (
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      style={{ width: '100%', maxHeight: 300 }}
                    >
                      {reglas.map((regla) => {
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

                            <View style={{ flexDirection: 'row', gap: 4 }}>
                              <TouchableOpacity
                                style={{ padding: 8 }}
                                onPress={() => abrirFormularioEdicion(regla)}
                              >
                               <Ionicons name="create-outline" size={20} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{ padding: 8 }}
                                onPress={async () => {
                                  try {
                                    await eliminarAcuerdoReparto(regla.id);
                                    await recargar();
                                  } catch (error) {
                                    Alert.alert('Error', 'No se pudo eliminar');
                                  }
                                }}
                              >
                                <Ionicons name="trash-outline" size={20} color="#ec6c6a" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}

                  <TouchableOpacity style={styles.btnMarcarPagado} onPress={abrirFormularioAcuerdo}>
                    <Text style={styles.btnMarcarPagadoText}>+ Nuevo acuerdo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalMiembrosVisible} transparent animationType="fade">
        <View style={styles.modalOverlayFade}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalMiembrosVisible(false)} />
          <View style={styles.modalSheetCentered}>
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>Mi vivienda</Text>
              <TouchableOpacity onPress={() => setModalMiembrosVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.listadoMetaCard}>
              <Text style={styles.listadoMetaLabel}>Vivienda</Text>
              <Text style={styles.listadoMetaValue}>{miVivienda?.nombre || '-'}</Text>
            </View>

            <Text style={styles.listadoTitulo}>Integrantes</Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {(miVivienda?.miembros || []).map((m, idx) => {
                const esCreador = String(m?.id || '') === String(miVivienda?.creadorId || '');
                return (
                  <View key={m.id || idx} style={styles.miembroRow}>
                    <View style={[styles.miembroAvatar, { backgroundColor: getColorByNombre(m?.name || 'NN') }]}>
                      <Text style={styles.miembroAvatarText}>{getIniciales(m?.name || 'NN')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miembroNombre}>{m?.name || 'Sin nombre'}</Text>
                      {esCreador && <Text style={styles.miembroRol}>Creador</Text>}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalInicioViviendaVisible} transparent animationType="fade">
        <View style={styles.modalOverlayFade}>
          <View style={styles.modalInicioCard}>
            <Text style={styles.modalInicioTitulo}>Vivienda</Text>
            <Text style={styles.modalInicioSubtitulo}>
              Elegí cómo querés empezar: crear tu vivienda o unirte con enlace.
            </Text>

            <TextInput
              style={styles.modalInicioInput}
              placeholder="Nombre de la vivienda"
              placeholderTextColor={colors.textSecondary}
              value={nuevaViviendaNombre}
              onChangeText={setNuevaViviendaNombre}
            />

            <TouchableOpacity
              style={styles.modalInicioPrimary}
              onPress={handleCrearMiVivienda}
            >
              <Ionicons name="home-outline" size={18} color="white" />
              <Text style={styles.modalInicioPrimaryTxt}>Tener mi vivienda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalInicioSecondary}
              onPress={() => {
                setModalInicioViviendaVisible(false);
                navigation.navigate('ViviendaJoinViaLink');
              }}
            >
              <Ionicons name="link-outline" size={18} color={colors.primary} />
              <Text style={styles.modalInicioSecondaryTxt}>Unirme a una vivienda con enlace</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100 },
  headerTitle: { color: colors.textSecondary, fontSize: 13 },
  headerRow: { marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, flexShrink: 1 },
  headerActionsScroll: { flexGrow: 0 },
  headerActions: { flexDirection: 'row', gap: 8, paddingRight: 4 },

  btnGasto: { flexDirection: 'row', backgroundColor: colors.textSecondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, alignItems: 'center', gap: 4 },
  btnGastoText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  btnAcuerdos: { flexDirection: 'row', backgroundColor: '#F0F4F8', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.textSecondary },
  btnAcuerdosText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },

  totalCard: { backgroundColor: colors.textSecondary, borderRadius: 20, padding: 20, marginBottom: 30 },
  totalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 },
  totalAmount: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: 8 },
  badgesRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  badge: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 12, flex: 1 },
  badgeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  badgeValue: { color: '#F1948A', fontSize: 16, fontWeight: 'bold' },
  integrantesQuick: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  integrantesQuickLabel: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '600' },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },

  tabsFiltroRow: { flexDirection: 'row', backgroundColor: '#EAF4FF', borderRadius: 16, padding: 4, marginBottom: 14, gap: 6 },
  tabFiltroBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabFiltroBtnActiva: { backgroundColor: '#526D82' },
  tabFiltroText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabFiltroTextActiva: { color: '#FFFFFF' },

  servicioCard: { backgroundColor: colors.cardBg, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  servicioIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FDECEC', justifyContent: 'center', alignItems: 'center' },
  servicioInfo: { flex: 1 },
  servicioName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  badgePeriodo: { flexDirection: 'row', backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignItems: 'center', gap: 4 },
  badgePeriodoText: { fontSize: 10, fontWeight: 'bold', color: colors.primary },
  servicioDate: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  servicioTuParte: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  servicioRight: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' },
  servicioAmount: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  badgeUrgente: { backgroundColor: '#FDECEC', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  badgeUrgenteText: { fontSize: 10, color: colors.redGlobal, fontWeight: 'bold' },
  badgeAlDia: { backgroundColor: '#E9F7EF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  badgeAlDiaText: { fontSize: 10, color: colors.greenGlobal, fontWeight: 'bold' },

  btnTick: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', marginTop: 12 },

  avatarStack: { flexDirection: 'row' },
  avatar: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBg },
  avatarTexto: { color: 'white', fontSize: 7, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalBody: { alignItems: 'center', marginTop: 10 },
  modalSubtitle: { fontSize: 14, fontWeight: 'bold', color: colors.textSecondary, alignSelf: 'flex-start' },
  modalDivider: { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 20 },

  modalOverlayFade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'stretch', padding: 20 },
  modalSheetCentered: { backgroundColor: '#fff', borderRadius: 24, width: '100%', padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, maxHeight: '90%' },
  modalInicioCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  modalInicioTitulo: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  modalInicioSubtitulo: { fontSize: 14, color: colors.textSecondary, marginBottom: 18, lineHeight: 20 },
  modalInicioInput: {
    borderWidth: 1,
    borderColor: '#D7E2EC',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  modalInicioPrimary: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
  },
  modalInicioPrimaryTxt: { color: 'white', fontSize: 15, fontWeight: '700' },
  modalInicioSecondary: {
    backgroundColor: '#F5F7FA', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  modalInicioSecondaryTxt: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  listadoMetaCard: {
    backgroundColor: '#F7FAFC', borderRadius: 14, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  listadoMetaLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  listadoMetaValue: { fontSize: 15, color: colors.textPrimary, fontWeight: '700' },
  listadoTitulo: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  miembroRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6',
  },
  miembroAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  miembroAvatarText: { color: 'white', fontSize: 11, fontWeight: '700' },
  miembroNombre: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  miembroRol: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  formContainer: { width: '100%', gap: 16, paddingBottom: 8 },
  formSection: { width: '100%' },
  botonesAccionRow: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },

  btnMarcarPagado: { backgroundColor: colors.textSecondary, width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  btnMarcarPagadoText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 },

  integrantesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', width: '100%' },
  avatarWrapper: { alignItems: 'center', position: 'relative', width: 52 },
  avatarForm: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarFormTexto: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  avatarNombre: { fontSize: 10, color: colors.textSecondary, marginTop: 4, textAlign: 'center', maxWidth: 52 },
  avatarRemoveBadge: { position: 'absolute', top: -2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ec6c6a', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  avatarAdd: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textSecondary, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center' },

  inputRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center', width: '100%' },
  textInput: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, fontSize: 14, color: colors.textPrimary, backgroundColor: '#fff' },
  btnInputConfirm: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 },

  dropdownPlaceholder: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 16, width: '100%', backgroundColor: '#fff' },
  dropdownMenu: { borderWidth: 1, borderColor: '#eee', borderRadius: 16, overflow: 'hidden', marginTop: 4, backgroundColor: '#fff', width: '100%' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  dropdownItemSelected: { backgroundColor: '#F0F4FF' },
  dropdownItemText: { fontSize: 14, color: colors.textPrimary, flex: 1 },

  rowModelos: { flexDirection: 'row', gap: 10, width: '100%' },
  modeloBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 16, backgroundColor: '#fff' },
  modeloSelected: { borderColor: colors.primary, backgroundColor: '#F0F4FF' },
  modeloText: { fontSize: 10, marginTop: 6, textAlign: 'center', fontWeight: '500', color: colors.textSecondary },

  btnAccion: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },

  proporcionalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12, width: '100%' },
  proporcionalInputs: { flex: 1 },
  proporcionalNombre: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  proporcionalFields: { flexDirection: 'row', gap: 8 },
  proporcionalFieldWrap: { flex: 1 },
  proporcionalFieldLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  proporcionalInput: { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, fontSize: 14, color: colors.textPrimary, backgroundColor: '#fff' },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyStateText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  reglaCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#F8F9FA', borderRadius: 14, marginBottom: 10, width: '100%' },
  reglaIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center' },
  reglaInfo: { flex: 1 },
  reglaNombre: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  reglaBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reglaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEEDFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reglaBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  reglaIntegrantes: { fontSize: 11, color: colors.textSecondary },

  badgePendiente: { backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgePendienteText: { fontSize: 10, fontWeight: '700', color: '#E65100' },
  badgeLiquidado: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeLiquidadoText: { fontSize: 10, fontWeight: '700', color: '#2E7D32' },
});
