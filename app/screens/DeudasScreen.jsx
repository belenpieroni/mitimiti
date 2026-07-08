import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getIcono = (tipo) => (tipo === 'Vivienda' ? "home-outline" : "balloon-outline");

const formatPesos = (monto) => {
  const valor = Number(monto) || 0;
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function DeudasScreen() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estados inicializados vacíos para consumir del backend
  const [pendientes, setPendientes] = useState([]);
  const [pagosRecientes, setPagosRecientes] = useState([]);

  // Función para obtener datos del backend
  const cargarDeudas = async () => {
    const nombreUsuario = user?.name || user?.nombre;
    if (!nombreUsuario) {
      setPendientes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const url = `${API_BASE}/deudas/consolidado/${encodeURIComponent(nombreUsuario)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || 'No se pudo conectar al servidor');
      }

      setPendientes(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Error al conectar con el backend:', error);
      setPendientes([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarDeudas();
    }, [user])
  );

  const totalAPagar = pendientes.reduce((acc, a) => acc + a.totalAcreedor, 0);
  const totalConceptos = pendientes.reduce((acc, a) => acc + a.conceptos.length, 0);

  const handleConfirmarPago = async (acreedor, concepto) => {
    try {
      const response = await fetch(`${API_BASE}/deudas/pagar/${encodeURIComponent(concepto.id)}`, {
        method: 'PATCH'
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || 'No se pudo confirmar el pago');
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      setPagosRecientes((prev) => [{ ...concepto, fecha: 'Hoy' }, ...prev]);
      setPendientes((prev) =>
        prev
          .map((a) =>
            a.id === acreedor.id
              ? {
                  ...a,
                  conceptos: a.conceptos.filter((c) => c.id !== concepto.id),
                  totalAcreedor: a.totalAcreedor - concepto.monto,
                }
              : a
          )
          .filter((a) => a.conceptos.length > 0)
      );
      setConfirmingId(null);
    } catch (error) {
      console.error('Error al confirmar el pago:', error);
    }
  };

  const handlePagarTodo = async (acreedor) => {
    try {
      for (const concepto of acreedor.conceptos) {
        const response = await fetch(`${API_BASE}/deudas/pagar/${encodeURIComponent(concepto.id)}`, {
          method: 'PATCH'
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data?.error || 'No se pudo pagar todo');
        }
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPagosRecientes((prev) => [
        ...acreedor.conceptos.map((c) => ({ ...c, fecha: 'Hoy' })),
        ...prev
      ]);
      setPendientes((prev) => prev.filter((a) => a.id !== acreedor.id));
    } catch (error) {
      console.error('Error al pagar todo:', error);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.subtitle}>Resumen de tus cuentas pendientes</Text>  
          <Text style={styles.title}>Deudas</Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>TOTAL A PAGAR</Text>
          <Text style={styles.balanceAmount}>${formatPesos(totalAPagar)}</Text>
          <Text style={styles.balanceInfo}>{totalConceptos} deudas pendientes - {pendientes.length} acreedor</Text>
        </View>

        <Text style={styles.sectionHeader}>PENDIENTES</Text>
        {pendientes.map((acreedor) => (
          <View key={acreedor.id} style={styles.acreedorWrapper}>
            <TouchableOpacity style={styles.acreedorHeader} onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setExpandedId(expandedId === acreedor.id ? null : acreedor.id);
            }}>
              <View style={styles.userInfoContainer}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{acreedor.avatar}</Text></View>
                <View style={styles.userText}>
                  <Text style={styles.userName}>{acreedor.nombre}</Text>
                  <Text style={styles.userSub}>{acreedor.conceptos.length} deudas pendientes</Text>
                </View>
              </View>
              <View style={styles.amountInfo}>
                <Text style={styles.totalAmount}>${formatPesos(acreedor.totalAcreedor)}</Text>
                <Ionicons name={expandedId === acreedor.id ? "chevron-up" : "chevron-down"} size={20} color="#666" />
              </View>
            </TouchableOpacity>

            {expandedId === acreedor.id && (
              <View style={styles.expandableContent}>
                {acreedor.conceptos.map((concepto, index) => (
                  <View key={`${acreedor.id}-${concepto.id || 'concept'}-${index}`} style={styles.conceptRow}>
                    <View style={styles.conceptLeft}>
                      <View style={styles.conceptTitleRow}>
                        <Ionicons name={getIcono(concepto.tipo)} size={16} color={colors.primary} style={{marginRight: 8}} />
                        <Text style={styles.conceptTitle}>{concepto.titulo}</Text>
                      </View>
                      <Text style={styles.conceptPath}>{concepto.sub}</Text>
                    </View>
                    <View style={styles.conceptRight}>
                      <Text style={styles.conceptPrice}>${formatPesos(concepto.monto)}</Text>
                      {confirmingId === concepto.id ? (
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          <TouchableOpacity style={styles.btnConfirmar} onPress={() => handleConfirmarPago(acreedor, concepto)}><Text style={styles.btnConfirmarText}>Confirmar</Text></TouchableOpacity>
                          <TouchableOpacity style={styles.btnCancelar} onPress={() => setConfirmingId(null)}><Text style={styles.btnCancelarText}>Cancelar</Text></TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.btnMarcar} onPress={() => setConfirmingId(concepto.id)}><Text style={styles.btnMarcarText}>Marcar pagado</Text></TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={styles.btnPagarTodo} onPress={() => handlePagarTodo(acreedor)}><Text style={styles.btnPagarTodoText}>Pagar todo a {acreedor.nombre} - ${formatPesos(acreedor.totalAcreedor)}</Text></TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <Text style={styles.sectionHeader}>PAGOS RECIENTES</Text>
        {pagosRecientes.map((pago, index) => (
          <View key={`${pago.id || pago.titulo}-${index}`} style={styles.pagoRecienteCard}>
            <View style={styles.checkIconContainer}><Ionicons name="checkmark" size={18} color="#33b849" /></View>
            <View style={styles.pagoInfo}>
              <Text style={styles.pagoTitle}>{pago.titulo}</Text>
              <Text style={styles.pagoSub}>{pago.sub}</Text>
            </View>
            <View style={styles.pagoRight}>
              <Text style={styles.pagoAmount}>${formatPesos(pago.monto)}</Text>
              <View style={styles.pagoDate}><Ionicons name="time-outline" size={12} color="#999" /><Text style={styles.pagoDateText}>{pago.fecha}</Text></View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background},
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, paddingHorizontal: 20, marginTop: 40 },
  header: { marginTop: 30, marginBottom: 20 },
  title: {  fontSize: 28, fontWeight: 'bold', color: colors.textPrimary},
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  balanceCard: { backgroundColor: colors.primary, borderRadius: 24, padding: 25, marginBottom: 30 },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  balanceAmount: { color: 'white', fontSize: 36, fontWeight: 'bold', marginVertical: 5 },
  balanceInfo: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 15 },
  acreedorWrapper: { backgroundColor: 'white', borderRadius: 20, marginBottom: 15, overflow: 'hidden' },
  acreedorHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', justifyContent: 'space-between' },
  userInfoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  userText: { marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  userSub: { fontSize: 12, color: '#666' },
  totalAmount: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  expandableContent: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  conceptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F9F9F9' },
  conceptTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  conceptTitleRow: { flexDirection: 'row', alignItems: 'center' },
  conceptPath: { fontSize: 12, color: '#666', marginTop: 2 },
  conceptRight: { alignItems: 'flex-end' },
  conceptPrice: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  btnMarcar: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'rgba(54, 44, 97, 0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  btnMarcarText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  btnConfirmar: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  btnConfirmarText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  btnCancelar: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'rgba(54, 44, 97, 0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  btnCancelarText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  btnPagarTodo: { backgroundColor: colors.primary, padding: 15, borderRadius: 15, marginTop: 15, alignItems: 'center' },
  btnPagarTodoText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  pagoRecienteCard: { flexDirection: 'row', backgroundColor: 'white', padding: 15, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  checkIconContainer: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(51, 184, 73, 0.15)', justifyContent: 'center', alignItems: 'center' },
  pagoInfo: { flex: 1, marginLeft: 12 },
  pagoTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  pagoSub: { fontSize: 11, color: '#666' },
  pagoRight: { alignItems: 'flex-end' },
  pagoAmount: { fontSize: 14, fontWeight: 'bold', color: '#35af49' },
  pagoDate: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  pagoDateText: { fontSize: 10, color: '#999', marginLeft: 3 }
});