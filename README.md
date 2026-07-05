# Miti Miti

## Backend con Docker

Levantá backend y front juntos con el launcher que calcula la IP local automáticamente:

```bash
bash scripts/dev.sh
```

El script ahora tambien:

- crea `.env` automaticamente desde `.env.example` si no existe
- genera `.env.local` con `EXPO_PUBLIC_API_URL` dinamica para tu red local
- copia `EXPO_PUBLIC_EAS_PROJECT_ID` desde `.env` a `.env.local` si esta configurado

Si estas parado dentro de `backend/`, tambien podes usar:

```bash
bash scripts/dev.sh
```

Si querés levantar solo la API:

```bash
docker compose up --build backend
```

La API queda disponible en `http://localhost:3000`.

## Expo

La app de front también puede levantarse sola desde la raíz del proyecto con:

```bash
npm install
npm run start:tunnel
```

Opcionalmente podés usar `npm run android`, `npm run ios` o `npm run web`.

Cuando usás `scripts/dev.sh`, la variable `EXPO_PUBLIC_API_URL` se completa sola con tu IP local, así la app puede hablar con el backend sin tocar nada a mano.
Si abrís Expo Go, usá el QR o el link `exp://...exp.direct` que imprime el terminal del front.

Si ves el prompt:

```text
It is recommended to log in with your Expo account before proceeding.
```

es porque `expo start --tunnel` se está ejecutando sin sesión de Expo en el contenedor. Podés:

- elegir `Proceed anonymously` y continuar
- o configurar `EXPO_TOKEN` en `.env` para evitar el prompt en cada arranque

## Flujo Completo

1. Levantá ambos servicios:

```bash
bash scripts/dev.sh
```

2. Si preferís correrlo manualmente:

```bash
npm install
docker compose up --build backend
npm run start:tunnel
```

Si alguna vez necesitás forzar una URL distinta, definí `EXPO_PUBLIC_API_URL`.

## Variables de Entorno

1. Copiá `.env.example` a `.env`:

```bash
cp .env.example .env
```

2. Editá `.env` con tus valores locales si es necesario. **Nunca commitees `.env` con credenciales**.

Si querés evitar el prompt de login de Expo al levantar Docker, agregá tambien:

```bash
EXPO_TOKEN=tu_token_de_expo
```

Podés generar ese token en Expo Dashboard (Account > Access Tokens).

**Importante**: En Expo, solo las variables que empiezan con `EXPO_PUBLIC_` son accesibles desde la app. Las otras se usan en backend/Docker.

## Notificaciones Push (Sprint 3)

Para habilitar envio real por Firebase Cloud Messaging:

1. Instalar dependencias nuevas:

```bash
npm install
cd backend && npm install
```

2. Configurar variables en `.env`:

- `JWT_SECRET`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (respetando saltos de linea con `\\n`)
- `EXPO_PUBLIC_EAS_PROJECT_ID` (para obtener token push en frontend)

3. Flujo implementado:

- Login exitoso en app solicita permiso del sistema operativo para notificaciones.
- Si el permiso se concede, se captura el device token y se persiste en backend por usuario.
- Cuando se agregan participantes nuevos a una juntada, backend dispara push al receptor.
- Cuando se agrega un gasto en juntada, backend envia alerta a participantes segun preferencias.
- El cron del backend evalua servicios con vencimiento en 48h y emite recordatorios.
- Desde Perfil, el usuario puede abrir Configuracion de notificaciones y activar/desactivar:
	- Nuevos gastos
	- Recordatorios de vencimiento
	- Nuevas juntadas
- El backend persiste estas preferencias por usuario y bloquea futuros envios de categorias desactivadas.

4. Nota importante sobre Expo Go:

- En SDK 53+ de Expo, las notificaciones push remotas no funcionan completas en Expo Go.
- Para probar push end-to-end en iPhone/Android, usa un Development Build.
- Si queres seguir en Expo Go, la app no se rompe, pero el registro de token puede omitirse.