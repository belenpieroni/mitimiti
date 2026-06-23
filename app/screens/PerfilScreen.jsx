import { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../navigation/AppNavigator';
import { listarJuntadas } from '../services/juntadasService';

function getInitials(name) {
  if (!name) return 'US';
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getAliasFromEmail(email) {
  if (!email) return '@usuario';
  return `@${email.split('@')[0]}`;
}

const profileItems = [
  { id: 'notificaciones', label: 'Notificaciones', icon: 'notifications-outline', iconBg: '#ECE9F5', iconColor: colors.primary },
  { id: 'preferencias', label: 'Preferencias', icon: 'settings-outline', iconBg: '#EEF2F6', iconColor: colors.textSecondary },
  { id: 'privacidad', label: 'Privacidad', icon: 'shield-checkmark-outline', iconBg: '#EAF4EF', iconColor: '#2E7D5C' },
  { id: 'ayuda', label: 'Ayuda y soporte', icon: 'help-circle-outline', iconBg: '#FBEAEA', iconColor: '#D64B3B' },
  { id: 'alias', label: 'Alias y CBU', icon: 'card-outline', iconBg: '#EEE9FA', iconColor: colors.primary },
];

export default function PerfilScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const nombre = user?.name || 'Usuario';
  const email = user?.email || 'usuario@mail.com';
  const iniciales = useMemo(() => getInitials(nombre), [nombre]);
  const miniAlias = useMemo(() => getAliasFromEmail(email), [email]);

  const [cantidadJuntadas, setCantidadJuntadas] = useState(0);

  const cargarContadorJuntadas = useCallback(async () => {
    const nombreUsuario = user?.name || user?.nombre;
    if (!nombreUsuario) return;

    try {
      const response = await listarJuntadas(nombreUsuario);
      const datos = response?.data || response;
      if (Array.isArray(datos)) {
        setCantidadJuntadas(datos.length);
      }
    } catch (e) {
      console.error("Error cargando contador de juntadas en perfil:", e);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      cargarContadorJuntadas();
    }, [cargarContadorJuntadas])
  );

  const stats = [
    { label: 'Juntadas', value: cantidadJuntadas },
    { label: 'Servicios', value: 2 },
  ];

  const handleItemPress = (id) => {
    if (id === 'alias') {
      navigation.navigate('PerfilAlias');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
      </View>

      <View style={styles.profileTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{iniciales}</Text>
        </View>
        <Text style={styles.name}>{nombre}</Text>
        <Text style={styles.email}>{miniAlias}</Text>
      </View>

      <View style={styles.statsCard}>
        {stats.map((item, index) => (
          <View key={item.label} style={styles.statCol}>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
            {index < stats.length - 1 ? <View style={styles.divider} /> : null}
          </View>
        ))}
      </View>

      <View style={styles.itemsWrap}>
        {profileItems.map((item) => (
          <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => handleItemPress(item.id)}>
            <View style={styles.itemLeft}>
              <View style={[styles.itemIconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              </View>
              <Text style={styles.itemLabel}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#A3B1BE" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color="#D64B3B" />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 34 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 26 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F2F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  profileTop: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: { color: 'white', fontSize: 23, fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  email: { fontSize: 13, color: '#446380', fontWeight: '500' },
  statsCard: {
    backgroundColor: '#F5F6F8',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    marginBottom: 16,
  },
  statCol: { flex: 1, alignItems: 'center', position: 'relative' },
  statValue: { fontSize: 19, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  statLabel: { fontSize: 13, color: '#4E6782' },
  divider: {
    position: 'absolute',
    right: 0,
    top: 4,
    bottom: 4,
    width: 1,
    backgroundColor: '#DFE3E8',
  },
  itemsWrap: { gap: 12 },
  itemCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: { color: colors.textPrimary, fontSize: 13.3, fontWeight: '600' },
  logoutBtn: {
    marginTop: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0B8B2',
    backgroundColor: '#FCEEEE',
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: { color: '#D64B3B', fontSize: 14.5, fontWeight: '700' },
});