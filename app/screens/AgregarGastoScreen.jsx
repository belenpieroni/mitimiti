import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { obtenerJuntada, agregarGasto } from '../services/juntadasService';
import { uploadTicketPhoto } from '../services/uploadService';
import CaptureTicketModal from '../components/CaptureTicketModal';
import { calcularParte } from '../utils/mathUtils';

export default function AgregarGastoScreen({ route, navigation }) {
  const { juntadaId } = route.params;
  
  const [juntada, setJuntada] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [pagador, setPagador] = useState('');
  const [splitMode, setSplitMode] = useState('equal');
  const [seleccionados, setSeleccionados] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mostrarPagadores, setMostrarPagadores] = useState(false);  
  const [fecha, setFecha] = useState(new Date());
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const [mostrarOCR, setMostrarOCR] = useState(false);
  const [adjuntoTicket, setAdjuntoTicket] = useState(null);
  const [ticketUrl, setTicketUrl] = useState(null);

  useFocusEffect(
    useCallback(() => { cargarJuntada(); }, [juntadaId])
  );

  async function cargarJuntada() {
    try {
      const data = await obtenerJuntada(juntadaId);
      setJuntada(data);
      setParticipantes(data.participantes || []);
      if (data.participantes?.length > 0) {
        setPagador(data.participantes[0].nombre);
        setSeleccionados(data.participantes.map(p => p.nombre));
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar la juntada');
    }
  }

  function handleOCRExtracted({ amount, photo, ticketUrl: urlDelServer }) {
    setMonto(amount.toString());
    setAdjuntoTicket(photo);
    if (urlDelServer) setTicketUrl(urlDelServer);
    Alert.alert('✓ Listo', `Importe $${amount.toFixed(2)} cargado y ticket adjunto`);
  }

  function toggleParticipante(nombreP) {
    if (seleccionados.includes(nombreP)) {
      setSeleccionados(seleccionados.filter(n => n !== nombreP));
    } else {
      setSeleccionados([...seleccionados, nombreP]);
    }
  }

  function toggleFamiliaCompleta(integrantes) {
    const todosTildados = integrantes.every(i => seleccionados.includes(i));
    if (todosTildados) {
      setSeleccionados(seleccionados.filter(n => !integrantes.includes(n)));
    } else {
      const nuevos = integrantes.filter(i => !seleccionados.includes(i));
      setSeleccionados([...seleccionados, ...nuevos]);
    }
  }

  const integrantesEnGrupos = (juntada?.subgrupos || []).flatMap(sg => sg.integrantes || []);
  const participantesSueltos = participantes.filter(p => !integrantesEnGrupos.includes(p.nombre));

  const montoNum = parseInt(monto) || 0;
  const puedeGuardar = nombre.trim() && montoNum > 0 && pagador && 
    (splitMode === 'equal' ? seleccionados.length > 0 : juntada?.subgrupos?.length > 0);

  async function handleGuardar() {
    if (!puedeGuardar) return;

    setGuardando(true);
    try {
      const datosGasto = {
        nombre: nombre.trim(),
        monto: montoNum,
        pagador,
        splitMode,
      };

      if (splitMode === 'subgroups' && juntada.subgrupos?.length > 0) {
        datosGasto.splitSubgroups = juntada.subgrupos.map(sg => sg.id);
      }

       if (splitMode === 'equal' && seleccionados.length > 0) {
        datosGasto.dividirEntre = seleccionados;
        datosGasto.beneficiarios = seleccionados;
      }

      if (adjuntoTicket) {
        if (ticketUrl) {
          datosGasto.ticketPhoto = ticketUrl;
        } else {
          try {
            const uploadResult = await uploadTicketPhoto(adjuntoTicket);
            datosGasto.ticketPhoto = uploadResult.url;
          } catch (uploadError) {
            console.warn('Error subiendo foto del ticket:', uploadError);
          }
        }
      }

      await agregarGasto(juntadaId, datosGasto);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!juntada) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: colors.background, edges: ['top'] }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVolver}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTextos}>
            <Text style={styles.headerTitle}>Nuevo gasto</Text>
            <Text style={styles.headerSubtitle}>{juntada.nombre}</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        enabled={Platform.OS === 'ios'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.montoSection}>
            <Text style={styles.montoLabel}>$</Text>
            <TextInput
              style={styles.montoInput}
              placeholder="0"
              keyboardType="numeric"
              value={monto}
              onChangeText={(text) => setMonto(text.replace(/\D/g, ''))}
              editable={!guardando}
              placeholderTextColor={colors.textSecondary + '80'}
            />
          </View>

          <TouchableOpacity 
            style={[styles.btnEscanearTicket, adjuntoTicket && styles.btnEscanearTicketActivo]}
            onPress={() => setMostrarOCR(true)}
            disabled={guardando}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name={adjuntoTicket ? "file-document-check" : "camera-outline"} 
              size={22} 
              color={colors.primary} 
            />
            <Text style={styles.btnEscanearTicketText}>
              {adjuntoTicket ? 'Ticket adjuntado con éxito' : 'Escanear ticket con cámara'}
            </Text>
            {adjuntoTicket && (
              <Ionicons name="checkmark-circle" size={20} color={colors.greenGlobal || '#1D6A4A'} />
            )}
          </TouchableOpacity>

          <Text style={styles.label}>CONCEPTO</Text>
          <View style={styles.fieldBox}>
            <TextInput
              style={styles.fieldInput}
              placeholder="Ej: Asado y bebidas"
              placeholderTextColor={colors.textSecondary + '80'}
              value={nombre}
              onChangeText={setNombre}
              editable={!guardando}
            />
          </View>

          <Text style={styles.label}>PAGADO POR</Text>
          <TouchableOpacity
            style={styles.pagadorCard}
            onPress={() => setMostrarPagadores(!mostrarPagadores)}
            activeOpacity={0.7}
          >
            <View style={[styles.pagadorAvatar, { backgroundColor: participantes.find(p => p.nombre === pagador)?.color || colors.primary }]}>
              <Text style={styles.pagadorAvatarTexto}>
                {participantes.find(p => p.nombre === pagador)?.iniciales || pagador.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.pagadorNombre}>{pagador}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {mostrarPagadores && (
            <View style={styles.pagadoresDropdown}>
              {participantes.map((p, index) => (
                <TouchableOpacity
                  key={p.nombre}
                  style={[styles.pagadorOption, index === participantes.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => {
                    setPagador(p.nombre);
                    setMostrarPagadores(false);
                  }}
                >
                  <View style={[styles.pagadorAvatar, { backgroundColor: p.color }]}>
                    <Text style={styles.pagadorAvatarTexto}>{p.iniciales}</Text>
                  </View>
                  <Text style={styles.pagadorOptionTexto}>{p.nombre}</Text>
                  {pagador === p.nombre && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Método de división */}
          <Text style={styles.label}>MÉTODO DE DIVISIÓN</Text>
          <View style={styles.metodosContainer}>
            <TouchableOpacity
              style={[styles.metodoPill, splitMode === 'equal' && styles.metodoPillActivo]}
              onPress={() => setSplitMode('equal')}
              activeOpacity={0.7}
            >
              <Ionicons name="person" size={18} color={splitMode === 'equal' ? 'white' : colors.textSecondary} />
              <Text style={[styles.metodoTitulo, splitMode === 'equal' && { color: 'white' }]}>Individual</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.metodoPill, 
                splitMode === 'subgroups' && styles.metodoPillActivo, 
                (!juntada.subgrupos || juntada.subgrupos.length === 0) && { opacity: 0.5 }
              ]}
              onPress={() => juntada.subgrupos?.length > 0 && setSplitMode('subgroups')}
              disabled={!juntada.subgrupos || juntada.subgrupos.length === 0}
              activeOpacity={0.7}
            >
              <Ionicons name="people" size={18} color={splitMode === 'subgroups' ? 'white' : colors.textSecondary} />
              <Text style={[styles.metodoTitulo, splitMode === 'subgroups' && { color: 'white' }]}>Por familias</Text>
            </TouchableOpacity>
          </View>

          {/* Mostrar subgrupos o participantes */}
          {splitMode === 'subgroups' && juntada.subgrupos?.length > 0 ? (
            <>
              <Text style={styles.label}>SUBGRUPOS SELECCIONADOS · {juntada.subgrupos.length}</Text>
              <View style={styles.subgruposListDivision}>
                {juntada.subgrupos.map(sg => (
                  <View key={sg.id} style={styles.subgrupoDivisionCard}>
                    <View style={styles.checkbox}>
                      <Ionicons name="checkmark" size={14} color="white" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subgrupoDivisionNombre}>{sg.nombre}</Text>
                      <Text style={styles.subgrupoDivisionIntegrantes}>
                        {sg.integrantes.join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : splitMode === 'equal' ? (
            <>
              <View style={styles.dividirEntreHeader}>
                <Text style={styles.label}>DIVIDIR ENTRE · {seleccionados.length}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => setSeleccionados(participantes.map(p => p.nombre))}>
                    <Text style={styles.btnActionTxt}>Todos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSeleccionados([])}>
                    <Text style={styles.btnActionTxt}>Ninguno</Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* ── CHECKLIST GRUPAL / FAMILIAR ── */}
              <View style={styles.checklistContainer}>
                {/* Renderizar Familias */}
                {(juntada.subgrupos || []).map(sg => {
                  const todosTildados = sg.integrantes.every(i => seleccionados.includes(i));
                  return (
                    <View key={sg.id} style={styles.familiaCard}>
                      <View style={styles.familiaHeader}>
                        <Text style={styles.familiaNombre}>👨‍👩‍👧‍👦 {sg.nombre}</Text>
                        <TouchableOpacity onPress={() => toggleFamiliaCompleta(sg.integrantes)}>
                          <Text style={styles.btnFamiliaAction}>
                            {todosTildados ? 'Quitar grupo' : 'Sumar grupo'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.participantesListDivision}>
                        {sg.integrantes.map(nombreInt => {
                          const p = participantes.find(part => part.nombre === nombreInt);
                          if (!p) return null;
                          const activo = seleccionados.includes(p.nombre);
                          return (
                            <TouchableOpacity
                              key={p.id || p.nombre}
                              style={[styles.chipParticipante, activo && styles.chipParticipanteActivo]}
                              onPress={() => toggleParticipante(p.nombre)}
                              disabled={guardando}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.avatarExtraChico, { backgroundColor: p.color }]}>
                                <Text style={styles.avatarTextoExtraChico}>{p.iniciales}</Text>
                              </View>
                              <Text style={[styles.chipNombre, activo && { fontWeight: '700', color: 'white' }]}>
                                {p.nombre}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                {/* Renderizar los que van solos */}
                {participantesSueltos.length > 0 && (
                  <View style={styles.familiaCard}>
                    <View style={styles.familiaHeader}>
                      <Text style={styles.familiaNombre}>👤 Individuales</Text>
                    </View>
                    <View style={styles.participantesListDivision}>
                      {participantesSueltos.map(p => {
                        const activo = seleccionados.includes(p.nombre);
                        return (
                          <TouchableOpacity
                            key={p.id || p.nombre}
                            style={[styles.chipParticipante, activo && styles.chipParticipanteActivo]}
                            onPress={() => toggleParticipante(p.nombre)}
                            disabled={guardando}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.avatarExtraChico, { backgroundColor: p.color }]}>
                              <Text style={styles.avatarTextoExtraChico}>{p.iniciales}</Text>
                            </View>
                            <Text style={[styles.chipNombre, activo && { fontWeight: '700', color: 'white' }]}>
                              {p.nombre}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {montoNum > 0 && seleccionados.length > 0 && (
                <Text style={styles.calcularDiv}>
                  Cada uno paga <Text style={{ fontWeight: '800', color: colors.primary }}>
                    ${calcularParte(montoNum, seleccionados.length).toLocaleString('es-AR')}
                  </Text>
                </Text>
              )}
            </>
          ) : null}

          {/* Fecha */}
          <Text style={styles.label}>FECHA DEL GASTO</Text>
          <TouchableOpacity 
            style={styles.fieldBox} 
            onPress={() => setMostrarFecha(true)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              <Text style={styles.fieldInput}>
                {fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>

          {mostrarFecha && (
            <DateTimePicker
              value={fecha}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                const tipo = event?.type;
                if (tipo === 'dismissed' || tipo === 'set') {
                  setMostrarFecha(false);
                }
                if ((tipo === 'set' || !tipo) && selectedDate) {
                  setFecha(selectedDate);
                  setMostrarFecha(false);
                }
              }}
              maximumDate={new Date()}
            />
          )}

          {/* Botón guardar */}
          <TouchableOpacity
            style={[styles.btnGuardarGasto, !puedeGuardar && { opacity: 0.5, backgroundColor: colors.textSecondary }]}
            onPress={handleGuardar}
            disabled={!puedeGuardar || guardando}
            activeOpacity={0.8}
          >
            {guardando ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnGuardarGastoTexto}>Confirmar gasto</Text>
            )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <CaptureTicketModal
        visible={mostrarOCR}
        onClose={() => setMostrarOCR(false)}
        onAmountExtracted={handleOCRExtracted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    pt: 8,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
  },
  btnVolver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(82, 109, 130, 0.15)',
  },
  headerTextos: { flex: 1 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  montoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  montoLabel: {
    fontSize: 40,
    color: colors.primary,
    fontWeight: '700',
    marginRight: 6,
    marginBottom: 4,
  },
  montoInput: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.primary,
    padding: 0,
    letterSpacing: -1.5,
    minWidth: 80,
    textAlign: 'center',
  },

  btnEscanearTicket: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 32,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: 'rgba(71, 52, 114, 0.04)',
  },
  btnEscanearTicketActivo: {
    backgroundColor: 'rgba(71, 52, 114, 0.1)',
    borderStyle: 'solid',
  },
  btnEscanearTicketText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
    textTransform: 'uppercase',
  },
  fieldBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(82, 109, 130, 0.15)',
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
    marginBottom: 20,
  },
  fieldInput: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    padding: 0,
  },

  pagadorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(82, 109, 130, 0.15)',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 20,
  },
  pagadorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagadorAvatarTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  pagadorNombre: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  pagadoresDropdown: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(82, 109, 130, 0.15)',
    marginBottom: 20,
    marginTop: -8,
    overflow: 'hidden',
  },
  pagadorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82, 109, 130, 0.1)',
  },
  pagadorOptionTexto: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  metodosContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metodoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(82, 109, 130, 0.15)',
  },
  metodoPillActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  metodoTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  dividirEntreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  btnActionTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  
  checklistContainer: {
    gap: 14,
    marginBottom: 12,
  },
  familiaCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(82, 109, 130, 0.15)',
    padding: 16,
  },
  familiaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  familiaNombre: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  btnFamiliaAction: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  participantesListDivision: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipParticipante: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(82, 109, 130, 0.1)',
  },
  chipParticipanteActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  avatarExtraChico: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextoExtraChico: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  chipNombre: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  calcularDiv: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingLeft: 4,
    marginBottom: 24,
    marginTop: 4,
  },

  subgruposListDivision: {
    gap: 12,
    marginBottom: 24,
  },
  subgrupoDivisionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subgrupoDivisionNombre: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subgrupoDivisionIntegrantes: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  btnGuardarGasto: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGuardarGastoTexto: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});