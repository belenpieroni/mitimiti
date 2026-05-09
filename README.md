# Miti Miti

## Backend con Docker

Levantá backend y front juntos con el launcher que calcula la IP local automáticamente:

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

**Importante**: En Expo, solo las variables que empiezan con `EXPO_PUBLIC_` son accesibles desde la app. Las otras se usan en backend/Docker..