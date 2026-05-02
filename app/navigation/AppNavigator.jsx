import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Alert } from 'react-native';
import { colors } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen';
import JuntadasScreen from '../screens/JuntadasScreen';
import JuntadaDetalleScreen from '../screens/JuntadaDetalleScreen';
import CrearJuntadaScreen from '../screens/CrearJuntadaScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function JuntadasStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JuntadasList" component={JuntadasScreen} />
      <Stack.Screen name="JuntadaDetalle" component={JuntadaDetalleScreen} />
      <Stack.Screen name="CrearJuntada" component={CrearJuntadaScreen} />
    </Stack.Navigator>
  );
}

function ProximamenteScreen() {
  return null;
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.tabBarBg },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      >
        <Tab.Screen name="Inicio" component={HomeScreen} />
        <Tab.Screen name="Juntadas" component={JuntadasStack} />
        <Tab.Screen
          name="Vivienda"
          component={ProximamenteScreen}
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
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              Alert.alert('Próximamente', 'Este módulo estará disponible en la próxima versión.');
            },
          }}
        />
        <Tab.Screen name="Perfil" component={PerfilScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}