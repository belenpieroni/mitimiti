import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { unirseViaToken } from '../services/juntadasService';
import { useAuth } from '../context/AuthContext';

export default function JoinViaLinkScreen({ route, navigation }) {
  const { token } = route.params || {};
  const { isAuthenticated } = useAuth();
  const [estado, setEstado] = useState('pendiente'); 
  const [juntadaNombre, setJuntadaNombre] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [linkInput, setLinkInput] = useState(token || '');

  function extraerTokenDesdeInput(raw = '') {
    const txt = String(raw || '').trim();
    if (!txt) return '';

    if (!txt.includes('/')) return txt;

    const match = txt.match(/\/join\/([^/?#]+)/i);
    if (match?.[1]) return match[1];

    const clean = txt.replace(/[?#].*$/, '').replace(/\/+$/, '');
    const parts = clean.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setEstado('error');
      setErrorMsg('Debés iniciar sesión para unirte a una juntada.');
    }
  }, [isAuthenticated]);

  async function handleUnirse() {
    const tokenFinal = extraerTokenDesdeInput(linkInput);
    if (!tokenFinal) {
      Alert.alert('Error', 'Token de invitación inválido.');
      return;
    }
    setEstado('cargando');
    try {
      const result = await unirseViaToken(tokenFinal);
      setJuntadaNombre(result.juntada?.nombre || '');
      setEstado('ok');
      setTimeout(() => {
        navigation.replace('JuntadaDetalle', { juntadaId: result.juntada.id });
      }, 1500);
    } catch (e) {
      setEstado('error');
      setErrorMsg(e.message || 'No se pudo procesar la invitación.');
    }
  }

  if (estado === 'cargando') {
    return (
      <View style={[styles.container, styles.centrado]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.cargandoTexto}>Uniéndote a la juntada…</Text>
      </View>
    );
  }

  if (estado === 'ok') {
    return (
      <View style={[styles.container, styles.centrado]}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={40} color="white" />
        </View>
        <Text style={styles.okTitulo}>¡Te uniste!</Text>
        <Text style={styles.okSub}>Ahora sos parte de "{juntadaNombre}"</Text>
      </View>
    );
  }

  if (estado === 'error') {
    return (
      <View style={[styles.container, styles.centrado]}>
        <Ionicons name="alert-circle-outline" size={56} color={colors.redGlobal} />
        <Text style={styles.errorTitulo}>No se pudo procesar</Text>
        <Text style={styles.errorSub}>{errorMsg}</Text>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
          <Text style={styles.btnVolverTxt}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.centrado]}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="people" size={36} color="white" />
        </View>
        <Text style={styles.cardTitulo}>Invitación a juntada</Text>
        <Text style={styles.cardSub}>Pegá el enlace de invitación o el token para unirte.</Text>

        <TextInput
          style={styles.inputLink}
          placeholder="mitimiti://join/... o token"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          value={linkInput}
          onChangeText={setLinkInput}
        />

        <TouchableOpacity style={styles.btnAceptar} onPress={handleUnirse}>
          <Text style={styles.btnAceptarTxt}>Unirme</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnRechazar} onPress={() => navigation.goBack()}>
          <Text style={styles.btnRechazarTxt}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centrado: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  cargandoTexto: { marginTop: 16, fontSize: 15, color: colors.textSecondary },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  okTitulo: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  okSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  errorTitulo: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 12, marginBottom: 8 },
  errorSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  btnVolver: {
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.cardBg,
  },
  btnVolverTxt: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  card: {
    backgroundColor: 'white', borderRadius: 24, padding: 28, alignItems: 'center',
    width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  cardTitulo: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  cardSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  inputLink: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D8E0E7',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  btnAceptar: {
    width: '100%', backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  btnAceptarTxt: { color: 'white', fontSize: 16, fontWeight: '700' },
  btnRechazar: {
    width: '100%', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', backgroundColor: colors.background,
  },
  btnRechazarTxt: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
});
