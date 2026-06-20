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
  const [mostrarPagadores, setMostrarPagadores] = useState(false);  const [fecha, setFecha]        = useState(new Date());
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const [mostrarOCR, setMostrarOCR] = useState(false);
  const [adjuntoTicket, setAdjuntoTicket] = useState(null);
  const [ticketUrl, setTicketUrl] = useState(null); // URL en el server (si vino del OCR)
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
    if (urlDelServer) setTicketUrl(urlDelServer); // ya quedó subida al escanear
    Alert.alert('✓ Listo', `Importe $${amount.toFixed(2)} cargado y ticket adjunto`);
  }

  function toggleParticipante(nombreP) {
    if (seleccionados.includes(nombreP)) {
      setSeleccionados(seleccionados.filter(n => n !== nombreP));
    } else {
      setSeleccionados([...seleccionados, nombreP]);
    }
  }

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
      }

      // Subir foto del ticket si existe
      if (adjuntoTicket) {
        if (ticketUrl) {
          // Ya se subió durante el escaneo OCR: reutilizamos esa URL.
          datosGasto.ticketPhoto = ticketUrl;
        } else {
          try {
            const uploadResult = await uploadTicketPhoto(adjuntoTicket);
            datosGasto.ticketPhoto = uploadResult.url;
          } catch (uploadError) {
            console.warn('Error subiendo foto del ticket:', uploadError);
            // Continuar sin foto si falla el upload
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
      {/* Header fijo arriba */}
      <SafeAreaView style={{ backgroundColor: colors.background }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40 }}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
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
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Botón Escanear ticket con borde punteado */}
        <TouchableOpacity 
          style={[styles.btnEscanearTicket, adjuntoTicket && styles.btnEscanearTicketActivo]}
          onPress={() => setMostrarOCR(true)}
          disabled={guardando}
        >
          <MaterialCommunityIcons name="camera" size={20} color={colors.primary} />
          <Text style={styles.btnEscanearTicketText}>Escanear ticket</Text>
          {adjuntoTicket && (
            <MaterialCommunityIcons 
              name="check-circle" 
              size={20} 
              color={colors.primary}
              style={{ marginLeft: 'auto' }}
            />
          )}
        </TouchableOpacity>

        {/* Concepto */}
        <Text style={styles.label}>CONCEPTO</Text>
        <View style={styles.fieldBox}>
          <TextInput
            style={styles.fieldInput}
            placeholder="¿Para qué fue?"
            placeholderTextColor={colors.accent}
            value={nombre}
            onChangeText={setNombre}
            editable={!guardando}
          />
        </View>

        {/* Pagado por */}
        <Text style={styles.label}>PAGADO POR</Text>
        <TouchableOpacity
          style={styles.pagadorCard}
          onPress={() => setMostrarPagadores(!mostrarPagadores)}
        >
          <View style={[styles.pagadorAvatar, { backgroundColor: participantes.find(p => p.nombre === pagador)?.color }]}>
            <Text style={styles.pagadorAvatarTexto}>
              {participantes.find(p => p.nombre === pagador)?.iniciales}
            </Text>
          </View>
          <Text style={styles.pagadorNombre}>{pagador}</Text>
          <Text style={styles.cambiarButton}>Cambiar</Text>
        </TouchableOpacity>

        {mostrarPagadores && (
          <View style={styles.pagadoresDropdown}>
            {participantes.map(p => (
              <TouchableOpacity
                key={p.nombre}
                style={styles.pagadorOption}
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

        {/* Método de división - grid 2 columnas */}
        <Text style={styles.label}>MÉTODO DE DIVISIÓN</Text>
        <View style={styles.metodosContainer}>
          <TouchableOpacity
            style={[styles.metodoPill, splitMode === 'equal' && styles.metodoPillActivo]}
            onPress={() => setSplitMode('equal')}
          >
            <View style={[styles.metodoPillIconBox, splitMode === 'equal' && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="people" size={18} color={splitMode === 'equal' ? 'white' : colors.primary} />
            </View>
            <Text style={[styles.metodoTitulo, splitMode === 'equal' && { color: 'white' }]}>Individual</Text>
            <Text style={[styles.metodoSubtitulo, splitMode === 'equal' && { color: 'rgba(255,255,255,0.7)' }]}>Cada persona paga igual</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metodoPill, splitMode === 'subgroups' && styles.metodoPillActivo, (!juntada.subgrupos || juntada.subgrupos.length === 0) && { opacity: 0.5 }]}
            onPress={() => juntada.subgrupos?.length > 0 && setSplitMode('subgroups')}
            disabled={!juntada.subgrupos || juntada.subgrupos.length === 0}
          >
            <View style={[styles.metodoPillIconBox, splitMode === 'subgroups' && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="people" size={18} color={splitMode === 'subgroups' ? 'white' : colors.primary} />
            </View>
            <Text style={[styles.metodoTitulo, splitMode === 'subgroups' && { color: 'white' }]}>Por subgrupos</Text>
            <Text style={[styles.metodoSubtitulo, splitMode === 'subgroups' && { color: 'rgba(255,255,255,0.7)' }]}>
              {juntada.subgrupos?.length === 0 ? 'Creá subgrupos primero' : 'Igual entre núcleos'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mostrar subgrupos o participantes */}
        {splitMode === 'subgroups' && juntada.subgrupos?.length > 0 ? (
          <>
            <Text style={styles.label}>SUBGRUPOS · {juntada.subgrupos.length}</Text>
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
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setSeleccionados(participantes.map(p => p.nombre))}
                  style={styles.btnSelAll}
                >
                  <Text style={styles.btnSelAllTxt}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSeleccionados([])}
                  style={styles.btnSelAll}
                >
                  <Text style={styles.btnSelAllTxt}>Ninguno</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.participantesListDivision}>
              {participantes.map(p => {
                const activo = seleccionados.includes(p.nombre);
                return (
                  <TouchableOpacity
                    key={p.id || p.nombre}
                    style={[styles.participanteDivisionCard, activo && styles.participanteDivisionCardActivo]}
                    onPress={() => toggleParticipante(p.nombre)}
                    disabled={guardando}
                  >
                    <View style={[styles.participanteDivisionAvatar, { backgroundColor: p.color }]}>
                      <Text style={styles.participanteDivisionAvatarTexto}>{p.iniciales}</Text>
                    </View>
                    <Text style={[styles.participanteDivisionNombre, activo && { fontWeight: 'bold', color: 'white' }]}>
                      {p.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {montoNum > 0 && seleccionados.length > 0 && (
              <Text style={styles.calcularDiv}>
                Cada uno paga <Text style={{ fontWeight: 'bold', color: colors.primary }}>
                  ${Math.round(montoNum / seleccionados.length).toLocaleString('es-AR')}
                </Text>
              </Text>
            )}
          </>
        ) : null}

        {/* Fecha */}
        <Text style={styles.label}>FECHA</Text>
        <TouchableOpacity style={styles.fechaCard} onPress={() => setMostrarFecha(true)}>
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.fechaTexto}>
            {fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </TouchableOpacity>
        {mostrarFecha && (
          <DateTimePicker
            value={fecha}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            onChange={(event, selectedDate) => {
              if (event.type === 'dismissed' || event.type === 'set') {
                setMostrarFecha(false);
              }
              if (selectedDate) setFecha(selectedDate);
            }}
            maximumDate={new Date()}
          />
        )}

        {/* Botón guardar */}
        <TouchableOpacity
          style={[styles.btnGuardarGasto, !puedeGuardar && { opacity: 0.5 }]}
          onPress={handleGuardar}
          disabled={!puedeGuardar || guardando}
        >
          {guardando ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnGuardarGastoTexto}>Guardar gasto</Text>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  montoSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBg,
  },
  montoLabel: {
    fontSize: 28,
    color: colors.textSecondary,
    fontWeight: '400',
    marginRight: 4,
  },
  montoInput: {
    fontSize: 40,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    padding: 0,
    letterSpacing: -1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingLeft: 4,
  },
  fieldBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBg,
    paddingHorizontal: 14,
    height: 52,
    justifyContent: 'center',
    marginBottom: 12,
  },
  fieldInput: {
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  pagadorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBg,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
  },
  pagadorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  cambiarButton: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  pagadoresDropdown: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBg,
    marginBottom: 16,
    overflow: 'hidden',
  },
  pagadorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBg,
  },
  pagadorOptionTexto: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  metodosContainer: {
    gap: 10,
    marginBottom: 20,
  },
  metodoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.cardBg,
  },
  metodoPillActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  metodoPillIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary + '1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metodoTitulo: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metodoSubtitulo: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subgruposListDivision: {
    gap: 8,
    marginBottom: 20,
  },
  subgrupoDivisionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary + '33',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subgrupoDivisionNombre: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subgrupoDivisionIntegrantes: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  participantesListDivision: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBg,
    padding: 12,
  },
  participanteDivisionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.cardBg,
  },
  participanteDivisionCardActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  participanteDivisionAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participanteDivisionAvatarTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  participanteDivisionNombre: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  dividirEntreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  btnSelAll: {
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  btnSelAllTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  calcularDiv: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingLeft: 4,
    marginBottom: 20,
  },
  fechaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBg,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 20,
  },
  fechaTexto: {
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  btnGuardarGasto: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  btnGuardarGastoTexto: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  btnOCR: {
    padding: 8,
    marginLeft: 8,
  },
  btnEscanearTicket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: 'rgba(104, 70, 220, 0.05)',
  },
  btnEscanearTicketActivo: {
    backgroundColor: 'rgba(104, 70, 220, 0.1)',
  },
  btnEscanearTicketText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
