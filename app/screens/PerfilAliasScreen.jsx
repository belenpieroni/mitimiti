import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { obtenerPerfil, actualizarPerfil, eliminarPerfil } from '../services/perfilService';
import { useAuth } from '../navigation/AppNavigator';

const Toast = ({ visible, message, type }) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 50,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  const bgColor = type === 'error' ? colors.redGlobal : colors.greenGlobal;
  const icon = type === 'error' ? 'alert-circle' : 'checkmark-circle';

  return (
    <Animated.View style={[styles.toastContainer, { transform: [{ translateY }], backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={20} color="white" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default function PerfilAliasScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const nombreUsuario = user?.name || 'Usuario';

  const [alias, setAlias] = useState('');
  const [aliasGuardado, setAliasGuardado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const mostrarToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  const cargarPerfil = useCallback(async () => {
    setCargando(true);
    try {
      const perfil = await obtenerPerfil(nombreUsuario);
      if (perfil && perfil.alias) {
        setAlias(perfil.alias);
        setAliasGuardado(true);
      } else {
        setAlias('');
        setAliasGuardado(false);
      }
    } catch (error) {
      mostrarToast(error.message, 'error');
    } finally {
      setCargando(false);
    }
  }, [nombreUsuario]);

  useFocusEffect(
    useCallback(() => { cargarPerfil(); }, [cargarPerfil])
  );

  const handleGuardar = async () => {
    if (!alias || alias.trim() === '') {
      mostrarToast('No podes guardar un Alias/CBU vacio.', 'error');
      return;
    }

    const aliasLimpio = alias.trim().toLowerCase();
    const aliasRegex = /^[a-z0-9.-]{6,22}$/;

    if (!aliasRegex.test(aliasLimpio)) {
      mostrarToast('Debe tener entre 6 y 22 caracteres y usar letras, numeros, guiones y puntos.', 'error');
      return;
    }

    setGuardando(true);
    try {
      await actualizarPerfil(nombreUsuario, aliasLimpio);
      setAlias(aliasLimpio);
      setAliasGuardado(true);
      mostrarToast('Tu Alias/CBU se guardo correctamente.', 'success');
    } catch (error) {
      mostrarToast(error.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    setEliminando(true);
    try {
      await eliminarPerfil(nombreUsuario);
      setAlias('');
      setAliasGuardado(false);
      mostrarToast('Alias/CBU eliminado correctamente.', 'success');
    } catch (error) {
      mostrarToast(error.message, 'error');
    } finally {
      setEliminando(false);
    }
  };

  if (cargando) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.titulo}>Alias y CBU</Text>
            <Text style={styles.subtitulo}>{nombreUsuario}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="card-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Configurar CBU/Alias</Text>
          </View>

          <Text style={styles.descripcion}>
            Ingresa tu Alias o CBU para que los demas participantes sepan donde transferirte cuando te deban dinero.
          </Text>

          <Text style={styles.label}>ALIAS O CBU</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: mi.alias.mp"
            placeholderTextColor={colors.accent || '#9DB2BF'}
            value={alias}
            onChangeText={(text) => setAlias(text.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.infoText}>Entre 6 y 22 caracteres. Letras, numeros, guiones o puntos.</Text>
          </View>

          <TouchableOpacity
            style={[styles.btnGuardar, guardando && styles.btnDisabled]}
            onPress={handleGuardar}
            disabled={guardando || eliminando}
          >
            {guardando ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnGuardarTexto}>Guardar cambios</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnEliminar, (!aliasGuardado || eliminando || guardando) && styles.btnDisabled]}
            onPress={handleEliminar}
            disabled={!aliasGuardado || eliminando || guardando}
          >
            {eliminando ? (
              <ActivityIndicator color={colors.textSecondary} />
            ) : (
              <Text style={[styles.btnEliminarTexto, !aliasGuardado && styles.btnEliminarTextoDisabled]}>
                Eliminar Alias/CBU
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
  },
  toastText: { color: 'white', fontWeight: 'bold', fontSize: 14, flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 20,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btnVolver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 2 },
  subtitulo: { fontSize: 16, color: colors.textSecondary, fontWeight: '500' },
  content: { padding: 20 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  descripcion: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 24 },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 24,
    marginLeft: 4,
    paddingRight: 10,
  },
  infoText: { fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  btnGuardar: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  btnGuardarTexto: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  btnEliminar: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  btnEliminarTexto: { color: colors.redGlobal, fontSize: 15, fontWeight: 'bold' },
  btnEliminarTextoDisabled: { color: colors.textSecondary },
  btnDisabled: { opacity: 0.6, shadowOpacity: 0 },
});