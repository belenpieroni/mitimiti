# Changelog: Entrega 1 a Entrega 2

Este archivo detalla los cambios realizados en el proyecto entre la rama `entrega-1` y la rama `entrega-2`.

## Resumen de Modificaciones

- **53 archivos modificados**
- **8792 inserciones (+)**
- **1095 eliminaciones (-)**

## Funcionalidades y Correcciones

A continuación, un resumen de los commits más importantes agrupados por área:

### Frontend (App)

- **Vivienda:** Desarrollo del panel principal, modal de servicios y gráfico de gastos por categoría (`feat(vivienda)`).
- **Subgrupos:** UI para gestión de subgrupos y división de gastos (`feat(frontend)`).
- **Perfil:** Añadida pantalla de perfil que se alimenta del backend, visualización de alias y copiado al portapapeles (`feat(perfil)`).
- **Tickets (OCR):** Implementado el escaneo de tickets mediante OCR e interfaz modal para capturas (`feat(OCR)`).
- **Login:** Pantalla de login funcionando; se eliminaron datos hardcodeados para que use la API del backend (`feat(login)`).
- **Juntadas y Gastos:** Cambios estéticos en Gastos/Balance. Select all/none en gastos, Date Picker y edición de subgrupos.
- **Navegación y UI:** Corrección del navegador inferior, reseteo de pantallas en inicio, unificación de tipografías globales y solución de errores de sintaxis en `AppNavigator`.

### Backend & Database

- **Vivienda:** Implementación de endpoints y lógica de actualización para gastos y servicios, e inicialización del cron job (servicio programado) para vencimientos.
- **Subgrupos y Balances:** Agregado soporte y cálculo de balances por subgrupos en backend. Mapeo de alias en los balances.
- **Autenticación:** Incorporación de `jwt`, `bcryptjs`, y agregación del `auth router`.
- **Perfil y OCR:** Ajuste del backend para permitir multiusuario y procesamiento OCR de tickets desde el servidor.
- **Base de Datos:** Actualización de la estructura de `db.json` para incluir nuevos perfiles e instancias de prueba. Configuración ajustada para volúmenes de Docker.

### Dependencias y Configuración

- Instalación de librerías para gráficos de torta y utilidades del módulo vivienda.
- Inclusión de `@react-native-clipboard/clipboard` y `@react-native-community/datetimepicker`.
- Actualización de los archivos `package.json` y `package-lock.json` tanto en la raíz como en el backend.

## Principales Archivos Afectados

**Nuevas Pantallas y Componentes Frontend:**

- `app/screens/DeudasScreen.jsx`
- `app/screens/GestionarSubgruposScreen.jsx`
- `app/screens/LoginScreen.jsx`
- `app/screens/PerfilAliasScreen.jsx`
- `app/screens/vivienda/AgregarViviendaScreen.jsx`
- `app/screens/vivienda/ViviendaDashboard.jsx`
- `app/screens/vivienda/SalidasPorCategoriaScreen.jsx`
- `app/components/CaptureTicketModal.jsx`

**Controladores y Servicios Backend Destacados:**

- `backend/src/controllers/authController.js`
- `backend/src/controllers/juntadasController.js`
- `backend/src/controllers/viviendaController.js`
- `backend/src/services/ocrService.js`
- `backend/src/services/cronService.js`
- Agregados assets (ej. `logo_icon.png` e imágenes de prueba OCR).

# Changelog: Entrega 2 a Entrega Final (Entrega 3)

Este archivo detalla los cambios realizados en el proyecto entre la rama `entrega-2` y la versión final en `main` (Entrega 3).

## Resumen de Modificaciones

- **76 archivos modificados**
- **11545 inserciones (+)**
- **2538 eliminaciones (-)**

## Funcionalidades y Correcciones

A continuación, un resumen de los commits más importantes agrupados por área:

### Frontend (App)

- **Deudas e Historial:** Incorporación de _netting automático_ y cálculo de deudas netas para evitar pagos duplicados, junto a una nueva pantalla de historial completo.
- **Integración de Pagos:** Interfaz para subir comprobantes (tickets), con mejoras en los modales de liquidación y notificaciones visuales tras marcar balances como pagados.
- **Vivienda:** Añadidos enlaces de invitación, permisos de anfitrión (Host), listas de participantes dinámicas y corrección de la navegación temporal en gráficas de categorías.
- **UI y Experiencia:** Identificador de usuario actual, visualización de alias en balances, refinamiento de modales, alertas y actualizaciones del entorno Expo Go.

### Backend & Database

- **PostgreSQL:** Migración total de la persistencia (de `db.json` a PostgreSQL) incluyendo estructura completa en `schema.sql`, sistema de migraciones (`seed.js`) y persistencia en volúmenes Docker.
- **Notificaciones Push:** Implementación real de `expo-notifications`, permitiendo enviar notificaciones push a dispositivos reales (iOS/Android), con preferencias configurables.
- **Deudas y Netting:** Nueva lógica en el controlador de deudas para cálculos financieros optimizados, consolidando transferencias de forma eficiente para minimizar transacciones.
- **Subgrupos:** Refactorización profunda de la base de datos para manejar subgrupos como arreglos dinámicos en lugar de tablas intermedias.
- **Limpieza de Código:** Importante refactorización, eliminación de componentes inactivos y optimización de controladores.

### Dependencias y Configuración

- Entorno Docker mejorado (resolución de problemas con Expo CLI, `EXPO_TOKEN` y detección de IP en `dev.sh`).
- Añadidas variables de entorno `.env.local` y actualización global de dependencias (`expo`, `react-native`, librerías de componentes).

## Principales Archivos Afectados

**Nuevas Pantallas y Componentes Frontend:**

- `app/screens/DeudasScreen.jsx`
- `app/screens/HistorialCompletoScreen.jsx`
- `app/components/LiquidarServicioModal.jsx`
- `app/components/Toast.jsx`
- `app/screens/vivienda/ViviendaDashboard.jsx`

**Controladores y Base de Datos:**

- `backend/src/migrations/schema.sql`
- `backend/src/migrations/seed.js`
- `backend/src/controllers/deudasController.js`
- `backend/src/services/pushNotificationService.js`
