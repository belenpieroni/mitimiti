import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../navigation/AppNavigator';
import { obtenerBalanceGlobal } from '../services/juntadasService';

export default function PerfilScreen({ navigation }) {
  const { user, logout } = useAuth();

  // Fallbacks consistentes con el estado global de auth
  const nombreUsuario = user?.name ?? 'Usuario';
  const emailUsuario = user?.email ?? '';
  const inicialesUsuario = user?.iniciales ?? 'US';

  const juntadas = user?.juntadas ?? 0;
  const servicios = user?.servicios ?? 0;
  const viajes = user?.viajes ?? 0;

  // Avatar dinámico seguro
  const coloresAvatar = [
    '#473472',
    '#526D82',
    '#42b271',
    '#c084fc',
    '#f97316',
  ];

  const avatarColor =
    coloresAvatar[
      (nombreUsuario?.charCodeAt?.(0) || 0) % coloresAvatar.length
    ];

  // Estado del balance general
  const [balance, setBalance] = useState({
    total: 0,
    porCobrar: 0,
    porPagar: 0,
  });

  const [cargandoBalance, setCargandoBalance] = useState(true);

  // Hook de sincronización seguro contra nulos
  useEffect(() => {
    if (!user?.name) {
      setCargandoBalance(false);
      return;
    }

    async function cargarBalance() {
      try {
        const response = await obtenerBalanceGlobal(user.name);

        if (response?.data?.data) {
          setBalance(response.data.data);
        }
      } catch (err) {
        console.error('Error al cargar balance global:', err);
      } finally {
        setCargandoBalance(false);
      }
    }

    cargarBalance();
  }, [user]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.btnVolver}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        <Text style={styles.tituloHeader}>Perfil</Text>
      </View>

      {/* Info de Usuario */}
      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarTexto}>{inicialesUsuario}</Text>
        </View>

        <Text style={styles.userName}>{nombreUsuario}</Text>
        {emailUsuario ? <Text style={styles.userEmail}>{emailUsuario}</Text> : null}
      </View>

      {/* Módulos de Actividad */}
      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{juntadas}</Text>
          <Text style={styles.statLabel}>Juntadas</Text>
        </View>

        <View style={styles.verticalDivider} />

        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{servicios}</Text>
          <Text style={styles.statLabel}>Servicios</Text>
        </View>

        <View style={styles.verticalDivider} />

        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{viajes}</Text>
          <Text style={styles.statLabel}>Viajes</Text>
        </View>
      </View>

      {/* Tarjeta de Balance General con Loader */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceTitulo}>Balance General</Text>

        {cargandoBalance ? (
          <Text style={styles.balanceLoading}>Cargando balance...</Text>
        ) : (
          <>
            <Text
              style={[
                styles.balanceResultado,
                {
                  color:
                    balance.total >= 0
                      ? colors.greenGlobal
                      : colors.redGlobal,
                },
              ]}
            >
              {balance.total >= 0 ? '+' : '-'}$
              {Math.abs(balance.total).toLocaleString('es-AR')}
            </Text>

            <View style={styles.balanceDetalleFila}>
              <View>
                <Text style={styles.balanceLabel}>Te deben</Text>
                <Text
                  style={[
                    styles.balanceValor,
                    { color: colors.greenGlobal },
                  ]}
                >
                  ${balance.porCobrar.toLocaleString('es-AR')}
                </Text>
              </View>

              <View>
                <Text style={styles.balanceLabel}>Debés</Text>
                <Text
                  style={[
                    styles.balanceValor,
                    { color: colors.redGlobal },
                  ]}
                >
                  ${balance.porPagar.toLocaleString('es-AR')}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Footer y Logout */}
      <View style={styles.footer}>
        <Text style={styles.appNombre}>Miti-Miti</Text>
        <Text style={styles.appVersion}>v0.2.0</Text>

        <TouchableOpacity style={styles.btnLogout} onPress={logout}>
          <Ionicons
            name="log-out-outline"
            size={18}
            color={colors.redGlobal}
          />
          <Text style={styles.btnLogoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 52,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  btnVolver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tituloHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarTexto: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userEmail: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  verticalDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E5E5',
  },
  balanceCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  balanceTitulo: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  balanceResultado: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  balanceDetalleFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceLoading: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingVertical: 8,
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  balanceValor: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  appNombre: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  appVersion: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  btnLogout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnLogoutText: {
    color: colors.redGlobal,
    fontWeight: '600',
  },
});