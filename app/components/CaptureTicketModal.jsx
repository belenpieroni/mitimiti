import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { scanTicket } from '../services/ocrService';

export default function CaptureTicketModal({ visible, onClose, onAmountExtracted }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
  }, [visible]);

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          base64: false,
        });
        setCapturedPhoto(photo.uri);
      } catch (error) {
        Alert.alert('Error', 'No se pudo capturar la foto: ' + error.message);
      }
    }
  };

  const processTicket = async () => {
    if (!capturedPhoto) return;

    setIsProcessing(true);
    try {
      const { amount, ticketUrl } = await scanTicket(capturedPhoto);

      if (amount) {
        Alert.alert(
          'Importe detectado',
          `Se extrajo: $${amount.toFixed(2)}`,
          [
            {
              text: 'Cancelar',
              onPress: () => setIsProcessing(false),
              style: 'cancel',
            },
            {
              text: 'Usar',
              onPress: () => {
                onAmountExtracted({ amount, photo: capturedPhoto, ticketUrl });
                handleClose();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'No se detectó importe',
          'El OCR no pudo extraer un número válido del ticket. Por favor, ingresa el importe manualmente.'
        );
        setIsProcessing(false);
      }
    } catch (error) {
      Alert.alert(
        'Error en OCR',
        'Ocurrió un error procesando la imagen. Intenta de nuevo con una foto más clara.'
      );
      console.error(error);
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setCapturedPhoto(null);
    setIsProcessing(false);
    onClose();
  };

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" transparent={true}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No hay permiso de cámara</Text>
          <TouchableOpacity style={styles.btnClose} onPress={handleClose}>
            <Text style={styles.btnCloseText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" transparent={true}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Se requiere permiso de cámara</Text>
          <TouchableOpacity style={styles.btnClose} onPress={requestPermission}>
            <Text style={styles.btnCloseText}>Solicitar permiso</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Escaneando ticket...</Text>
        </View>
      )}

      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Escanear ticket</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {!capturedPhoto ? (
            <ScrollView style={styles.captureContent} showsVerticalScrollIndicator={false}>
              
              <View style={styles.cameraWrapper}>
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing="back"
                />
                <View style={styles.cameraInstructions}>
                  <MaterialCommunityIcons name="camera" size={48} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.instructionText}>
                    Apuntá la cámara al ticket y mantenga firme
                  </Text>
                </View>
              </View>

              
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
              >
                <Text style={styles.captureButtonText}>Capturar</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView style={styles.previewContent} showsVerticalScrollIndicator={false}>
              <Image
                source={{ uri: capturedPhoto }}
                style={styles.previewImage}
              />

              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.btnRetry}
                  onPress={() => setCapturedPhoto(null)}
                >
                  <Text style={styles.btnRetryText}>Nueva foto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnProcessing}
                  onPress={processTicket}
                >
                  <Text style={styles.btnProcessingText}>Escanear</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '90%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  captureContent: {
    paddingBottom: 20,
  },
  previewContent: {
    paddingBottom: 20,
  },
  cameraWrapper: {
    height: 280,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  cameraInstructions: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
  },
  captureButton: {
    backgroundColor: colors.primary,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewImage: {
    height: 280,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  btnRetry: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#999',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnRetryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  btnProcessing: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnProcessingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  errorText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  btnClose: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  btnCloseText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 15,
    fontWeight: '600',
  },
});
