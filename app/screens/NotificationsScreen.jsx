import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  getNotificationsModule,
  isExpoGoAndroid,
  enviarNotificacionRemotaPrueba,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  obtenerNotificaciones,
  registrarTokenDispositivo,
} from '../services/notificationsService';

function getRelativeTimeLabel(fechaIso) {
  if (!fechaIso) return 'Reciente';
  const deltaMs = Date.now() - new Date(fechaIso).getTime();
  const mins = Math.floor(deltaMs / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  return `Hace ${days} dias`;
}

function getVisualByCategory(category) {
  switch (category) {
    case 'recordatorios_vencimiento':
      return { icon: 'flash-outline', iconBg: '#FBEAEA', iconColor: '#D64B3B' };
    case 'nuevos_gastos':
      return { icon: 'cash-outline', iconBg: '#E8F8EF', iconColor: '#2E7D5C' };
    case 'nuevas_juntadas':
      return { icon: 'people-outline', iconBg: '#EEE9FA', iconColor: colors.primary };
    case 'servicio_variable':
      return { icon: 'alert-circle-outline', iconBg: '#FFF3E0', iconColor: '#E65100' };
    default:
      return { icon: 'notifications-outline', iconBg: '#F2F4F6', iconColor: colors.textSecondary };
  }
}

function mapNotificationFromApi(row) {
  const visual = getVisualByCategory(row.categoria);
  return {
    id: row.id,
    title: row.titulo,
    subtitle: getRelativeTimeLabel(row.creada_en),
    description: row.cuerpo,
    icon: visual.icon,
    iconBg: visual.iconBg,
    iconColor: visual.iconColor,
    unread: !row.leida,
  };
}

export default function NotificationsScreen({ navigation }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const cargarNotificaciones = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      return;
    }

    try {
      setLoadingFeed(true);
      const data = await obtenerNotificaciones(token);
      const mapped = Array.isArray(data) ? data.map(mapNotificationFromApi) : [];
      setNotifications(mapped);
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      setNotifications([]);
    } finally {
      setLoadingFeed(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      cargarNotificaciones();
    }, [cargarNotificaciones])
  );

  const selected = useMemo(
    () => notifications.find((n) => n.id === selectedId) || null,
    [notifications, selectedId]
  );

  const markAsRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );

    if (!token) return;
    try {
      await marcarNotificacionLeida(token, id);
    } catch (error) {
      console.error('Error marcando notificacion leida:', error);
    }
  };

  const abrirDetalle = (item) => {
    markAsRead(item.id);
    setSelectedId(item.id);
  };

  const cerrarDetalle = () => {
    setSelectedId(null);
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

    if (!token) return;
    try {
      await marcarTodasNotificacionesLeidas(token);
    } catch (error) {
      console.error('Error marcando todas las notificaciones como leidas:', error);
    }
  };

  const isAndroidExpoGo = isExpoGoAndroid();

  const handleTestNotification = async () => {
    if (isAndroidExpoGo) {
      Alert.alert(
        'No disponible en Expo Go Android',
        'Expo Go Android no admite el módulo de notificaciones completo. Para probar notificaciones usa un development build o un cliente compatible.'
      );
      return;
    }

    try {
      const Notifications = await getNotificationsModule();
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Permiso requerido', 'Habilita notificaciones para probar este flujo.');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Notificacion de prueba',
          body: 'Esta es una alerta local para validar tu flujo en el dispositivo.',
          data: { type: 'local_test' },
        },
        trigger: null,
      });

      Alert.alert('Notificacion enviada', 'Se disparo una notificacion local de prueba.');
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo enviar la notificacion de prueba.');
    }
  };

  const handleRemotePushTest = async () => {
    if (isAndroidExpoGo) {
      Alert.alert(
        'No disponible en Expo Go Android',
        'Expo Go Android no admite notificaciones remotas. Usa un development build o un cliente compatible para esta funcionalidad.'
      );
      return;
    }

    try {
      if (!token) {
        Alert.alert('Sesion requerida', 'Inicia sesion nuevamente para probar push remoto.');
        return;
      }

      let result;

      try {
        result = await enviarNotificacionRemotaPrueba(token);
      } catch (error) {
        const message = String(error?.message || '');
        const noTokens = message.toLowerCase().includes('no hay device tokens registrados');

        if (!noTokens) {
          throw error;
        }

        await registrarTokenDispositivo(token);
        result = await enviarNotificacionRemotaPrueba(token);
      }

      const sent = result?.sent ?? 0;
      const failed = result?.failed ?? 0;

      Alert.alert('Push remoto enviado', `Enviadas: ${sent} · Fallidas: ${failed}`);
    } catch (error) {
      const message = String(error?.message || 'No se pudo enviar la notificacion remota.');
      const missingProjectId = message.toLowerCase().includes('projectid') || message.toLowerCase().includes('eas');

      if (missingProjectId) {
        Alert.alert(
          'Falta configuracion push',
          'No se pudo registrar el token remoto. Configura EXPO_PUBLIC_EAS_PROJECT_ID en .env y reinicia con bash scripts/dev.sh'
        );
        return;
      }

      Alert.alert('Error', message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Notificaciones</Text>

        <View style={styles.headerSide}>
          <TouchableOpacity onPress={markAllAsRead} style={styles.headerActionBtn}>
            <Text style={styles.readAll}>Marcar leidas</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isAndroidExpoGo ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={18} color="#92400E" />
            <Text style={styles.warningText}>
              En Expo Go Android las notificaciones no son compatibles. Para probar este flujo, usá un development build o un cliente compatible.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.testBtn} onPress={handleTestNotification}>
          <Ionicons name="send-outline" size={16} color={colors.primary} />
          <Text style={styles.testBtnText}>Probar notificacion en este celu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testBtn} onPress={handleRemotePushTest}>
          <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
          <Text style={styles.testBtnText}>Probar push real (backend)</Text>
        </TouchableOpacity>

        {!loadingFeed && notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Todavia no tenes notificaciones reales.</Text>
          </View>
        ) : null}

        {notifications.map((item) => (
          <TouchableOpacity key={item.id} style={styles.card} onPress={() => abrirDetalle(item)}>
            <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}> 
              <Ionicons name={item.icon} size={18} color={item.iconColor} />
            </View>

            <View style={styles.textWrap}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </View>

            {item.unread ? <View style={styles.unreadDot} /> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={cerrarDetalle}>
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBackdrop} onPress={cerrarDetalle} />
          {selected ? (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={[styles.iconWrap, { backgroundColor: selected.iconBg }]}> 
                  <Ionicons name={selected.icon} size={18} color={selected.iconColor} />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.detailTitle}>{selected.title}</Text>
                  <Text style={styles.cardSubtitle}>{selected.subtitle}</Text>
                </View>
              </View>

              <Text style={styles.detailDescription}>{selected.description}</Text>

              <View style={styles.detailActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={cerrarDetalle}>
                  <Text style={styles.secondaryBtnText}>Cerrar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    markAsRead(selected.id);
                    cerrarDetalle();
                  }}
                >
                  <Text style={styles.primaryBtnText}>Marcar leida</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF3',
    backgroundColor: colors.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: {
    width: 100,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerActionBtn: {
    alignSelf: 'flex-end',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  readAll: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  content: { padding: 16 },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E7EC',
    backgroundColor: '#F7F9FB',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  testBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCD3EC',
    backgroundColor: '#F6F2FC',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  testBtnText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  card: {
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: '#E9ECF0',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlayWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
  },
  detailCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: '#E9ECF0',
    padding: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: { fontSize: 15, color: colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  detailDescription: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  detailActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6DFE8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F4F7FA',
  },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    lineHeight: 18,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  textWrap: { flex: 1 },
  cardTitle: { fontSize: 14, color: colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  cardSubtitle: { fontSize: 12, color: colors.textSecondary },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
});
