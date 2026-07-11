import { useMemo, useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, StyleSheet, Modal, Text, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { setAuthToken } from '../services/api';

import JoinViaLinkScreen from '../screens/JoinViaLinkScreen';
import ViviendaJoinViaLinkScreen from '../screens/ViviendaJoinViaLinkScreen';

import DeudasScreen from '../screens/DeudasScreen';
import HistorialCompletoScreen from '../screens/HistorialCompletoScreen';
import HomeScreen from '../screens/HomeScreen';
import JuntadasScreen from '../screens/JuntadasScreen';
import JuntadaDetalleScreen from '../screens/JuntadaDetalleScreen';
import CrearJuntadaScreen from '../screens/CrearJuntadaScreen';
import PerfilScreen from '../screens/PerfilScreen';
import PerfilAliasScreen from '../screens/PerfilAliasScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import BalanceScreen from '../screens/BalanceScreen';
import LoginScreen from '../screens/LoginScreen';
import AgregarGastoScreen from '../screens/AgregarGastoScreen';
import ViviendaDashboard from '../screens/vivienda/ViviendaDashboard';
import AgregarViviendaScreen from '../screens/vivienda/AgregarViviendaScreen';
import SalidasPorCategoriaScreen from '../screens/vivienda/SalidasPorCategoriaScreen';
import CategoriaDetalleScreen from '../screens/vivienda/CategoriaDetalleScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { AuthContext } from '../context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function JuntadasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JuntadasList" component={JuntadasScreen} />
      <Stack.Screen name="JuntadaDetalle" component={JuntadaDetalleScreen} />
      <Stack.Screen name="AgregarGasto" component={AgregarGastoScreen} />
      <Stack.Screen name="CrearJuntada" component={CrearJuntadaScreen} />
      <Stack.Screen name="Balance" component={BalanceScreen} />
      <Stack.Screen name="JoinViaLink" component={JoinViaLinkScreen} />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Perfil" component={PerfilScreen} />
      <Stack.Screen name="PerfilAlias" component={PerfilAliasScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

function ViviendaStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ViviendaDashboard" component={ViviendaDashboard} />
      <Stack.Screen name="AgregarVivienda" component={AgregarViviendaScreen} />
      <Stack.Screen name="SalidasPorCategoria" component={SalidasPorCategoriaScreen} />
      <Stack.Screen name="CategoriaDetalle" component={CategoriaDetalleScreen} />
      <Stack.Screen name="ViviendaJoinViaLink" component={ViviendaJoinViaLinkScreen} />
    </Stack.Navigator>
  );
}

function DeudasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DeudasMain" component={DeudasScreen} />
      <Stack.Screen name="HistorialCompleto" component={HistorialCompletoScreen} />
    </Stack.Navigator>
  );
}

function ProximamenteScreen() {
  return (
    <View style={styles.proximamenteContainer}>
      <Text style={styles.proximamenteTexto}>
        Este módulo estará disponible en próximas versiones
      </Text>
    </View>
  );
}

function BotonMas({ onPress }) {
  return (
    <View style={styles.botonMasContainer}>
      <TouchableOpacity style={styles.botonMas} onPress={onPress}>
        <Ionicons name="add" size={40} color="white" />
      </TouchableOpacity>
    </View>
  );
}

function RootTabs() {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            height: 90,
            paddingBottom: 16,
          },
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      >
        <Tab.Screen
          name="Inicio"
          component={HomeStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Juntadas"
          component={JuntadasStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('Juntadas', { screen: 'JuntadasList' });
            },
          })}
        />
        <Tab.Screen
          name="Agregar"
          component={ProximamenteScreen}
          options={{
            tabBarLabel: '',
            tabBarButton: (props) => (
              <BotonMas onPress={() => setModalVisible(true)} />
            ),
          }}
        />
        <Tab.Screen
          name="Vivienda"
          component={ViviendaStack}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('Vivienda', { screen: 'ViviendaDashboard' });
            },
          })}
        />
        <Tab.Screen 
          name="Deudas" 
          component={DeudasStack}
          options={{
            tabBarLabel: 'Deudas',
            tabBarIcon: ({ color, size }) => (
               <Ionicons name="wallet-outline" color={color} size={size} />
            ),
          }}
        />
      </Tab.Navigator>
      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={mStyles.overlay}
          enabled={Platform.OS === 'ios'}
        >
          <View style={mStyles.overlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
            
            <View style={mStyles.sheet}>
              <View style={mStyles.sheetHeader}>
                <Text style={mStyles.sheetTitle}>¿Qué querés crear?</Text>
                <TouchableOpacity style={mStyles.btnClose} onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Nueva Juntada */}
              <TouchableOpacity
                style={mStyles.optionCard}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate('AppTabs', { 
                    screen: 'Juntadas', 
                    params: { screen: 'CrearJuntada' } 
                  });
                }}
              >
                <View style={[mStyles.optionIconBg, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="people-outline" size={24} color={colors.primary} />
                </View>
                <View>
                  <Text style={mStyles.optionTitle}>Nueva juntada</Text>
                  <Text style={mStyles.optionSubtitle}>Asado, cumple, salida...</Text>
                </View>
              </TouchableOpacity>

              {/* Nuevo gasto de Vivienda */}
              <TouchableOpacity
                style={mStyles.optionCard}
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate('AppTabs', { 
                    screen: 'Vivienda', 
                    params: { screen: 'AgregarVivienda' } 
                  });
                }}
              >
                <View style={[mStyles.optionIconBg, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="home-outline" size={24} color="#1E88E5" />
                </View>
                <View>
                  <Text style={mStyles.optionTitle}>Nuevo gasto de vivienda</Text>
                  <Text style={mStyles.optionSubtitle}>Super, internet, expensas...</Text>
                </View>
              </TouchableOpacity>

            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default function AppNavigator() {
  const [session, setSession] = useState(null);

  const authValue = useMemo(() => ({
    user: session?.user || null,
    token: session?.token || null,
    isAuthenticated: Boolean(session?.user),
    login: (payload) => {
      if (payload?.user) {
        setSession({ user: payload.user, token: payload.token || null });
        setAuthToken(payload.token || null);
        return;
      }
      setSession({ user: payload || null, token: null });
      setAuthToken(null);
    },
    logout: () => { setSession(null); setAuthToken(null); },
  }), [session]);

  const linking = {
    prefixes: ['mitimiti://'],
    config: {
      screens: {
        AppTabs: {
          screens: {
            Juntadas: {
              screens: {
                JoinViaLink: 'join/:token',
              },
            },
            Vivienda: {
              screens: {
                ViviendaJoinViaLink: 'vivienda/join/:token',
              },
            },
          },
        },
      },
    },
  };

  return (
    <AuthContext.Provider value={authValue}>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {authValue.isAuthenticated ? (
            <Stack.Screen name="AppTabs" component={RootTabs} />
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  botonMasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 16,
  },
  botonMas: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  proximamenteContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  proximamenteTexto: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 16,
  }
});

const mStyles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'flex-end' 
  },
  sheet: {
    backgroundColor: colors.background, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24,
    padding: 24, 
    paddingBottom: 40,
    marginTop: 'auto',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: colors.textPrimary 
  },
  btnClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionCard: {
    backgroundColor: colors.cardBg, 
    borderRadius: 16, 
    padding: 16,
    marginBottom: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16,
  },
  optionDisabled: {
    opacity: 0.5,
    backgroundColor: '#E8E8E8',
  },
  optionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: colors.textPrimary,
    marginBottom: 2
  },
  optionSubtitle: { 
    fontSize: 13, 
    color: colors.textSecondary 
  },
});