import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import api from '../services/api';
import { obtenerJuntada, agregarGasto, eliminarGasto, agregarSubgrupo, editarSubgrupo, eliminarSubgrupo } from '../services/juntadasService';

function formatPesos(monto) {
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}

const iconosGasto  = ['basket-outline', 'wine-outline', 'flame-outline', 'cart-outline', 'restaurant-outline'];
const coloresIcono = ['#c084fc', '#526D82', '#42b271', '#473472', '#f97316'];

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function JuntadaDetalleScreen({ route, navigation }) {
  const { juntadaId } = route.params;
  const [juntada, setJuntada]           = useState(null);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState(null);
  const [subgruposVisible, setSubgruposVisible] = useState(false);
  const [actionsVisible, setActionsVisible]     = useState(false);
  const [confirmEliminar, setConfirmEliminar]   = useState(false);
  
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
    cargarJuntada();
  }

  async function handleEditarSubgrupo(sgid, datos) {
    await editarSubgrupo(juntadaId, sgid, datos);
    cargarJuntada();
  }

  async function handleEliminarSubgrupo(subgrupoId) {
    try {
      await eliminarSubgrupo(juntadaId, subgrupoId);
      cargarJuntada();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
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
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.navigate('JuntadasList')}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitulo}>{juntada.nombre}</Text>
          <Text style={styles.headerSub}>{juntada.participantes.length} participantes · {juntada.fecha}</Text>
        </View>
        <TouchableOpacity style={styles.btnMenu} onPress={() => setActionsVisible(true)}>
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

        {/* Botón Subgrupos – card ancho completo */}
        <TouchableOpacity
          onPress={() => setSubgruposVisible(true)}
          style={styles.subgruposBtn}
        >
          <View style={styles.subgruposBtnIcon}>
            <Ionicons name="people" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subgruposBtnTitulo}>Subgrupos</Text>
            <Text style={styles.subgruposBtnSubtitulo}>
              {!juntada.subgrupos || juntada.subgrupos.length === 0
                ? 'Agrupá parejas o familias para dividir por núcleo'
                : `${juntada.subgrupos.length} configurado${juntada.subgrupos.length === 1 ? '' : 's'} · ${juntada.subgrupos.map(s => s.nombre).join(', ')}`}
            </Text>
          </View>
          <Ionicons name="add" size={18} color={colors.primary} />
        </TouchableOpacity>

        {/* Gastos */}
        <View style={styles.gastosHeader}>
          <Text style={styles.gastosLabel}>GASTOS · {juntada.gastos.length}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AgregarGasto', { juntadaId })}>
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

      {/* Bottom sheet Subgrupos */}
      <SubgruposSheet
        visible={subgruposVisible}
        juntada={juntada}
        participantes={juntada.participantes}
        onCerrar={() => setSubgruposVisible(false)}
        onGuardar={handleAgregarSubgrupo}
        onEditar={handleEditarSubgrupo}
        onEliminar={handleEliminarSubgrupo}
      />

      {/* Actions sheet (tres puntos) */}
      <ActionsSheet
        visible={actionsVisible}
        titulo={juntada.nombre}
        onCerrar={() => setActionsVisible(false)}
        onEditar={() => {
          setActionsVisible(false);
          navigation.navigate('CrearJuntada', {
            juntadaId,
            nombre: juntada.nombre,
            descripcion: juntada.descripcion || '',
            participantes: juntada.participantes,
          });
        }}
        onEliminar={() => { setActionsVisible(false); setConfirmEliminar(true); }}
      />

      {/* Confirm eliminar juntada */}
      {confirmEliminar && (
        <ConfirmSheet
          titulo="Eliminar juntada"
          mensaje={`Se borrará "${juntada.nombre}" y todos sus gastos. Esta acción no se puede deshacer.`}
          onCancelar={() => setConfirmEliminar(false)}
          onConfirmar={async () => {
            try {
              await api.delete(`/juntadas/${juntadaId}`);
              setConfirmEliminar(false);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          }}
        />
      )}
    </View>
  );
}

// ── Estilos compartidos ActionsSheet / ConfirmSheet ─────────────────────────
const actSheet = StyleSheet.create({
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  titulo: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  btnClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  btnEditar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.cardBg,
  },
  btnIconEdit: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary + '1F', justifyContent: 'center', alignItems: 'center' },
  btnEditarTxt: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  btnEliminar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FDECEC', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.redGlobal + '33',
  },
  btnIconDelete: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.redGlobal + '26', justifyContent: 'center', alignItems: 'center' },
  btnEliminarTxt: { fontSize: 14, fontWeight: '600', color: colors.redGlobal },
  confirmBox: { backgroundColor: 'white', borderRadius: 20, padding: 24, width: '100%' },
  confirmTitulo: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  confirmMensaje: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  confirmBotones: { flexDirection: 'row', gap: 10 },
  confirmCancelar: { flex: 1, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBg },
  confirmCancelarTxt: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  confirmEliminar: { flex: 1, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.redGlobal },
  confirmEliminarTxt: { fontSize: 14, fontWeight: '600', color: 'white' },
});

