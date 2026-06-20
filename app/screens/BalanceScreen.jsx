import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme/colors';
import { obtenerBalance } from '../services/juntadasService';

function formatPesos(monto) {
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}

// Custom Toast Component
const Toast = ({ visible, message, type }) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 50,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const bgColor = type === 'error' ? colors.redGlobal : colors.greenGlobal;
  const icon = type === 'error' ? 'alert-circle' : 'checkmark-circle';

  return (
    <Animated.View style={[styles.toastContainer, { transform: [{ translateY }], backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={20} color="white" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default function BalanceScreen({ route, navigation }) {
  const { juntadaId } = route.params;
  const [balance, setBalance] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const mostrarToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const handleCopiarAlias = async (alias) => {
    await Clipboard.setStringAsync(alias);
    mostrarToast('¡Alias/CBU copiado al portapapeles!');
  };

  const cargarBalance = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerBalance(juntadaId);
      setBalance(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [juntadaId]);

  useFocusEffect(
    useCallback(() => { cargarBalance(); }, [cargarBalance])
  );

  if (cargando) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !balance) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.errorTexto}>{error || 'No se pudo cargar el balance'}</Text>
        <TouchableOpacity style={styles.btnReintentar} onPress={cargarBalance}>
          <Text style={styles.btnReintentarTexto}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.titulo}>Balance</Text>
          <Text style={styles.subtitulo}>{balance.nombreEvento || 'Resumen de gastos'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Transferencias Necesarias */}
        <Text style={styles.seccionTituloPrincipal}>TRANSFERENCIAS NECESARIAS</Text>
        {balance.transferencias.length === 0 ? (
          <View style={styles.saldadoCentrado}>
            <Ionicons name="checkmark-circle" size={32} color={colors.greenGlobal} />
            <Text style={styles.saldadoTexto}>¡Todo está saldado!</Text>
          </View>
        ) : (
          balance.transferencias.map((t, i) => (
            <TouchableOpacity 
              key={i} 
              style={styles.transCard}
              onPress={() => t.aliasDestino && handleCopiarAlias(t.aliasDestino)}
              disabled={!t.aliasDestino}
              activeOpacity={0.7}
            >
              <View style={styles.transNombreContainer}>
                <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.transTexto}>
                    <Text style={styles.transNombreResaltado}>{t.de}</Text>
                    {' le paga a '}
                    <Text style={styles.transNombreResaltado}>{t.para}</Text>
                  </Text>
                  {t.aliasDestino ? (
                    <View style={styles.aliasContainer}>
                      <Text style={styles.aliasTexto}>Alias/CBU: {t.aliasDestino}</Text>
                      <Ionicons name="copy-outline" size={14} color={colors.textSecondary} style={{ marginLeft: 4, marginTop: 2 }} />
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.transMonto}>{formatPesos(t.monto)}</Text>
            </TouchableOpacity>
          ))
        )}

        {/* Resumen Individual */}
        <Text style={[styles.seccionTituloPrincipal, { marginTop: 24 }]}>RESUMEN INDIVIDUAL</Text>
        <View style={styles.listaSaldos}>
          {balance.saldos.map((s, i) => (
            <View key={i} style={styles.saldoFila}>
              <View style={[styles.avatarChico, { backgroundColor: s.color || colors.primary }]}>
                <Text style={styles.avatarTexto}>{s.iniciales}</Text>
              </View>
              <Text style={styles.saldoNombre}>{s.nombre}</Text>
              <Text style={[
                styles.saldoMonto, 
                { color: s.saldo >= 0 ? colors.greenGlobal : colors.redGlobal }
              ]}>
                {s.saldo >= 0 ? '+' : '−'} {formatPesos(s.saldo)}
              </Text>
            </View>
          ))}
        </View>

        {/* Desplegable de Cálculos */}
        <TouchableOpacity 
          style={styles.acordeonHeader} 
          onPress={() => setMostrarDetalle(!mostrarDetalle)}
        >
          <Text style={styles.acordeonTitulo}>VER DETALLE DE CÁLCULOS</Text>
          <Ionicons name={mostrarDetalle ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
        </TouchableOpacity>

        {mostrarDetalle && (
          <View style={styles.cardDetalle}>
            <Text style={styles.detalleSubtitulo}>Total gastado</Text>
            {balance.gastosDetallados?.map((g, i) => (
              <View key={i} style={styles.filaCalculo}>
                <Text style={styles.calcLabel}>{g.categoria || g.nombre}</Text>
                <Text style={styles.calcValor}>{formatPesos(g.monto)}</Text>
              </View>
            ))}
            <View style={styles.linea} />
            <View style={styles.filaCalculo}>
              <Text style={styles.calcTotalLabel}>Total</Text>
              <Text style={styles.calcTotalValor}>{formatPesos(balance.totalGastado)}</Text>
            </View>

            <Text style={styles.detalleSubtitulo}>División de gastos</Text>
            <View style={styles.filaCalculo}>
              <Text style={styles.calcLabel}>{formatPesos(balance.totalGastado)} ÷ {balance.cantidadParticipantes} personas</Text>
              <Text style={styles.calcValorResaltado}>{formatPesos(balance.parteIgualPorPersona)} c/u</Text>
            </View>

            <Text style={styles.detalleSubtitulo}>Cuánto puso cada uno</Text>
            {balance.saldos.map((s, i) => (
              <View key={i} style={styles.filaCalculo}>
                <Text style={styles.calcLabel}>{s.nombre}</Text>
                <Text style={styles.calcValor}>{formatPesos(s.pagado)}</Text>
              </View>
            ))}

            <Text style={styles.detalleSubtitulo}>Por qué cada uno debe lo que debe</Text>
            <Text style={styles.formula}>Balance = lo que pagó − lo que le corresponde ({formatPesos(balance.parteIgualPorPersona)})</Text>
            
            {balance.saldos.map((s, i) => (
              <View key={i} style={styles.filaExplicacion}>
                <View style={[styles.avatarExtraChico, { backgroundColor: s.color || colors.primary }]}>
                  <Text style={styles.avatarTextoExtraChico}>{s.iniciales}</Text>
                </View>
                <View style={styles.explicacionTextos}>
                  <Text style={styles.explicacionNombre}>{s.nombre}</Text>
                  <Text style={styles.explicacionCalculo}>
                    {formatPesos(s.pagado)} - {formatPesos(balance.parteIgualPorPersona)}
                  </Text>
                </View>
                <Text style={[styles.explicacionMonto, { color: s.saldo >= 0 ? colors.greenGlobal : colors.redGlobal }]}>
                  {s.saldo >= 0 ? '+' : '−'}{formatPesos(s.saldo)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toastContainer: {
    position: 'absolute', top: 0, left: 20, right: 20, zIndex: 1000,
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, gap: 8,
  },
  toastText: { color: 'white', fontWeight: 'bold', fontSize: 14, flex: 1 },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, gap: 12,
  },
  btnVolver: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  titulo: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  subtitulo: { fontSize: 13, color: colors.textSecondary },
  content: { padding: 16, paddingBottom: 40 },

  seccionTituloPrincipal: {
    fontSize: 12, fontWeight: 'bold', color: colors.textSecondary,
    letterSpacing: 0.8, marginBottom: 12, marginLeft: 4
  },

  transCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 16,
    marginBottom: 8, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', elevation: 1
  },
  transNombreContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  transTexto: { fontSize: 13, color: colors.textSecondary },
  transNombreResaltado: { color: colors.textPrimary, fontWeight: 'bold' },
  aliasContainer: { flexDirection: 'row', alignItems: 'center' },
  aliasTexto: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  transMonto: { fontSize: 16, fontWeight: 'bold', color: colors.primary },

  listaSaldos: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 5 },
  saldoFila: { 
    flexDirection: 'row', alignItems: 'center', padding: 14, 
  },
  avatarChico: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarTexto: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  saldoNombre: { flex: 1, marginLeft: 12, fontSize: 15, color: colors.textPrimary },
  saldoMonto: { fontSize: 15, fontWeight: 'bold' },

  acordeonHeader: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    padding: 20, gap: 8, marginTop: 16
  },
  acordeonTitulo: { fontSize: 13, fontWeight: 'bold', color: colors.primary },
  
  cardDetalle: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#eee'
  },
  detalleSubtitulo: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginTop: 18, marginBottom: 10 },
  filaCalculo: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  calcLabel: { fontSize: 13, color: colors.textSecondary },
  calcValor: { fontSize: 13, color: colors.textPrimary },
  calcValorResaltado: { fontSize: 13, fontWeight: 'bold', color: colors.primary },
  calcTotalLabel: { fontSize: 14, fontWeight: 'bold', color: colors.textPrimary },
  calcTotalValor: { fontSize: 14, fontWeight: 'bold', color: colors.primary },
  linea: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  formula: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 12 },

  filaExplicacion: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  avatarExtraChico: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarTextoExtraChico: { color: 'white', fontSize: 8, fontWeight: 'bold' },
  explicacionTextos: { flex: 1, marginLeft: 10 },
  explicacionNombre: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  explicacionCalculo: { fontSize: 11, color: colors.textSecondary },
  explicacionMonto: { fontSize: 13, fontWeight: 'bold' },

  saldadoCentrado: { alignItems: 'center', padding: 20 },
  saldadoTexto: { color: colors.greenGlobal, fontWeight: 'bold', marginTop: 8 },
  errorTexto: { color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  btnReintentar: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnReintentarTexto: { color: 'white', fontWeight: 'bold' },
});