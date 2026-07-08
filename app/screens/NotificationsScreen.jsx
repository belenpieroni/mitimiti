import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  enviarNotificacionRemotaPrueba,
  registrarTokenDispositivo,
} from '../services/notificationsService';

const INITIAL_NOTIFICATIONS = [
  {
    id: '1',
    title: 'Factura de luz vence en 3 dias',
    subtitle: 'Hace 2 horas',
    description: 'Recordatorio: la factura de luz vence en 48 horas. Te recomendamos pagarla hoy para evitar recargos.',
    icon: 'flash-outline',
    iconBg: '#FBEAEA',
    iconColor: '#D64B3B',
    unread: true,
  },
  {
    id: '2',
    title: 'Ivo agrego un gasto en Cumpleanos',
    subtitle: 'Hace 5 horas',
    description: 'Se agrego un gasto nuevo en la juntada Cumpleanos. Revisa el detalle para ver tu parte pendiente.',
    icon: 'cash-outline',
    iconBg: '#E8F8EF',
    iconColor: '#2E7D5C',
    unread: true,
  },
  {
    id: '3',
    title: 'Te agregaron a Noche de Tacos',
    subtitle: 'Ayer',
    description: 'Ahora participas en la juntada Noche de Tacos. Ya podes cargar gastos y ver balances.',
    icon: 'people-outline',
    iconBg: '#EEE9FA',
    iconColor: colors.primary,
    unread: false,
  },
];

export default function NotificationsScreen({ navigation }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => notifications.find((n) => n.id === selectedId) || null,
    [notifications, selectedId]
  );

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const abrirDetalle = (item) => {
    markAsRead(item.id);
    setSelectedId(item.id);
  };

  const cerrarDetalle = () => {
    setSelectedId(null);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleTestNotification = async () => {
    try {
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.title}>Notificaciones</Text>

        <TouchableOpacity onPress={markAllAsRead}>
          <Text style={styles.readAll}>Marcar leidas</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.testBtn} onPress={handleTestNotification}>
          <Ionicons name="send-outline" size={16} color={colors.primary} />
          <Text style={styles.testBtnText}>Probar notificacion en este celu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testBtn} onPress={handleRemotePushTest}>
          <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
          <Text style={styles.testBtnText}>Probar push real (backend)</Text>
        </TouchableOpacity>

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
