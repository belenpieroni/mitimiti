import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { obtenerJuntada, agregarSubgrupo, eliminarSubgrupo } from '../services/juntadasService';

export default function GestionarSubgruposScreen({ route, navigation }) {
  const { juntadaId } = route.params;
  
  const [juntada, setJuntada] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [seleccionados, setSeleccionados] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useFocusEffect(() => {
    cargarJuntada();
  });

  async function cargarJuntada() {
    try {
      const data = await obtenerJuntada(juntadaId);
      setJuntada(data);
      setParticipantes(data.participantes || []);
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar la juntada');
    }
  }

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
      await agregarSubgrupo(juntadaId, { 
        nombre: nombre.trim(), 
        integrantes: seleccionados 
      });
      setNombre('');
      setSeleccionados([]);
      setCreando(false);
      await cargarJuntada();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGuardando(false);
    }
  }

  function handleEliminar(subgrupoId) {
    Alert.alert(
      'Eliminar subgrupo',
      '¿Estás seguro de que querés eliminar este subgrupo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarSubgrupo(juntadaId, subgrupoId);
              await cargarJuntada();
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  }

  if (!juntada) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flex: 1 }}>
            <Ionicons name="people" size={20} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Subgrupos · {juntada.subgrupos?.length || 0}</Text>
          <TouchableOpacity style={{ flex: 1, alignItems: 'flex-end' }} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.descripcion}>
          Agrupá familias o parejas para dividir los gastos por núcleo, no por persona.
        </Text>

        {/* Mostrar subgrupos existentes */}
        {juntada.subgrupos && juntada.subgrupos.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={{ gap: 8 }}>
              {juntada.subgrupos.map(sg => (
                <View key={sg.id} style={styles.subgrupoCardWeb}>
                  <View style={styles.subgrupoContent}>
                    <View style={[styles.subgrupoAvatar, { backgroundColor: colors.primary }]}>
                      <Ionicons name="people" size={16} color="white" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subgrupoNombreWeb}>{sg.nombre}</Text>
                      <Text style={styles.subgrupoIntegrantesWeb}>
                        {sg.integrantes.join(' · ')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.subgrupoAcciones}>
                    <TouchableOpacity 
                      style={styles.btnAccion}
                      onPress={() => handleEliminar(sg.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.primary + '66'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Estado vacío */}
        {(!juntada.subgrupos || juntada.subgrupos.length === 0) && !creando && (
          <View style={styles.vaioSubgrupo}>
            <Ionicons name="people-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.vacioTextoSubgrupo}>Aún no creaste subgrupos</Text>
            <Text style={styles.vacioSubTexto}>
              Útil para parejas, familias o cualquier núcleo que pague junto.
            </Text>
          </View>
        )}

        {/* Formulario de creación */}
        {creando && (
          <View style={{ marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.cardBg }}>
            <Text style={[styles.label, { marginBottom: 12 }]}>NOMBRE DEL SUBGRUPO</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Ej. Familia López"
              placeholderTextColor={colors.accent} 
              value={nombre} 
              onChangeText={setNombre}
              editable={!guardando}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>INTEGRANTES (Mínimo 2)</Text>
            <View style={{ marginTop: 8 }}>
              {participantes.length === 0 ? (
                <Text style={styles.sinParticipantes}>Sin participantes disponibles</Text>
              ) : (
                <View style={styles.participantesGrid}>
                  {participantes.map((p) => {
                    const activo = seleccionados.includes(p.nombre);
                    return (
                      <TouchableOpacity
                        key={p.id || p.nombre}
                        style={[styles.participanteChip, activo && styles.participanteChipActivo]}
                        onPress={() => toggleParticipante(p.nombre)}
                        disabled={guardando}
                      >
                        <View style={[styles.participanteAvatar, { backgroundColor: p.color }]}>
                          <Text style={styles.participanteAvatarTexto}>{p.iniciales}</Text>
                        </View>
                        <Text style={[styles.participanteNombre, activo && { fontWeight: 'bold', color: 'white' }]}>
                          {p.nombre}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Botones de formulario */}
            <View style={[styles.botones, { marginTop: 20 }]}>
              <TouchableOpacity 
                style={styles.btnCancelar} 
                onPress={() => {
                  setCreando(false);
                  setNombre('');
                  setSeleccionados([]);
                }}
                disabled={guardando}
              >
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnGuardar, (guardando || seleccionados.length < 2 || !nombre.trim()) && { opacity: 0.6 }]}
                onPress={handleGuardar} 
                disabled={guardando || seleccionados.length < 2 || !nombre.trim()}
              >
                {guardando ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.btnGuardarTexto}>Crear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Botón para crear nuevo */}
        {!creando && (
          <TouchableOpacity
            style={styles.btnPrimarioSubgrupo}
            onPress={() => setCreando(true)}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.btnPrimarioSubgrupoTexto}>Nuevo subgrupo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.screenBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  descripcion: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 18,
  },
  subgrupoCardWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBg,
  },
  subgrupoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  subgrupoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subgrupoNombreWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subgrupoIntegrantesWeb: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  subgrupoAcciones: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAccion: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vaioSubgrupo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  vacioTextoSubgrupo: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
  },
  vacioSubTexto: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingLeft: 4,
  },
  input: {
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBg,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
  },
  sinParticipantes: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  participantesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participanteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.cardBg,
  },
  participanteChipActivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  participanteAvatar: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participanteAvatarTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  participanteNombre: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  botones: {
    flexDirection: 'row',
    gap: 12,
  },
  btnCancelar: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.cardBg,
    alignItems: 'center',
  },
  btnCancelarTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  btnGuardar: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnGuardarTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  btnPrimarioSubgrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  btnPrimarioSubgrupoTexto: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});
