import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { getIniciales, coloresDisponibles } from './JuntadasScreen';
import { crearJuntada as crearJuntadaService, editarJuntada as editarJuntadaService } from '../services/juntadasService';
import { useAuth } from '../context/AuthContext';

function formatFecha(date) {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CrearJuntadaScreen({ navigation, route }) {
  const { user } = useAuth();
  const nombreUsuarioLogueado = user?.name || user?.nombre || 'Yo';
  
  const usuarioActual = { 
    nombre: nombreUsuarioLogueado, 
    representante: nombreUsuarioLogueado,
    integrantes: 1,
    iniciales: getIniciales(nombreUsuarioLogueado), 
    color: colors.primary 
  };

  const editando = route.params?.juntadaId ? route.params : null;

  const [nombre, setNombre] = useState(editando?.nombre || '');
  const [descripcion, setDescripcion] = useState(editando?.descripcion || '');
  
  // Tab activa: 'individual' o 'grupos'
  const [tabActiva, setTabActiva] = useState('individual');

  // Inputs Modo Individual
  const [inputPersona, setInputPersona] = useState('');

  // Inputs Modo Grupal
  const [inputSubgrupo, setInputSubgrupo] = useState('');
  const [inputRepresentante, setInputRepresentante] = useState('');
  // Ahora es un entero inicializado en 1
  const [inputIntegrantes, setInputIntegrantes] = useState(1);
  
  // Lista única de participantes
  const [participantes, setParticipantes] = useState(editando?.participantes || [usuarioActual]);

  const [fecha, setFecha] = useState(() => {
    if (editando?.fecha) {
      const parsed = Date.parse(editando.fecha);
      if (!isNaN(parsed)) return new Date(parsed);
    }
    return new Date();
  });
  const [showPicker, setShowPicker] = useState(false);

  const onChangeFecha = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      setFecha(selectedDate);
    }
  };

  // Agregar persona en pestaña Individual
  function agregarPersonaIndividual() {
    const nombreLimpio = inputPersona.trim();
    if (!nombreLimpio) return;

    const yaExiste = participantes.some(p => p.nombre.toLowerCase() === nombreLimpio.toLowerCase());
    if (yaExiste) {
      Alert.alert('Duplicado', 'Ya existe un participante con ese nombre.');
      return;
    }

    const colorIndex = participantes.length % coloresDisponibles.length;
    const nuevaPersona = {
      nombre: nombreLimpio,
      representante: nombreLimpio,
      integrantes: 1,
      iniciales: getIniciales(nombreLimpio),
      color: coloresDisponibles[colorIndex],
    };

    setParticipantes([...participantes, nuevaPersona]);
    setInputPersona('');
  }

  // Agregar subgrupo en pestaña Grupos
  function agregarSubgrupo() {
    const repLimpio = inputRepresentante.trim();
    let grupoLimpio = inputSubgrupo.trim();

    if (!repLimpio) {
      Alert.alert('Faltan datos', 'El nombre del representante es obligatorio.');
      return;
    }

    if (!grupoLimpio) {
      grupoLimpio = `Familia ${repLimpio}`;
    }

    // Al usar el stepper, ya aseguramos que siempre sea un número válido y mayor a 0
    const cantIntegrantes = inputIntegrantes;

    const yaExiste = participantes.some(p => p.nombre.toLowerCase() === grupoLimpio.toLowerCase());
    if (yaExiste) {
      Alert.alert('Duplicado', 'Ya existe un grupo con ese nombre.');
      return;
    }

    const colorIndex = participantes.length % coloresDisponibles.length;
    const nuevoGrupo = {
      nombre: grupoLimpio,
      representante: repLimpio,
      integrantes: cantIntegrantes,
      iniciales: getIniciales(grupoLimpio),
      color: coloresDisponibles[colorIndex],
    };

    setParticipantes([...participantes, nuevoGrupo]);
    setInputSubgrupo('');
    setInputRepresentante('');
    setInputIntegrantes(1); // Reseteamos a 1
  }

  function quitarParticipante(nombreAQuitar) {
    if (nombreAQuitar === usuarioActual.nombre) return;
    setParticipantes(participantes.filter(p => p.nombre !== nombreAQuitar));
  }

  async function crearJuntada() {
    if (!nombre.trim()) return;
    try {
      if (editando) {
        await editarJuntadaService(editando.juntadaId, { 
          nombre: nombre.trim(), 
          descripcion: descripcion.trim(),
          fecha: formatFecha(fecha),
          participantes: personas,
        });
      } else {
        const nueva = {
          id: Date.now().toString(),
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          fecha: formatFecha(fecha),
          participantes: participantes,
          gastos: [],
          deuda: 0,
          tipo: 'ninguna',
        };
        await crearJuntadaService(nueva);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la juntada.');
    }
  }

  const puedeCrear = nombre.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.titulo}>{editando ? 'Editar juntada' : 'Nueva juntada'}</Text>
            <Text style={styles.subtitulo}>{editando ? 'Modificar nombre y descripción' : 'Organizá los integrantes de tu juntada'}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Campos Base */}
          <Text style={styles.label}>NOMBRE DE LA JUNTADA</Text>
          <TextInput
            style={styles.input}
            placeholder="Asado del sábado / Cumpleaños"
            placeholderTextColor={colors.accent}
            value={nombre}
            onChangeText={setNombre}
          />

          <Text style={styles.label}>DESCRIPCIÓN</Text>
          <TextInput
            style={styles.input}
            placeholder="Opcional"
            placeholderTextColor={colors.accent}
            value={descripcion}
            onChangeText={setDescripcion}
          />

          <Text style={styles.label}>FECHA</Text>
          <TouchableOpacity style={styles.inputFecha} onPress={() => setShowPicker(true)}>
            <Text style={styles.inputFechaTexto}>{formatFecha(fecha)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {showPicker && (
            <DateTimePicker
              value={fecha}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={onChangeFecha}
            />
          )}

          {/* TABS DE CARGA DE INTEGRANTES */}
          <Text style={styles.label}>CÓMO QUERÉS CARGAR LOS INVITADOS</Text>
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, tabActiva === 'individual' && styles.tabActiva]} 
              onPress={() => setTabActiva('individual')}
            >
              <Ionicons name="person-outline" size={16} color={tabActiva === 'individual' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabTexto, tabActiva === 'individual' && styles.tabTextoActivo]}>Individuales</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, tabActiva === 'grupos' && styles.tabActiva]} 
              onPress={() => setTabActiva('grupos')}
            >
              <Ionicons name="people-outline" size={16} color={tabActiva === 'grupos' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabTexto, tabActiva === 'grupos' && styles.tabTextoActivo]}>Subgrupos / Familias</Text>
            </TouchableOpacity>
          </View>

          {/* FORMULARIO DINÁMICO SEGÚN TAB */}
          {tabActiva === 'individual' ? (
            <View style={styles.inputPersonaFila}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Nombre del participante"
                placeholderTextColor={colors.accent}
                value={inputPersona}
                onChangeText={setInputPersona}
                onSubmitEditing={agregarPersonaIndividual}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.btnAgregar} onPress={agregarPersonaIndividual}>
                <Ionicons name="add" size={22} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formGrupoCard}>
              <TextInput
                style={styles.inputForm}
                placeholder="Nombre del grupo (ej: Familia López)"
                placeholderTextColor={colors.accent}
                value={inputSubgrupo}
                onChangeText={setInputSubgrupo}
              />
              <View style={styles.filaInputsCortos}>
                <TextInput
                  style={[styles.inputForm, { flex: 2 }]}
                  placeholder="Representante (ej: Carlos)"
                  placeholderTextColor={colors.accent}
                  value={inputRepresentante}
                  onChangeText={setInputRepresentante}
                />

                {/* CONTADOR / STEPPER NUEVO */}
                <View style={styles.stepperContainer}>
                  <TouchableOpacity 
                    style={[styles.btnStepper, inputIntegrantes <= 1 && styles.btnStepperDeshabilitado]} 
                    onPress={() => inputIntegrantes > 1 && setInputIntegrantes(prev => prev - 1)}
                    disabled={inputIntegrantes <= 1}
                  >
                    <Ionicons name="remove" size={16} color={inputIntegrantes <= 1 ? colors.accent : colors.textPrimary} />
                  </TouchableOpacity>
                  
                  <Text style={styles.stepperTexto}>{inputIntegrantes}</Text>
                  
                  <TouchableOpacity 
                    style={styles.btnStepper} 
                    onPress={() => setInputIntegrantes(prev => prev + 1)}
                  >
                    <Ionicons name="add" size={16} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btnAgregarGrupo} onPress={agregarSubgrupo}>
                  <Ionicons name="add" size={22} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* LISTADO UNIFICADO DE INVITADOS */}
          <Text style={styles.label}>LISTA DE INVITADOS · {participantes.length}</Text>
          <View style={styles.listaGruposContainer}>
            {participantes.map((p, i) => (
              <View key={i} style={styles.grupoCard}>
                <View style={[styles.grupoAvatar, { backgroundColor: p.color }]}>
                  <Text style={styles.grupoAvatarTexto}>{p.iniciales}</Text>
                </View>
                <View style={styles.grupoCardInfo}>
                  <Text style={styles.grupoCardTitulo}>{p.nombre}</Text>
                  <Text style={styles.grupoCardSub}>
                    {p.integrantes === 1 
                      ? 'Va solo/a' 
                      : `Paga: ${p.representante} · ${p.integrantes} personas`
                    }
                  </Text>
                </View>
                {p.nombre !== usuarioActual.nombre && (
                  <TouchableOpacity style={styles.btnBorrarGrupo} onPress={() => quitarParticipante(p.nombre)}>
                    <Ionicons name="trash-outline" size={18} color={colors.redGlobal} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

        </ScrollView>

        {/* Footer fijo */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btnCrear, !puedeCrear && styles.btnCrearDeshabilitado]}
            onPress={crearJuntada}
            disabled={!puedeCrear}
          >
            <Text style={styles.btnCrearTexto}>{editando ? 'Guardar cambios' : 'Crear juntada'}</Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, gap: 12,
  },
  btnVolver: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  titulo: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  subtitulo: { fontSize: 12, color: colors.textSecondary },
  content: { padding: 16, paddingBottom: 110 },
  label: {
    fontSize: 11, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 0.5, marginBottom: 8, marginTop: 20,
  },
  input: {
    backgroundColor: colors.cardBg, borderRadius: 12,
    padding: 14, fontSize: 15, color: colors.textPrimary, marginBottom: 4,
  },
  inputFecha: {
    backgroundColor: colors.cardBg, borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  inputFechaTexto: { fontSize: 15, color: colors.textPrimary },
  
  // Contenedor de Tabs
  tabsContainer: {
    flexDirection: 'row', backgroundColor: 'rgba(157, 178, 191, 0.15)',
    borderRadius: 12, padding: 4, marginBottom: 16, gap: 4
  },
  tab: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  tabActiva: { backgroundColor: 'white', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  tabTexto: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextoActivo: { color: colors.primary },

  // Form Individual
  inputPersonaFila: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  btnAgregar: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },

  // Form Grupal
  formGrupoCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(82, 109, 130, 0.15)', gap: 8,
  },
  inputForm: {
    backgroundColor: colors.background, borderRadius: 10,
    padding: 12, fontSize: 14, color: colors.textPrimary,
  },
  filaInputsCortos: { flexDirection: 'row', gap: 8 },
  btnAgregarGrupo: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },

  // UI del Componente Stepper / Contador Táctil
  stepperContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background,
    borderRadius: 10, padding: 4, flex: 1.5, justifyContent: 'space-between'
  },
  btnStepper: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center', elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1,
  },
  btnStepperDeshabilitado: {
    backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0,
  },
  stepperTexto: {
    fontSize: 15, fontWeight: 'bold', color: colors.textPrimary, minWidth: 22, textAlign: 'center'
  },

  // Listado unificado
  listaGruposContainer: { gap: 8, marginTop: 4 },
  grupoCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg,
    borderRadius: 14, padding: 12, gap: 12,
  },
  grupoAvatar: {
    width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  grupoAvatarTexto: { color: 'white', fontSize: 12, fontWeight: '700' },
  grupoCardInfo: { flex: 1 },
  grupoCardTitulo: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  grupoCardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  btnBorrarGrupo: { padding: 4 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: colors.background,
  },
  btnCrear: {
    backgroundColor: colors.primary, borderRadius: 16,
    padding: 18, alignItems: 'center',
  },
  btnCrearDeshabilitado: { backgroundColor: colors.accent },
  btnCrearTexto: { color: 'white', fontSize: 16, fontWeight: '700' },
});