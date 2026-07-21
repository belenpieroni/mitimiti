import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  obtenerPreferenciasNotificaciones,
  actualizarPreferenciasNotificaciones,
} from '../services/notificationPreferencesService';

const DEFAULT_PREFS = {
  nuevosGastos: true,
  recordatoriosVencimiento: true,
  nuevasJuntadas: true,
};

const CATEGORIES = [
  {
    key: 'nuevosGastos',
    title: 'Nuevos gastos',
    subtitle: 'Avisame cuando alguien agregue gastos en mis juntadas.',
    icon: 'cash-outline',
    iconBg: '#E8F8EF',
    iconColor: '#2E7D5C',
  },
  {
    key: 'recordatoriosVencimiento',
    title: 'Recordatorios de vencimiento',
    subtitle: 'Quiero alertas cuando un servicio este por vencer.',
    icon: 'alert-circle-outline',
    iconBg: '#FBEAEA',
    iconColor: '#D64B3B',
  },
  {
    key: 'nuevasJuntadas',
    title: 'Nuevas juntadas',
    subtitle: 'Notificarme cuando me agreguen a una juntada.',
    icon: 'people-outline',
    iconBg: '#EEE9FA',
    iconColor: colors.primary,
  },
];

export default function NotificationSettingsScreen() {
  const navigation = useNavigation();
  const { token } = useAuth();

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargarPreferencias = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await obtenerPreferenciasNotificaciones(token);
      setPrefs({
        ...DEFAULT_PREFS,
        ...(data || {}),
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudieron cargar las preferencias.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargarPreferencias();
    }, [cargarPreferencias])
  );

  const handleToggle = (key, value) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleGuardar = async () => {
    if (!token) {
      Alert.alert('Sesion expirada', 'Inicia sesion nuevamente para guardar preferencias.');
      return;
    }

    setSaving(true);
    try {
      const updated = await actualizarPreferenciasNotificaciones(token, prefs);
      setPrefs({
        ...DEFAULT_PREFS,
        ...(updated || {}),
      });
      Alert.alert('Listo', 'Configuracion de notificaciones guardada.');
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Configuracion de notificaciones</Text>
          <Text style={styles.headerSubtitle}>Personaliza las alertas que queres recibir</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Categorias</Text>
          {CATEGORIES.map((item) => (
            <View key={item.key} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon} size={20} color={item.iconColor} />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
              <Switch
                value={Boolean(prefs[item.key])}
                onValueChange={(value) => handleToggle(item.key, value)}
                thumbColor={Boolean(prefs[item.key]) ? colors.primary : '#F4F3F4'}
                trackColor={{ false: '#D4DCE4', true: '#CFC3EA' }}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleGuardar}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEEF2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 19, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  headerSubtitle: { fontSize: 12.5, color: colors.textSecondary },
  content: { padding: 20, paddingBottom: 32 },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#67809A',
    fontWeight: '700',
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9ECF0',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textWrap: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  saveBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
});
