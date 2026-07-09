import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { crearJuntada as crearJuntadaService, editarJuntada as editarJuntadaService, generarInvitacion } from '../services/juntadasService';
import { useAuth } from '../context/AuthContext';

function formatFecha(date) {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CrearJuntadaScreen({ navigation, route }) {
  const { user } = useAuth();
  const editando = route.params?.juntadaId ? route.params : null;

  const [nombre, setNombre] = useState(editando?.nombre || '');
  const [descripcion, setDescripcion] = useState(editando?.descripcion || '');
  const [fecha, setFecha] = useState(() => {
    if (editando?.fecha) {
      const parsed = Date.parse(editando.fecha);
      if (!isNaN(parsed)) return new Date(parsed);
    }
    return new Date();
  });
  const [showPicker, setShowPicker] = useState(false);

  const onChangeFecha = (event, selectedDate) => {
    const tipo = event?.type;

    if (tipo === 'dismissed') {
      setShowPicker(false);
      return;
    }

    if (tipo === 'set' && selectedDate) {
      setFecha(selectedDate);
      setShowPicker(false);
      return;
    }

    // En iOS algunos builds pueden no informar event.type
    if (!tipo && selectedDate) {
      setFecha(selectedDate);
      setShowPicker(false);
      return;
    }

    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
  };

  async function compartirEnlace(juntadaId, juntadaNombre) {
    try {
      const invitacion = await generarInvitacion(juntadaId);
      const mensaje = `¡Te invito a unirte a "${juntadaNombre}" en MitiMiti!\n\nHacé clic acá para sumarte: ${invitacion.deepLink}`;
      await Share.share({ message: mensaje, title: 'Invitación a juntada' });
    } catch (e) {
      // share cancelado o error silencioso
    }
  }

  async function handleGuardar() {
    if (!nombre.trim()) return;
    try {
      if (editando) {
        await editarJuntadaService(editando.juntadaId, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          fecha: formatFecha(fecha),
        });
        navigation.goBack();
      } else {
        const nuevaJuntada = await crearJuntadaService({
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
        });
        // Ir al detalle y ofrecer compartir enlace
        navigation.replace('JuntadaDetalle', { juntadaId: nuevaJuntada.id });
        setTimeout(() => compartirEnlace(nuevaJuntada.id, nuevaJuntada.nombre), 600);
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar la juntada.');
    }
  }

  const puedeGuardar = nombre.trim().length > 0;

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
            <Text style={styles.subtitulo}>
              {editando ? 'Modificá nombre y descripción' : 'Después podés invitar personas con un enlace'}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

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
              onChange={onChangeFecha}
            />
          )}

          {/* Info card sobre el sistema de invitaciones */}
          {!editando && (
            <View style={styles.infoCard}>
              <Ionicons name="link-outline" size={20} color={colors.primary} />
              <Text style={styles.infoTexto}>
                Una vez creada la juntada se genera un enlace de invitación para compartir con quien quieras sumar al grupo.
              </Text>
            </View>
          )}

          {/* Participante inicial (el creador) */}
          {!editando && user && (
            <View>
              <Text style={styles.label}>PARTICIPANTES INICIALES</Text>
              <View style={styles.participanteCard}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarTexto}>
                    {(user.iniciales || (user.name || '').slice(0, 2)).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.participanteNombre}>{user.name || user.nombre}</Text>
                  <Text style={styles.participanteSub}>Vos · creador/a</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              </View>
              <Text style={styles.helperTexto}>
                Los demás integrantes se unen mediante el enlace de invitación.
              </Text>
            </View>
          )}

        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btnCrear, !puedeGuardar && styles.btnCrearDeshabilitado]}
            onPress={handleGuardar}
            disabled={!puedeGuardar}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  inputFechaTexto: { fontSize: 15, color: colors.textPrimary },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(71,52,114,0.08)', borderRadius: 12, padding: 14, marginTop: 24,
  },
  infoTexto: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  participanteCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg,
    borderRadius: 14, padding: 12, gap: 12,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  avatarTexto: { color: 'white', fontSize: 13, fontWeight: '700' },
  participanteNombre: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  participanteSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  helperTexto: { fontSize: 12, color: colors.textSecondary, marginTop: 8, lineHeight: 17 },
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
