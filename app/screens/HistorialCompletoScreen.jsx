import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  LayoutAnimation
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const formatPesos = (monto) => {
  const valor = Number(monto) || 0;
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatearFechaLarga = (fechaString) => {
  if (!fechaString) return { fecha: '', hora: '' };
  const d = new Date(fechaString);
  if (isNaN(d.getTime())) return { fecha: fechaString, hora: '' };
  
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  
  return {
    fecha: `${dia} de ${mes}`
  };
};

export default function HistorialCompletoScreen({ navigation, route }) {
  const { token } = useAuth();
  const [pagos, setPagos] = useState(route.params?.pagosRecientes || []);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCompId, setExpandedCompId] = useState(null);

  const cargarHistorial = async (showLoading = true) => {
    if (!token) return;
    try {
      if (showLoading) setLoading(true);
      const res = await fetch(`${API_BASE}/deudas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.ok) {
        setPagos(json.data.pagosRecientes || []);
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!route.params?.pagosRecientes) {
      cargarHistorial();
    }
  }, [route.params?.pagosRecientes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargarHistorial(false);
  }, [token]);

  // Agrupar por fecha larga
  const gruposPagos = [];
  pagos.forEach(pago => {
    const { fecha } = formatearFechaLarga(pago.fecha_pago);
    let grupo = gruposPagos.find(g => g.fecha === fecha);
    if (!grupo) {
      grupo = { fecha, pagos: [] };
      gruposPagos.push(grupo);
    }
    grupo.pagos.push(pago);
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Historial Completo</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : pagos.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={48} color="#ccc" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No tienes actividad de pagos ni compensaciones.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          {gruposPagos.map((grupo, gIndex) => (
            <View key={`grupo-${gIndex}`} style={styles.grupoContainer}>
              <Text style={styles.grupoFechaHeader}>{grupo.fecha}</Text>
              
              {grupo.pagos.map((item, pIndex) => {
                const isComp = item.isCompensacion === true;
                const isExpanded = expandedCompId === item.id;
                return (
                  <View 
                    key={`${item.id}-${pIndex}`} 
                    style={[
                      pIndex === grupo.pagos.length - 1 ? null : styles.borderBottom
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={isComp ? 0.7 : 1}
                      style={styles.card}
                      onPress={() => {
                        if (isComp) {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setExpandedCompId(expandedCompId === item.id ? null : item.id);
                        }
                      }}
                    >
                      <View style={[
                        styles.iconContainer, 
                        isComp ? styles.iconCompensacion : styles.iconPago
                      ]}>
                        <Ionicons 
                          name={isComp ? "swap-horizontal" : "checkmark"} 
                          size={18} 
                          color={isComp ? "#666" : "#33b849"} 
                        />
                      </View>
                      
                      <View style={styles.infoContainer}>
                        <Text style={styles.cardTitle}>{item.titulo}</Text>
                        {item.sub ? <Text style={styles.cardSub}>{item.sub}</Text> : null}
                      </View>
                      
                      <View style={styles.amountContainer}>
                        <Text style={[styles.amountText, isComp ? styles.amountComp : styles.amountPago]}>
                          ${formatPesos(item.monto)}
                        </Text>
                        <Text style={styles.typeText}>{isComp ? 'Compensado' : 'Pagado'}</Text>
                      </View>
                    </TouchableOpacity>

                    {isComp && isExpanded && (
                      <View style={styles.desgloseBox}>
                        <Text style={styles.desgloseTitulo}>Desglose de Saldo</Text>
                        <View style={styles.desgloseFila}>
                          <Text style={styles.desgloseLabel}>Gastos a Favor (Te debían):</Text>
                          <Text style={[styles.desgloseValor, { color: '#33b849' }]}>${formatPesos(item.gastosAFavor)}</Text>
                        </View>
                        <View style={styles.desgloseFila}>
                          <Text style={styles.desgloseLabel}>Gastos en Contra (Debías):</Text>
                          <Text style={[styles.desgloseValor, { color: '#e65100' }]}>${formatPesos(item.gastosEnContra)}</Text>
                        </View>
                        <View style={styles.lineaFina} />
                        <View style={styles.desgloseFila}>
                          <Text style={styles.desgloseLabelBold}>Saldo Compensado Neto:</Text>
                          <Text style={styles.desgloseValorBold}>${formatPesos(item.monto)}</Text>
                        </View>
                        {item.monto === 0 && (
                          <View style={styles.compensacionBanner}>
                            <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                            <Text style={styles.compensacionText}>
                              Este saldo quedó en $0 porque tus gastos de ${formatPesos(item.gastosAFavor)} compensaron tu deuda de ${formatPesos(item.gastosEnContra)}.
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF3',
    backgroundColor: '#fff'
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  container: { flex: 1 },
  content: { padding: 16 },
  emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  grupoContainer: {
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  grupoFechaHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    textTransform: 'capitalize',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconPago: {
    backgroundColor: 'rgba(51, 184, 73, 0.12)',
  },
  iconCompensacion: {
    backgroundColor: '#F2F4F6',
  },
  infoContainer: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#777' },
  amountContainer: { alignItems: 'flex-end' },
  amountText: { fontSize: 15, fontWeight: '700' },
  amountPago: { color: '#33b849' },
  amountComp: { color: '#666' },
  typeText: { fontSize: 10, color: '#aaa', marginTop: 2, fontWeight: '500' },
  desgloseBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  desgloseTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  desgloseFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  desgloseLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  desgloseValor: {
    fontSize: 12,
    fontWeight: '600',
  },
  lineaFina: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  desgloseLabelBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  desgloseValorBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  compensacionBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(71, 52, 114, 0.05)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(71, 52, 114, 0.1)',
  },
  compensacionText: {
    fontSize: 11,
    color: colors.primary,
    flex: 1,
    lineHeight: 15,
    fontWeight: '500',
  },
});
