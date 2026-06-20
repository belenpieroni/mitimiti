# OCR para Escaneo de Tickets 📸

## Historia de Usuario Implementada

**Como usuario que realiza compras**, quiero utilizar la cámara para escanear tickets y boletas mediante tecnología OCR para automatizar la carga de datos y evitar errores de tipeo manual.

## Criterios de Aceptación ✅

### CA1: Extracción de Importe
- ✅ **Given** un usuario en la pantalla de carga de un nuevo gasto
- ✅ **When** selecciona la opción de escaneo y captura una imagen nítida
- ✅ **Then** el sistema extrae el importe total y lo autocompleta en el campo correspondiente

### CA2: Manejo de Fallos
- ✅ **Given** una imagen borrosa o ilegible
- ✅ **When** el módulo OCR falla al detectar los números
- ✅ **Then** la interfaz despliega un mensaje solicitando el ingreso manual del importe

## Tecnología Implementada

### Frontend
- **Tesseract.js 5.x**: OCR en JavaScript puro (sin dependencias externas)
- **expo-camera**: Captura de fotos nativas
- **expo-image-picker**: Selección de imágenes de galería (opcional)

### Backend
- **multer**: Middleware para manejo de file uploads
- **Express.js**: Servidor de archivos estáticos

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     AgregarGastoScreen                       │
│  [$ 0] [📷 OCR] [📎 Clip] ← Nuevo: botón cámara + clip      │
└───────────────┬─────────────────────────────────────────────┘
                │
                ├─→ CaptureTicketModal
                │   ├─ CameraView (expo-camera)
                │   ├─ Preview + botones (Nueva foto / Escanear)
                │   └─ Loading overlay
                │
                ├─→ OCR Service (Tesseract.js)
                │   ├─ extractTextFromImage()
                │   └─ extractAmountFromTicket()
                │       └─ Búsqueda de patrones regex
                │           ├─ $XXX.XX (con moneda)
                │           ├─ Total: XXX.XX
                │           └─ XXX,XX (comas europeas)
                │
                ├─→ Upload Service
                │   └─ uploadTicketPhoto(imageUri)
                │       └─ POST /api/uploads (FormData)
                │
                └─→ Backend
                    ├─ /api/uploads (POST)
                    │   └─ multer.single('file')
                    │   └─ Guarda en ./backend/uploads/
                    │   └─ Retorna { url: '/uploads/ticket-...' }
                    │
                    └─ /uploads/* (GET - archivos estáticos)
```

## Cambios en el Código

### 1. Frontend - Nuevos Servicios

#### `app/services/ocrService.js` (NUEVO)
```javascript
// Inicializa worker de Tesseract
await initWorker();

// Extrae texto de imagen
extractTextFromImage(imageUri) → string

// Busca y extrae importe del ticket
extractAmountFromTicket(imageUri) → number | null
  ├─ Patrón 1: $123.45, 123.45, 123,45
  ├─ Patrón 2: "Total: 123.45"
  └─ Retorna el mayor número encontrado
```

#### `app/services/uploadService.js` (NUEVO)
```javascript
uploadTicketPhoto(imageUri) → {
  filename: string,
  url: string,        // /uploads/ticket-...
  mimetype: string,
  size: number
}
```

### 2. Frontend - Componentes

#### `app/components/CaptureTicketModal.jsx` (NUEVO)
```
Modal con:
├─ Pantalla de cámara
│   ├─ Encabezado: Close, "Escanear ticket", Flip cámara
│   ├─ Guía visual (rectángulo de referencia)
│   └─ Botón capturar (circular blanco/púrpura)
│
└─ Pantalla de preview
    ├─ Imagen capturada
    ├─ Botones: "Nueva foto" | "Escanear"
    └─ Loading overlay mientras procesa OCR
```

**Props:**
- `visible: boolean` - Mostrar/ocultar modal
- `onClose: function` - Cerrar sin resultado
- `onAmountExtracted: function` - Callback con { amount, photo }

### 3. Frontend - Pantallas Modificadas

#### `app/screens/AgregarGastoScreen.jsx`
```diff
+ import { uploadTicketPhoto } from '../services/uploadService';
+ import CaptureTicketModal from '../components/CaptureTicketModal';

Estados:
+ const [mostrarOCR, setMostrarOCR] = useState(false);
+ const [adjuntoTicket, setAdjuntoTicket] = useState(null);

UI - Sección de monto:
+ <TouchableOpacity style={styles.btnOCR} onPress={() => setMostrarOCR(true)}>
+   <MaterialCommunityIcons name="image-outline" size={24} color={colors.primary} />
+ </TouchableOpacity>
+ {adjuntoTicket && (
+   <MaterialCommunityIcons name="paperclip" size={20} color={colors.primary} />
+ )}

handleGuardar():
+ if (adjuntoTicket) {
+   const uploadResult = await uploadTicketPhoto(adjuntoTicket);
+   datosGasto.ticketPhoto = uploadResult.url;
+ }

Modal:
+ <CaptureTicketModal
+   visible={mostrarOCR}
+   onClose={() => setMostrarOCR(false)}
+   onAmountExtracted={handleOCRExtracted}
+ />
```

### 4. Backend - Configuración Multer

#### `backend/src/middleware/multerConfig.js` (NUEVO)
```javascript
Configuración de multer:
├─ Storage: ./backend/uploads/
├─ Filename: ticket-{timestamp}-{random}.{ext}
├─ Filtro: Solo images/* (jpeg, png, webp)
└─ Límite: 5MB por archivo
```

### 5. Backend - Ruta de Uploads

#### `backend/src/routes/uploads.js` (NUEVO)
```
POST /api/uploads
  ├─ Body: multipart/form-data { file }
  └─ Response: { ok: true, data: { filename, url, mimetype, size } }
```

### 6. Backend - Configuración App

#### `backend/src/app.js` (MODIFICADO)
```diff
+ const path = require('path');
+ const uploadsRouter = require('./routes/uploads');

+ app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
+ app.use('/api/uploads', uploadsRouter);
```

### 7. API - Exportar URL Base

#### `app/services/api.js` (MODIFICADO)
```diff
+ export const API_URL = API_BASE.replace('/api', '');
```

## Flujo de Uso

### Happy Path: Ticket Claro
1. Usuario toca botón 📷 en campo de monto
2. Se abre CaptureTicketModal con cámara
3. Usuario apunta y captura foto del ticket
4. Sistema muestra preview de la foto
5. Usuario toca "Escanear"
6. **Tesseract.js procesa imagen** → Loading overlay
7. OCR encuentra importe → Alert "Detectado: $45.50"
8. Usuario toca "Usar"
9. Campo monto se autocompleta: `$45.50`
10. 📎 Clip aparece al lado del monto
11. Usuario completa resto del formulario
12. Usuario toca "Guardar gasto"
13. **Foto se sube a backend** → guardada en `./backend/uploads/ticket-{id}.jpg`
14. Gasto se crea con referencia: `ticketPhoto: "/uploads/ticket-{id}"`

### Fallback: Ticket Borroso
1. Usuario toca botón 📷
2. Captura foto borrosa
3. Usuario toca "Escanear"
4. **OCR intenta procesar**
5. ❌ No encuentra números válidos
6. Alert: "No se detectó importe. Ingresá manualmente"
7. Usuario cancela modal
8. Usuario ingresa monto manualmente en el campo

### Alternativa: Sin Foto
- Usuario puede omitir la foto y completar el formulario normalmente
- El campo monto se puede llenar manualmente

## Dependencias Agregadas

### Frontend
```json
{
  "tesseract.js": "^5.x",          // OCR
  "expo-camera": "^15.x",          // Cámara nativa
  "expo-image-picker": "^15.x"     // Galería (opcional)
}
```

### Backend
```json
{
  "multer": "^1.4.x"               // File uploads
}
```

## Configuración de Volúmenes Docker

`docker-compose.yml`:
```yaml
backend:
  volumes:
    - ./backend/src:/app/src           # Hot reload código
    - ./backend/data:/app/data         # DB persistence
    - ./backend/uploads:/app/uploads   # Almacenamiento de fotos ← NUEVO
```

## Notas Técnicas

### Tesseract.js
- **Ventaja**: OCR offline, sin API keys
- **Desventaja**: Archivo pesado (~5-8MB), carga lazy en memoria
- **Idioma**: Español (mejor detección de números en tickets AR/ES)
- **Parámetros OCR**:
  - Busca números con 2 decimales (formato moneda)
  - Busca patrones "Total: XXX"
  - Normaliza comas a puntos
  - Valida que importe esté entre 0.01 y 1,000,000

### Multer
- **Almacenamiento**: Disco local en `./backend/uploads/`
- **Acceso**: Via `/uploads/{filename}` en ruta estática
- **Límites**: 5MB por archivo, solo imágenes

### Upload de Archivos
- Usa `FormData` + `fetch` (no JSON)
- `Content-Type: multipart/form-data` (automático en FormData)
- Fallback: Si upload falla, gasto se crea sin foto (no bloquea flujo)

## Testing

### Test Manual: Escanear Ticket Real
1. Abre app en Expo
2. Navega a Agregar Gasto
3. Toca botón 📷
4. Captura foto clara de un ticket de mercado
5. Verifica que importe se extrae correctamente
6. Completa gasto y guarda
7. En backend, verifica: `ls backend/uploads/` → foto guardada

### Test: Foto Borrosa
1. Toca 📷
2. Captura foto muy borrosa/oscura
3. Toca "Escanear"
4. Verifica que alert muestra mensaje de error

### Test: Sin Foto
1. Ingresa importe manualmente sin usar OCR
2. Verifica que gasto se crea igual (sin foto)
3. En `backend/uploads/` no debe haber archivos innecesarios

## Persistencia de Datos

```
./backend/uploads/
├─ ticket-1718900000000-123456789.jpg
├─ ticket-1718900001000-987654321.png
└─ ticket-1718900002000-555666777.webp
```

Rutas de acceso:
- Frontend: `/uploads/ticket-...` (relativa al servidor)
- Backend: `http://localhost:3000/uploads/ticket-...`
- Tunnel: `https://{tunnel-host}.exp.direct/uploads/ticket-...`

## Limitaciones y Futuros

### Limitaciones Actuales
1. **OCR solo en español**: Tesseract detecta mejor números en tickets españoles/argentinos
2. **No soporta tickets en PDF**: Solo imágenes (jpg, png, webp)
3. **Ocr es lento**: Tesseract.js tarda ~2-5s en procesar imagen
4. **Sin validación de comprobante**: No verifica que sea ticket/boleta genuino

### Mejoras Futuras
1. Multi-idioma: Entrenar OCR para otros idiomas
2. PDFs: Integrar PDF.js + OCR
3. Aceleración: Usar modelo optimizado o GPU acceleration
4. Validación: Machine Learning para detectar fraude
5. UI: Mostrar reconocimiento en tiempo real (preview)
6. Almacenamiento: S3/Cloud en lugar de disco local
7. Galería: Permitir seleccionar fotos existentes

## Archivo de Cambios Git

```bash
feat(ocr): Implementar escaneo de tickets con Tesseract.js
  - Agregar servicio OCR con extracción de importes
  - Crear componente CaptureTicketModal con cámara nativa
  - Implementar upload de fotos a backend con multer
  - Agregar botón de escaneo en AgregarGastoScreen
  - Mostrar clip 📎 cuando hay foto adjunta
  - Mantener importe en caso de fallo OCR

feat(backend): Soporte para upload de archivos
  - Crear middleware multer con validación de tipos
  - Agregar ruta POST /api/uploads
  - Servir archivos estáticos en /uploads

fix(api): Exportar API_URL para uso en servicios
