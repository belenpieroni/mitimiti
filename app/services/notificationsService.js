import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    undefined
  );
}

async function requestExpoPushToken() {
  if (!Device.isDevice) {
    throw new Error('Las notificaciones push requieren un dispositivo fisico.');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Permiso de notificaciones denegado por el usuario.');
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('No se detecto projectId de EAS. Configura EXPO_PUBLIC_EAS_PROJECT_ID para push remoto.');
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f46e5',
    });
  }

  return tokenResponse.data;
}

export async function registrarTokenDispositivo(authToken) {
  const deviceToken = await requestExpoPushToken();

  await api.post(
    '/auth/device-token',
    {
      deviceToken,
      platform: Platform.OS,
    },
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  return deviceToken;
}

export async function enviarNotificacionLocalPrueba() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Permiso de notificaciones denegado por el usuario.');
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Notificacion de prueba',
      body: 'Esta es una alerta local para validar tu flujo en el dispositivo.',
      data: { type: 'local_test' },
    },
    trigger: null,
  });
}

export async function enviarNotificacionRemotaPrueba(authToken) {
  return api.post(
    '/auth/push-test',
    {},
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );
}
