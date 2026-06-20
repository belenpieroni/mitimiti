import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { obtenerJuntada, agregarGasto, eliminarGasto } from '../services/juntadasService';
import { obtenerJuntada, agregarGasto, eliminarGasto, agregarSubgrupo } from '../services/juntadasService';

function formatPesos(monto) {
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}

const iconosGasto  = ['basket-outline', 'wine-outline', 'flame-outline', 'cart-outline', 'restaurant-outline'];
const coloresIcono = ['#c084fc', '#526D82', '#42b271', '#473472', '#f97316'];

// ── Modal: Agregar Gasto ──────────────────────────────────────────────────────
function ModalAgregarGasto({ visible, participantes, onCerrar, onGuardar }) {
  const [nombre, setNombre]     = useState('');
  const [monto, setMonto]       = useState('');
  const [pagador, setPagador]   = useState(participantes[0]?.nombre || '');
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    const montoNum = parseFloat(monto.replace(',', '.'));
    if (!nombre.trim() || isNaN(montoNum) || montoNum <= 0 || !pagador) return;
    setGuardando(true);
    try {
      await onGuardar({ nombre: nombre.trim(), monto: montoNum, pagador });
      setNombre(''); setMonto(''); setPagador(participantes[0]?.nombre || '');
      onCerrar();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <Text style={mStyles.titulo}>Nuevo gasto</Text>

          <Text style={mStyles.label}>DESCRIPCIÓN</Text>
          <TextInput style={mStyles.input} placeholder="Ej: Carne y verduras"
            placeholderTextColor={colors.accent} value={nombre} onChangeText={setNombre} />

          <Text style={mStyles.label}>MONTO ($)</Text>
          <TextInput style={mStyles.input} placeholder="0" keyboardType="numeric"
            placeholderTextColor={colors.accent} value={monto} onChangeText={setMonto} />

          <Text style={mStyles.label}>¿QUIÉN PAGÓ?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {participantes.map((p) => (
              <TouchableOpacity
                key={p.id || p.nombre}
                style={[mStyles.chip, pagador === p.nombre && mStyles.chipActivo]}
                onPress={() => setPagador(p.nombre)}
              >
                <View style={[mStyles.chipAvatar, { backgroundColor: p.color }]}>
                  <Text style={mStyles.chipAvatarTexto}>{p.iniciales}</Text>
                </View>
                <Text style={[mStyles.chipNombre, pagador === p.nombre && { color: colors.primary }]}>
                  {p.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={mStyles.botones}>
            <TouchableOpacity style={mStyles.btnCancelar} onPress={onCerrar}>
              <Text style={mStyles.btnCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mStyles.btnGuardar, guardando && { opacity: 0.6 }]}
              onPress={handleGuardar} disabled={guardando}
            >
              {guardando ? <ActivityIndicator color="white" /> : <Text style={mStyles.btnGuardarTexto}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Modal: Gestionar Subgrupos ────────────────────────────────────────────────
function ModalSubgrupos({ visible, participantes, subgrupos = [], onCerrar, onGuardar }) {
  const [nombre, setNombre] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [guardando, setGuardando] = useState(false);

  function toggleParticipante(nombreP) {
    if (seleccionados.includes(nombreP)) {
      setSeleccionados(seleccionados.filter(n => n !== nombreP));
    } else {
      setSeleccionados([...seleccionados, nombreP]);
    }
  }

  async function handleGuardar() {
    if (!nombre.trim() || seleccionados.length < 2) return;
    setGuardando(true);
    try {
      await onGuardar({ nombre: nombre.trim(), integrantes: seleccionados });
      setNombre('');
      setSeleccionados([]);
      onCerrar();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={mStyles.overlay}>
        <View style={mStyles.sheet}>
          <Text style={mStyles.titulo}>Gestión de Subgrupos</Text>

          {subgrupos.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={mStyles.label}>SUBGRUPOS CREADOS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {subgrupos.map(sg => (
                  <View key={sg.id} style={[mStyles.chip, { borderColor: colors.primary }]}>
                    <Text style={[mStyles.chipNombre, { color: colors.primary }]}>
                      {sg.nombre} ({sg.integrantes.length})
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={mStyles.label}>NUEVO SUBGRUPO</Text>
          <TextInput 
            style={mStyles.input} 
            placeholder="Ej: Familia López o Pareja Ana y Tomás"
            placeholderTextColor={colors.accent} 
            value={nombre} 
            onChangeText={setNombre} 
          />

          <Text style={mStyles.label}>INTEGRANTES (Mínimo 2)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, marginTop: 8 }}>
            {participantes.map((p) => {
              const activo = seleccionados.includes(p.nombre);
              return (
                <TouchableOpacity
                  key={p.id || p.nombre}
                  style={[mStyles.chip, activo && mStyles.chipActivo]}
                  onPress={() => toggleParticipante(p.nombre)}
                >
                  <Ionicons name={activo ? "checkbox" : "square-outline"} size={16} color={activo ? colors.primary : colors.textSecondary} />
                  <Text style={[mStyles.chipNombre, activo && { color: colors.primary, fontWeight: 'bold' }]}>
                    {p.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={mStyles.botones}>
            <TouchableOpacity style={mStyles.btnCancelar} onPress={onCerrar}>
              <Text style={mStyles.btnCancelarTexto}>Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mStyles.btnGuardar, (guardando || seleccionados.length < 2 || !nombre.trim()) && { opacity: 0.6 }]}
              onPress={handleGuardar} 
              disabled={guardando || seleccionados.length < 2 || !nombre.trim()}
            >
              {guardando ? <ActivityIndicator color="white" /> : <Text style={mStyles.btnGuardarTexto}>Crear</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function JuntadaDetalleScreen({ route, navigation }) {
  const { juntadaId } = route.params;
  const [juntada, setJuntada]           = useState(null);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSubgruposVisible, setModalSubgruposVisible] = useState(false);
  
  const cargarJuntada = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerJuntada(juntadaId);
      setJuntada(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [juntadaId]);

  useFocusEffect(
    useCallback(() => { cargarJuntada(); }, [cargarJuntada])
  );

  async function handleEliminarGasto(gastoId) {
    Alert.alert('Eliminar gasto', '¿Seguro que querés eliminar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await eliminarGasto(juntadaId, gastoId);
            cargarJuntada();
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  }

  async function handleAgregarGasto(datosGasto) {
    await agregarGasto(juntadaId, datosGasto);
    cargarJuntada();
  }

  async function handleAgregarSubgrupo(datos) {
    await agregarSubgrupo(juntadaId, datos);
    cargarJuntada(); // Refresca la pantalla para que aparezca
  }

  if (cargando) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !juntada) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.errorTexto}>{error || 'Juntada no encontrada'}</Text>
        <TouchableOpacity style={styles.btnReintentar} onPress={cargarJuntada}>
          <Text style={styles.btnReintentarTexto}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalGastado = juntada.gastos.reduce((a, g) => a + g.monto, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitulo}>{juntada.nombre}</Text>
          <Text style={styles.headerSub}>{juntada.participantes.length} participantes · {juntada.fecha}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Card total */}
        <View style={styles.cardTotal}>
          <Text style={styles.cardTotalLabel}>Total gastado</Text>
          <Text style={styles.cardTotalMonto}>{formatPesos(totalGastado)}</Text>
          <View style={styles.avatarStack}>
            {juntada.participantes.map((p, i) => (
              <View key={i} style={[styles.avatar, { backgroundColor: p.color, marginLeft: i === 0 ? 0 : -8 }]}>
                <Text style={styles.avatarTexto}>{p.iniciales}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Botón para gestionar Subgrupos */}
        <View style={{ flexDirection: 'row', marginBottom: 20 }}>
          <TouchableOpacity 
            onPress={() => setModalSubgruposVisible(true)} 
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.cardBg, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '33' }}
          >
            <Ionicons name="people" size={18} color={colors.primary} />
            <Text style={{ fontWeight: '600', color: colors.primary, fontSize: 13 }}>Gestionar Subgrupos (Familias / Parejas)</Text>
          </TouchableOpacity>
        </View>

        {/* Gastos */}
        <View style={styles.gastosHeader}>
          <Text style={styles.gastosLabel}>GASTOS · {juntada.gastos.length}</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Text style={styles.btnAgregar}>+ Agregar</Text>
          </TouchableOpacity>
        </View>

        {juntada.gastos.length === 0 ? (
          <View style={styles.vacioCentrado}>
            <Ionicons name="receipt-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.vacioTexto}>Sin gastos todavía. ¡Agregá el primero!</Text>
          </View>
        ) : (
          juntada.gastos.map((g, i) => (
            <View key={g.id} style={styles.gastoCard}>
              <View style={[styles.gastoIcono, { backgroundColor: coloresIcono[i % coloresIcono.length] + '22' }]}>
                <Ionicons name={iconosGasto[i % iconosGasto.length]} size={20} color={coloresIcono[i % coloresIcono.length]} />
              </View>
              <View style={styles.gastoInfo}>
                <Text style={styles.gastoNombre}>{g.nombre}</Text>
                <Text style={styles.gastoPagador}>Pagó {g.pagador}</Text>
              </View>
              <Text style={styles.gastoMonto}>{formatPesos(g.monto)}</Text>
              <TouchableOpacity style={styles.btnEliminar} onPress={() => handleEliminarGasto(g.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.redGlobal} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.btnBalance}
          onPress={() => navigation.navigate('Balance', { juntadaId })}
        >
          <Text style={styles.btnBalanceTexto}>Ver balance</Text>
        </TouchableOpacity>
      </View>

      {/* Modal agregar gasto */}
      <ModalAgregarGasto
        visible={modalVisible}
        participantes={juntada.participantes}
        onCerrar={() => setModalVisible(false)}
        onGuardar={handleAgregarGasto}
      />

      {/* Modal gestionar subgrupos */}
      <ModalSubgrupos
      visible={modalSubgruposVisible}
      participantes={juntada.participantes}
      subgrupos={juntada.subgrupos || []}
      onCerrar={() => setModalSubgruposVisible(false)}
      onGuardar={handleAgregarSubgrupo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, gap: 10,
  },
  btnVolver: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1 },
  headerTitulo: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  headerSub: { fontSize: 12, color: colors.textSecondary },
  content: { padding: 16, paddingBottom: 100 },
  cardTotal: {
    backgroundColor: colors.primary, borderRadius: 20, padding: 20, marginBottom: 24,
  },
  cardTotalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 },
  cardTotalMonto: { color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 16 },
  avatarStack: { flexDirection: 'row' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.primary,
  },
  avatarTexto: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  gastosHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  gastosLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5 },
  btnAgregar: { fontSize: 14, fontWeight: '600', color: colors.primary },
  gastoCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  gastoIcono: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  gastoInfo: { flex: 1 },
  gastoNombre: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  gastoPagador: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  gastoMonto: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  btnEliminar: { padding: 4 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: colors.background,
  },
  btnBalance: { backgroundColor: colors.primary, borderRadius: 16, padding: 18, alignItems: 'center' },
  btnBalanceTexto: { color: 'white', fontSize: 16, fontWeight: '700' },
  vacioCentrado: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  vacioTexto: { color: colors.textSecondary, fontSize: 13 },
  errorTexto: { color: colors.textSecondary, textAlign: 'center' },
  btnReintentar: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  btnReintentarTexto: { color: 'white', fontWeight: '600' },
});

const mStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  titulo: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.5, marginBottom: 8, marginTop: 12,
  },
  input: {
    backgroundColor: colors.cardBg, borderRadius: 12,
    padding: 14, fontSize: 15, color: colors.textPrimary,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.cardBg, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 10, marginRight: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActivo: { borderColor: colors.primary },
  chipAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  chipAvatarTexto: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  chipNombre: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  botones: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnCancelar: {
    flex: 1, borderRadius: 14, padding: 16, alignItems: 'center',
    backgroundColor: colors.cardBg,
  },
  btnCancelarTexto: { color: colors.textPrimary, fontWeight: '600' },
  btnGuardar: {
    flex: 2, borderRadius: 14, padding: 16, alignItems: 'center',
    backgroundColor: colors.primary,
  },
  btnGuardarTexto: { color: 'white', fontWeight: '700', fontSize: 15 },
});
