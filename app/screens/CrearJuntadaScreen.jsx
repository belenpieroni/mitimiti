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
import { useAuth } from '../navigation/AppNavigator';

function formatFecha(date) {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CrearJuntadaScreen({ navigation, route }) {
  const { user } = useAuth();
  const nombreUsuarioLogueado = user?.name || user?.nombre || 'Yo';
  const usuarioActual = { 
    nombre: nombreUsuarioLogueado, 
    iniciales: getIniciales(nombreUsuarioLogueado), 
    color: colors.primary 
  };

  const editando = route.params?.juntadaId ? route.params : null;

  const [nombre, setNombre] = useState(editando?.nombre || '');
  const [descripcion, setDescripcion] = useState(editando?.descripcion || '');
  const [inputPersona, setInputPersona] = useState('');
  const [personas, setPersonas] = useState(editando?.participantes || [usuarioActual]);

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

  function agregarPersona() {
    const nombreLimpio = inputPersona.trim();
    if (!nombreLimpio) return;
    const yaExiste = personas.some(p => p.nombre.toLowerCase() === nombreLimpio.toLowerCase());
    if (yaExiste) return;
    const colorIndex = personas.length % coloresDisponibles.length;
    const nueva = {
      nombre: nombreLimpio,
      iniciales: getIniciales(nombreLimpio),
      color: coloresDisponibles[colorIndex],
    };
    setPersonas([...personas, nueva]);
    setInputPersona('');
  }

  function quitarPersona(nombreAQuitar) {
    if (nombreAQuitar === usuarioActual.nombre) return;
    setPersonas(personas.filter(p => p.nombre !== nombreAQuitar));
  }

  async function crearJuntada() {
    if (!nombre.trim()) return;
    try {
      if (editando) {
        await editarJuntadaService(editando.juntadaId, { 
          nombre: nombre.trim(), 
          descripcion: descripcion.trim(),
          fecha: formatFecha(fecha)
        });
      } else {
        const nueva = {
          id: Date.now().toString(),
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          fecha: formatFecha(fecha),
          participantes: personas,
          gastos: [],
          deuda: 0,
          tipo: 'ninguna',
        };
        await crearJuntadaService(nueva);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la juntada. Revisá la conexión.');
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
            <Text style={styles.subtitulo}>{editando ? 'Modificar nombre y descripción' : 'Creá un evento para dividir gastos'}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Nombre */}
          <Text style={styles.label}>NOMBRE</Text>
          <TextInput
            style={styles.input}
            placeholder="Asado del sábado"
            placeholderTextColor={colors.accent}
            value={nombre}
            onChangeText={setNombre}
          />

          {/* Descripción */}
          <Text style={styles.label}>DESCRIPCIÓN</Text>
          <TextInput
            style={styles.input}
            placeholder="Opcional"
            placeholderTextColor={colors.accent}
            value={descripcion}
            onChangeText={setDescripcion}
          />

          {/* Fecha */}
          <Text style={styles.label}>FECHA</Text>
          <TouchableOpacity style={styles.inputFecha} onPress={() => setShowPicker(true)}>
            <Text style={styles.inputFechaTexto}>{formatFecha(fecha)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* DATETIMEPICKER */}
          {showPicker && (
            <DateTimePicker
              value={fecha}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={onChangeFecha}
            />
          )}

          {/* Participantes */}
          <View style={styles.participantesHeader}>
            <Text style={styles.label}>PARTICIPANTES · {personas.length}</Text>
          </View>

          {/* Input agregar persona */}
          <View style={styles.inputPersonaFila}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Nombre del participante"
              placeholderTextColor={colors.accent}
              value={inputPersona}
              onChangeText={setInputPersona}
              onSubmitEditing={agregarPersona}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.btnAgregar} onPress={agregarPersona}>
              <Ionicons name="add" size={22} color="white" />
            </TouchableOpacity>
          </View>

          {/* Chips de personas */}
          <View style={styles.chipsContainer}>
            {personas.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={styles.chip}
                onPress={() => quitarPersona(p.nombre)}
              >
                <View style={[styles.chipAvatar, { backgroundColor: p.color }]}>
                  {p.nombre === usuarioActual.nombre && (
                    <Ionicons name="checkmark" size={10} color="white" style={styles.checkmark} />
                  )}
                  <Text style={styles.chipAvatarTexto}>{p.iniciales}</Text>
                </View>
                <Text style={styles.chipNombre}>{p.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>

        </ScrollView>

        {/* Botón crear */}
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
  content: { padding: 16, paddingBottom: 100 },
  label: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
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
  participantesHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 16, marginBottom: 8,
  },
  inputPersonaFila: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  btnAgregar: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.cardBg, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  chipAvatar: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  chipAvatarTexto: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  checkmark: { position: 'absolute', top: -2, right: -2 },
  chipNombre: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
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