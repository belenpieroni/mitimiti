import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../theme/colors';
import { liquidarServicioVivienda } from '../services/viviendaService';
import { scanTicket } from '../services/ocrService';
import CaptureTicketModal from './CaptureTicketModal';

export default function LiquidarServicioModal({ visible, servicio, onClose, onLiquidado }) {
  const [montoDisplay, setMontoDisplay] = useState('');
  const [montoNumerico, setMontoNumerico] = useState(0);
  const [imagenUrl, setImagenUrl] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [showOCR, setShowOCR] = useState(false);

  const handleMontoChange = (text) => {
    const raw = text.replace(/^\$\s*/, '').replace(/\D/g, '');
    setMontoDisplay(raw ? Number(raw).toLocaleString('es-AR') : '');
    setMontoNumerico(Number(raw) || 0);
  };

  const handleOCRResult = ({ amount, ticketUrl }) => {
    if (amount) {
      setMontoDisplay(Math.round(amount).toLocaleString('es-AR'));
      setMontoNumerico(Math.round(amount));
    }
    if (ticketUrl) {
      setImagenUrl(ticketUrl);
    }
    setShowOCR(false);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        
        setCargando(true);
        try {
          const { amount, ticketUrl } = await scanTicket(asset.uri);
          handleOCRResult({ amount, ticketUrl });
          
          if (amount) {
            Alert.alert('✅ Archivo procesado', `Se detectó un monto de $${Math.round(amount).toLocaleString('es-AR')}`);
          } else {
            Alert.alert('Archivo adjunto', 'No se detectó un monto automáticamente. Por favor ingresalo manual.');
            setImagenUrl(ticketUrl || asset.uri);
          }
        } catch (error) {
          console.error('Error OCR archivo:', error);
          Alert.alert('Aviso', 'Se adjuntó el archivo pero no se pudo leer el monto. Podés ingresarlo manualmente.');
          setImagenUrl(asset.uri);
        } finally {
          setCargando(false);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const handleConfirmar = async () => {
    if (montoNumerico <= 0) {
      Alert.alert('Error', 'Ingresá un monto válido mayor a 0.');
      return;
    }

    setCargando(true);
    try {
      await liquidarServicioVivienda(servicio.id, {
        monto: montoNumerico,
        imagenUrl: imagenUrl || null,
      });
      Alert.alert('✅ Liquidado', `"${servicio.nombre}" fue liquidado por $${montoNumerico.toLocaleString('es-AR')}.`);
      handleReset();
      onLiquidado?.();
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo liquidar el servicio.');
    } finally {
      setCargando(false);
    }
  };

  const handleReset = () => {
    setMontoDisplay('');
    setMontoNumerico(0);
    setImagenUrl(null);
    onClose();
  };

  if (!servicio) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleReset}>
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleReset} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Liquidar servicio</Text>
              <TouchableOpacity onPress={handleReset}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Service info */}
              <View style={styles.serviceInfo}>
                <Ionicons name="alert-circle-outline" size={28} color="#E65100" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.serviceName}>{servicio.nombre}</Text>
                  <Text style={styles.serviceDetail}>
                    {servicio.periodicidad} · {(servicio.participantes || []).length} participante(s)
                  </Text>
                </View>
                <View style={styles.badgePendiente}>
                  <Text style={styles.badgePendienteText}>Pendiente</Text>
                </View>
              </View>

              <Text style={styles.label}>MONTO REAL</Text>
              <TextInput
                style={styles.input}
                placeholder="$ 0"
                keyboardType="numeric"
                value={montoDisplay ? `$ ${montoDisplay}` : ''}
                onChangeText={handleMontoChange}
                editable={!cargando}
              />

              <Text style={styles.label}>COMPROBANTE (OPCIONAL)</Text>
              <View style={styles.attachmentRow}>
                <TouchableOpacity
                  style={styles.attachmentBtn}
                  onPress={() => setShowOCR(true)}
                  disabled={cargando}
                >
                  <Ionicons name="camera-outline" size={22} color={colors.primary} />
                  <Text style={styles.attachmentBtnText}>Escanear ticket</Text>
                  <Text style={styles.attachmentBtnSub}>OCR automático</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.attachmentBtn}
                  onPress={handlePickDocument}
                  disabled={cargando}
                >
                  <Ionicons name="document-outline" size={22} color={colors.primary} />
                  <Text style={styles.attachmentBtnText}>Subir archivo</Text>
                  <Text style={styles.attachmentBtnSub}>PDF o imagen</Text>
                </TouchableOpacity>
              </View>

              {imagenUrl && (
                <View style={styles.attachmentPreview}>
                  <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                  <Text style={styles.attachmentPreviewText}>Comprobante adjunto</Text>
                  <TouchableOpacity onPress={() => setImagenUrl(null)}>
                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.btnConfirm, cargando && { opacity: 0.6 }]}
                onPress={handleConfirmar}
                disabled={cargando}
              >
                {cargando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnConfirmText}>Confirmar liquidación</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CaptureTicketModal
        visible={showOCR}
        onClose={() => setShowOCR(false)}
        onAmountExtracted={handleOCRResult}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    padding: 14,
    marginBottom: 20,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  serviceDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgePendiente: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgePendienteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E65100',
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F5F7FA',
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E3E7EC',
    marginBottom: 16,
  },
  attachmentRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  attachmentBtn: {
    flex: 1,
    backgroundColor: '#F6F2FC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCD3EC',
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  attachmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  attachmentBtnSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  attachmentPreviewText: {
    flex: 1,
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  btnConfirm: {
    backgroundColor: '#2E7D32',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  btnConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
