import { useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, TouchableOpacity, StyleSheet, Modal, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen';
import JuntadasScreen from '../screens/JuntadasScreen';
import JuntadaDetalleScreen from '../screens/JuntadaDetalleScreen';
import CrearJuntadaScreen from '../screens/CrearJuntadaScreen';
import PerfilScreen from '../screens/PerfilScreen';
import BalanceScreen from '../screens/BalanceScreen';
import AgregarGastoScreen from '../screens/AgregarGastoScreen';

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
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Perfil" component={PerfilScreen} />
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
          component={ProximamenteScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Viajes"
          component={ProximamenteScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="airplane-outline" size={size} color={color} />
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
                  navigation.navigate('Juntadas', { screen: 'CrearJuntada' });
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
              <View style={[mStyles.optionCard, mStyles.optionDisabled]}>
                <View style={[mStyles.optionIconBg, { backgroundColor: '#F0F5F9' }]}>
                  <Ionicons name="home-outline" size={24} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={mStyles.optionTitle}>Nuevo gasto de vivienda</Text>
                  <Text style={mStyles.optionTitle}>(Próximamente)</Text>
                  <Text style={mStyles.optionSubtitle}>Super, internet, expensas...</Text>
                </View>
              </View>

              {/* Nuevo Viaje */}
              <View style={[mStyles.optionCard, mStyles.optionDisabled]}>
                <View style={[mStyles.optionIconBg, { backgroundColor: '#E9F7EF' }]}>
                  <Ionicons name="airplane-outline" size={24} color={colors.greenGlobal} />
                </View>
                <View>
                  <Text style={mStyles.optionTitle}>Nuevo viaje (Próximamente)</Text>
                  <Text style={mStyles.optionSubtitle}>Escapada, vacaciones...</Text>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootTabs />
    </NavigationContainer>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

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