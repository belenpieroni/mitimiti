let admin;
try {
  admin = require('firebase-admin');
} catch (error) {
  admin = null;
}

let firebaseReady = false;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const NOTIFICATION_CATEGORIES = {
  NUEVOS_GASTOS: 'nuevos_gastos',
  RECORDATORIOS_VENCIMIENTO: 'recordatorios_vencimiento',
  NUEVAS_JUNTADAS: 'nuevas_juntadas',
};

const CATEGORY_TO_PREFERENCE_KEY = {
  [NOTIFICATION_CATEGORIES.NUEVOS_GASTOS]: 'nuevosGastos',
  [NOTIFICATION_CATEGORIES.RECORDATORIOS_VENCIMIENTO]: 'recordatoriosVencimiento',
  [NOTIFICATION_CATEGORIES.NUEVAS_JUNTADAS]: 'nuevasJuntadas',
};

const DEFAULT_PREFERENCES = {
  nuevosGastos: true,
  recordatoriosVencimiento: true,
  nuevasJuntadas: true,
};

function getFirebaseConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  };
}

function getMessagingClient() {
  if (!admin) {
    return null;
  }

  if (!firebaseReady) {
    const config = getFirebaseConfig();
    if (!config) {
      return null;
    }

    if (!admin.apps.length) {
      admin.initializeApp(config);
    }
    firebaseReady = true;
  }

  return admin.messaging();
}

function buildMulticastMessage(tokens, payload) {
  return {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
  };
}

function isExpoPushToken(token = '') {
  return /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token);
}

function chunkArray(items = [], chunkSize = 100) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function sendExpoPushToTokens(tokens = [], payload = {}) {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (!uniqueTokens.length) {
    return { ok: true, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const responses = [];
  const chunks = chunkArray(uniqueTokens, 100);

  for (const tokenChunk of chunks) {
    const messages = tokenChunk.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: 'default',
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const json = await response.json();
    const results = Array.isArray(json?.data) ? json.data : [];

    results.forEach((result) => {
      if (result?.status === 'ok') {
        sent += 1;
      } else {
        failed += 1;
      }
      responses.push(result);
    });
  }

  return {
    ok: failed === 0,
    sent,
    failed,
    responses,
  };
}

async function sendPushToTokens(tokens = [], payload = {}) {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];
  if (!uniqueTokens.length) {
    return { ok: true, sent: 0, failed: 0 };
  }

  const expoTokens = uniqueTokens.filter(isExpoPushToken);
  const nativeTokens = uniqueTokens.filter((token) => !isExpoPushToken(token));

  const expoResult = await sendExpoPushToTokens(expoTokens, payload);

  let nativeResult = { ok: true, sent: 0, failed: 0 };
  if (nativeTokens.length > 0) {
    const messaging = getMessagingClient();
    if (!messaging) {
      console.warn('[push] Firebase no configurado para tokens nativos.');
      nativeResult = { ok: false, sent: 0, failed: nativeTokens.length, skipped: true };
    } else {
      const message = buildMulticastMessage(nativeTokens, payload);
      const result = await messaging.sendEachForMulticast(message);
      nativeResult = {
        ok: result.failureCount === 0,
        sent: result.successCount,
        failed: result.failureCount,
        responses: result.responses,
      };
    }
  }

  return {
    ok: expoResult.ok && nativeResult.ok,
    sent: expoResult.sent + nativeResult.sent,
    failed: expoResult.failed + nativeResult.failed,
    responses: [
      ...(expoResult.responses || []),
      ...(nativeResult.responses || []),
    ],
  };
}

function getUserDeviceTokens(user = {}) {
  if (!Array.isArray(user.deviceTokens)) {
    return [];
  }

  return user.deviceTokens
    .map((entry) => entry && entry.token)
    .filter(Boolean);
}

function getUserPreferences(user = {}) {
  const incoming = user.notificationPreferences;
  if (!incoming || typeof incoming !== 'object') {
    return { ...DEFAULT_PREFERENCES };
  }

  return {
    ...DEFAULT_PREFERENCES,
    ...incoming,
  };
}

function isCategoryEnabledForUser(user = {}, category) {
  if (!category) {
    return true;
  }

  const preferenceKey = CATEGORY_TO_PREFERENCE_KEY[category];
  if (!preferenceKey) {
    return true;
  }

  const prefs = getUserPreferences(user);
  return prefs[preferenceKey] !== false;
}

async function notifyUsersByName(db, names = [], payload = {}, options = {}) {
  const normalizedNames = names
    .map((n) => (n || '').trim().toLowerCase())
    .filter(Boolean);
  const category = options.category;

  if (!normalizedNames.length || !Array.isArray(db.usuarios)) {
    return { ok: true, sent: 0, failed: 0 };
  }

  const tokens = db.usuarios
    .filter((u) => normalizedNames.includes((u.name || '').trim().toLowerCase()))
    .filter((u) => isCategoryEnabledForUser(u, category))
    .flatMap(getUserDeviceTokens);

  return sendPushToTokens(tokens, payload);
}

module.exports = {
  NOTIFICATION_CATEGORIES,
  sendPushToTokens,
  notifyUsersByName,
};