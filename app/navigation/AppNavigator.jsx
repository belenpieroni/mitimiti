import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Alert, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen';
import JuntadasScreen from '../screens/JuntadasScreen';
import JuntadaDetalleScreen from '../screens/JuntadaDetalleScreen';
import CrearJuntadaScreen from '../screens/CrearJuntadaScreen';
import PerfilScreen from '../screens/PerfilScreen';
import BalanceScreen from '../screens/BalanceScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function JuntadasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JuntadasList" component={JuntadasScreen} />
      <Stack.Screen name="JuntadaDetalle" component={JuntadaDetalleScreen} />
      <Stack.Screen name="CrearJuntada" component={CrearJuntadaScreen} />
      <Stack.Screen name="Balance" component={BalanceScreen} />
    </Stack.Navigator>
  );
}

function ProximamenteScreen() {
  return null;
}

function BotonMas({ onPress }) {
  return (
    <TouchableOpacity style={styles.botonMas} onPress={onPress}>
      <Ionicons name="add" size={32} color="white" />
    </TouchableOpacity>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            height: 64,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      >
        <Tab.Screen
          name="Inicio"
          component={HomeScreen}
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
        />
        <Tab.Screen
          name="Agregar"
          component={ProximamenteScreen}
          options={{
            tabBarLabel: '',
            tabBarButton: (props) => (
              <BotonMas onPress={() => Alert.alert('¿Qué querés agregar?', 'Próximamente')} />
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
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              Alert.alert('Próximamente', 'Este módulo estará disponible en la próxima versión.');
            },
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
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              Alert.alert('Próximamente', 'Este módulo estará disponible en la próxima versión.');
            },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  botonMas: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});