// ── Actions Sheet (tres puntos) ──────────────────────────────────────────────
function ActionsSheet({ visible, titulo, onCerrar, onEditar, onEliminar }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCerrar} />
        <View style={actSheet.sheet}>
          <View style={actSheet.header}>
            <Text style={actSheet.titulo}>{titulo}</Text>
            <TouchableOpacity style={actSheet.btnClose} onPress={onCerrar}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={{ gap: 10 }}>
            <TouchableOpacity style={actSheet.btnEditar} onPress={onEditar}>
              <View style={actSheet.btnIconEdit}>
                <Ionicons name="pencil" size={18} color={colors.primary} />
              </View>
              <Text style={actSheet.btnEditarTxt}>Editar juntada</Text>
            </TouchableOpacity>
            <TouchableOpacity style={actSheet.btnEliminar} onPress={onEliminar}>
              <View style={actSheet.btnIconDelete}>
                <Ionicons name="trash" size={18} color={colors.redGlobal} />
              </View>
              <Text style={actSheet.btnEliminarTxt}>Eliminar juntada</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmSheet({ titulo, mensaje, onCancelar, onConfirmar }) {
  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 }}>
        <View style={actSheet.confirmBox}>
          <Text style={actSheet.confirmTitulo}>{titulo}</Text>
          <Text style={actSheet.confirmMensaje}>{mensaje}</Text>
          <View style={actSheet.confirmBotones}>
            <TouchableOpacity style={actSheet.confirmCancelar} onPress={onCancelar}>
              <Text style={actSheet.confirmCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={actSheet.confirmEliminar} onPress={onConfirmar}>
              <Text style={actSheet.confirmEliminarTxt}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Bottom Sheet: Subgrupos ──────────────────────────────────────────────────
function SubgruposSheet({ visible, juntada, participantes, onCerrar, onGuardar, onEditar, onEliminar }) {
  const [creando, setCreando]       = useState(false);
  const [editando, setEditando]     = useState(null); // subgrupo que se está editando
  const [nombre, setNombre]         = useState('');
  const [seleccionados, setSelec]   = useState([]);
  const [guardando, setGuardando]   = useState(false);

  const subgrupos = juntada.subgrupos || [];

  function toggle(nombreP) {
    setSelec(s => s.includes(nombreP) ? s.filter(n => n !== nombreP) : [...s, nombreP]);
  }

  function abrirEditar(sg) {
    setEditando(sg);
    setNombre(sg.nombre);
    setSelec(sg.integrantes);
  }

  function cerrarFormulario() {
    setCreando(false);
    setEditando(null);
    setNombre('');
    setSelec([]);
  }

  async function handleGuardar() {
    if (!nombre.trim() || seleccionados.length < 2) return;
    setGuardando(true);
    try {
      if (editando) {
        await onEditar(editando.id, { nombre: nombre.trim(), integrantes: seleccionados });
      } else {
        await onGuardar({ nombre: nombre.trim(), integrantes: seleccionados });
      }
      cerrarFormulario();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  function handleEliminar(id) {
    Alert.alert('Eliminar subgrupo', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onEliminar(id) },
    ]);
  }

  const mostrandoForm = creando || !!editando;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => { cerrarFormulario(); onCerrar(); }}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={sg.sheet}>
          {/* Header */}
          <View style={sg.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="people" size={18} color={colors.primary} />
              <Text style={sg.titulo}>Subgrupos · {subgrupos.length}</Text>
            </View>
            <TouchableOpacity
              style={sg.btnClose}
              onPress={() => { cerrarFormulario(); onCerrar(); }}
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={sg.descripcion}>
            Agrupá familias o parejas para dividir los gastos por núcleo, no por persona.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
            {mostrandoForm ? (
              // ── Formulario crear / editar ──
              <View>
                <TextInput
                  autoFocus
                  style={sg.input}
                  placeholder="Nombre del subgrupo (ej. Familia López)"
                  placeholderTextColor={colors.textSecondary}
                  value={nombre}
                  onChangeText={setNombre}
                  editable={!guardando}
                />
                <View style={sg.chipsBg}>
                  {participantes.map(p => {
                    const sel = seleccionados.includes(p.nombre);
                    return (
                      <TouchableOpacity
                        key={p.nombre}
                        onPress={() => toggle(p.nombre)}
                        style={[sg.personChip, sel && sg.personChipActivo]}
                      >
                        <View style={[sg.personAvatar, { backgroundColor: p.color }]}>
                          <Text style={sg.personAvatarTxt}>{p.iniciales}</Text>
                        </View>
                        <Text style={[sg.personNombre, sel && { color: 'white' }]}>{p.nombre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={sg.formBotones}>
                  <TouchableOpacity style={sg.btnCancelar} onPress={cerrarFormulario}>
                    <Text style={sg.btnCancelarTxt}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[sg.btnGuardar, (!nombre.trim() || seleccionados.length < 2) && { opacity: 0.5 }]}
                    onPress={handleGuardar}
                    disabled={!nombre.trim() || seleccionados.length < 2 || guardando}
                  >
                    {guardando ? <ActivityIndicator color="white" /> : <Text style={sg.btnGuardarTxt}>{editando ? 'Guardar' : 'Crear'}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // ── Lista de subgrupos ──
              <View style={{ gap: 8, marginBottom: 12 }}>
                {subgrupos.length === 0 ? (
                  <View style={sg.empty}>
                    <Ionicons name="people-outline" size={32} color={colors.textSecondary} strokeWidth={1.4} />
                    <Text style={sg.emptyTitulo}>Aún no creaste subgrupos</Text>
                    <Text style={sg.emptySubtitulo}>Útil para parejas, familias o cualquier núcleo que pague junto.</Text>
                  </View>
                ) : (
                  subgrupos.map(s => (
                    <View key={s.id} style={sg.card}>
                      <View style={sg.cardIcon}>
                        <Ionicons name="people" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={sg.cardNombre}>{s.nombre}</Text>
                        <Text style={sg.cardIntegrantes}>{s.integrantes.join(' · ')}</Text>
                      </View>
                      <TouchableOpacity
                        style={sg.btnEdit}
                        onPress={() => abrirEditar(s)}
                      >
                        <Ionicons name="pencil" size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={sg.btnDelete}
                        onPress={() => handleEliminar(s.id)}
                      >
                        <Ionicons name="trash" size={14} color={colors.redGlobal} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>

          {!mostrandoForm && (
            <TouchableOpacity style={sg.btnNuevo} onPress={() => setCreando(true)}>
              <Ionicons name="add" size={16} color="white" />
              <Text style={sg.btnNuevoTxt}>Nuevo subgrupo</Text>
            </TouchableOpacity>
          )}
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const sg = StyleSheet.create({
  sheet: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  titulo: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  btnClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'white', justifyContent: 'center', alignItems: 'center',
  },
  descripcion: { fontSize: 12, color: colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  input: {
    height: 50, backgroundColor: 'white', borderRadius: 16,
    paddingHorizontal: 16, fontSize: 14, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.cardBg, marginBottom: 10,
  },
  chipsBg: {
    backgroundColor: 'white', borderRadius: 16, padding: 12,
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    borderWidth: 1, borderColor: colors.cardBg, marginBottom: 16,
  },
  personChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background, borderRadius: 20,
    paddingLeft: 4, paddingRight: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.cardBg,
  },
  personChipActivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  personAvatar: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  personAvatarTxt: { fontSize: 9, fontWeight: '700', color: 'white' },
  personNombre: { fontSize: 12, fontWeight: '500', color: colors.textPrimary },
  formBotones: { flexDirection: 'row', gap: 10 },
  btnCancelar: {
    flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'white', borderWidth: 1, borderColor: colors.cardBg,
  },
  btnCancelarTxt: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  btnGuardar: {
    flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primary,
  },
  btnGuardarTxt: { fontSize: 14, fontWeight: '600', color: 'white' },
  empty: {
    backgroundColor: 'white', borderRadius: 16, padding: 24,
    alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.cardBg,
    marginBottom: 4,
  },
  emptyTitulo: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: 8 },
  emptySubtitulo: { fontSize: 11, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.cardBg,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.primary + '1F', justifyContent: 'center', alignItems: 'center',
  },
  cardNombre: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardIntegrantes: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  btnEdit: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary + '18', justifyContent: 'center', alignItems: 'center',
    marginRight: 6,
  },
  btnDelete: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.redGlobal + '12', justifyContent: 'center', alignItems: 'center',
  },
  btnNuevo: {
    height: 50, backgroundColor: colors.primary, borderRadius: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4,
  },
  btnNuevoTxt: { fontSize: 14, fontWeight: '600', color: 'white' },
});

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
  btnMenu: {
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
  // Botón Subgrupos en el detalle
  subgruposBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'white', borderRadius: 16, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: colors.cardBg,
  },
  subgruposBtnIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primary + '1F', justifyContent: 'center', alignItems: 'center',
  },
  subgruposBtnTitulo: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  subgruposBtnSubtitulo: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});
