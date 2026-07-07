import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { unirseViviendaViaToken } from '../services/viviendaService';

export default function ViviendaJoinViaLinkScreen({ route, navigation }) {
  const { token } = route.params || {};
  const [tokenInput, setTokenInput] = useState(token || '');
  const [estado, setEstado] = useState('pendiente');
  const [nombreVivienda, setNombreVivienda] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleUnirse() {
    const raw = (tokenInput || '').trim();
    const extracted = raw.includes('mitimiti://') ? raw.split('/').pop() : raw;
    if (!extracted) {
      setEstado('error');
      setErrorMsg('Token de invitación inválido.');
      return;
    }

    setEstado('cargando');
    try {
      const vivienda = await unirseViviendaViaToken(extracted);
      setNombreVivienda(vivienda?.nombre || 'tu vivienda');
      setEstado('ok');
      setTimeout(() => {
        navigation.replace('AppTabs', { screen: 'Vivienda', params: { screen: 'ViviendaDashboard' } });
      }, 1200);
    } catch (e) {
      setEstado('error');
      setErrorMsg(e.message || 'No se pudo procesar la invitación.');
    }
  }

  if (estado === 'cargando') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.sub}>Uniéndote a la vivienda…</Text>
      </View>
    );
  }

  if (estado === 'ok') {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.circle}><Ionicons name="checkmark" size={36} color="white" /></View>
        <Text style={styles.title}>¡Listo!</Text>
        <Text style={styles.sub}>Ahora formás parte de "{nombreVivienda}"</Text>
      </View>
    );
  }

  if (estado === 'error') {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle-outline" size={56} color={colors.redGlobal} />
        <Text style={styles.title}>No se pudo unir</Text>
        <Text style={styles.sub}>{errorMsg}</Text>
        <TouchableOpacity style={styles.btnGhost} onPress={() => navigation.goBack()}>
          <Text style={styles.btnGhostTxt}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.center]}>
      <View style={styles.card}>
        <View style={styles.circle}><Ionicons name="home-outline" size={34} color="white" /></View>
        <Text style={styles.title}>Invitación a vivienda</Text>
        <Text style={styles.sub}>Te invitaron a una vivienda compartida. Confirmá para unirte.</Text>
        <TextInput
          style={styles.input}
          placeholder="Pegá acá el enlace o token"
          value={tokenInput}
          onChangeText={setTokenInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.btnPrimary} onPress={handleUnirse}>
          <Text style={styles.btnPrimaryTxt}>Unirme</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: 'white', borderRadius: 22, padding: 24, alignItems: 'center' },
  circle: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  sub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  input: {
    width: '100%', marginTop: 16, borderWidth: 1, borderColor: colors.cardBg,
    borderRadius: 12, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.textPrimary,
  },
  btnPrimary: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22 },
  btnPrimaryTxt: { color: 'white', fontWeight: '700', fontSize: 15 },
  btnGhost: { marginTop: 16, backgroundColor: colors.cardBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18 },
  btnGhostTxt: { color: colors.textPrimary, fontWeight: '600' },
});
