import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme/colors';
import { obtenerBalance } from '../services/juntadasService';
import Toast from '../components/Toast';

function formatPesos(monto) {
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}



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
    ...[useCallback(() => { cargarBalance(); }, [cargarBalance])]
  );

  const getGrupoInfo = (nombre) => {
    if (!balance || !balance.saldos) return { iniciales: nombre.slice(0, 2).toUpperCase(), color: colors.primary };
    const grupo = balance.saldos.find(s => s.nombre === nombre);
    return grupo || { iniciales: nombre.slice(0, 2).toUpperCase(), color: colors.primary };
  };

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
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextos}>
          <Text style={styles.titulo}>Balance consolidado</Text>
          <Text style={styles.subtitulo}>{balance.nombreEvento} · {formatPesos(balance.totalGastado)} total</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.seccionTituloPrincipal}>TRANSFERENCIAS PENDIENTES</Text>
        {balance.transferencias.length === 0 ? (
          <View style={styles.saldadoCentrado}>
            <Ionicons name="checkmark-circle" size={32} color={colors.greenGlobal} />
            <Text style={styles.saldadoTexto}>¡Todo está saldado!</Text>
          </View>
        ) : (
          balance.transferencias.map((t, i) => {
            const deInfo = getGrupoInfo(t.de);
            const paraInfo = getGrupoInfo(t.para);

            return (
              <View key={i} style={styles.transCard}>
                <TouchableOpacity 
                  style={styles.transRowArriba}
                  onPress={() => t.aliasDestino ? handleCopiarAlias(t.aliasDestino) : null}
                  activeOpacity={t.aliasDestino ? 0.6 : 1}
                >
                  <View style={[styles.avatarGrande, { backgroundColor: deInfo.color }]}>
                    <Text style={styles.avatarTextoGrande}>{deInfo.iniciales}</Text>
                  </View>

                  <View style={styles.transData}>
                    <View style={styles.transNombresRow}>
                      <Text style={styles.transNombreSecundario}>{t.de}</Text>
                      <Ionicons name="arrow-forward" size={14} color={colors.light} />
                      <Text style={styles.transNombreSecundario}>{t.para}</Text>
                    </View>
                    
                    <Text style={styles.transMontoGrande}>{formatPesos(t.monto)}</Text>
                    
                    {t.aliasDestino ? (
                      <View style={styles.aliasPill}>
                        <Ionicons name="copy-outline" size={14} color={colors.primary} />
                        <Text style={styles.aliasPillTexto}>Copiar CBU/Alias</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.avatarGrande, { backgroundColor: paraInfo.color }]}>
                    <Text style={styles.avatarTextoGrande}>{paraInfo.iniciales}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.btnMarcarPagado}
                  onPress={() => mostrarToast('Funcionalidad de pagos en desarrollo', 'success')}
                >
                  <Ionicons name="checkmark" size={16} color={colors.greenGlobal} style={{ marginTop: 2 }} />
                  <Text style={styles.btnMarcarPagadoTexto}>Marcar como pagado</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Text style={[styles.seccionTituloPrincipal, { marginTop: 32 }]}>RESUMEN POR FAMILIA / GRUPO</Text>
        <View style={styles.listaSaldos}>
          {balance.saldos.map((s, i) => (
            <View key={i} style={[styles.saldoFilaFigma, i === balance.saldos.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.saldoFigmaIzq}>
                <View style={[styles.avatarChico, { backgroundColor: s.color || colors.primary }]}>
                  <Text style={styles.avatarTexto}>{s.iniciales || s.nombre.slice(0,2).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.saldoNombreFigma}>{s.nombre}</Text>
                  {s.alias ? (
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }} 
                      onPress={async () => {
                        await Clipboard.setStringAsync(s.alias);
                        mostrarToast('Alias copiado', 'success');
                      }}
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{s.alias}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <Text style={[
                styles.saldoMontoFigma, 
                { color: s.saldo > 0 ? colors.greenGlobal : s.saldo < 0 ? colors.redGlobal : colors.textPrimary }
              ]}>
                {s.saldo > 0 ? 'A favor: ' : s.saldo < 0 ? 'Debe: ' : ''} {formatPesos(s.saldo)}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.acordeonHeader} 
          onPress={() => setMostrarDetalle(!mostrarDetalle)}
        >
          <Text style={styles.acordeonTitulo}>VER DETALLE DE CÁLCULOS</Text>
          <Ionicons name={mostrarDetalle ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
        </TouchableOpacity>

        {mostrarDetalle && (
          <View style={styles.cardDetalle}>
            <Text style={styles.detalleSubtitulo}>Historial de lo comprado</Text>
            {balance.gastosDetallados?.map((g, i) => (
              <View key={i} style={styles.filaCalculo}>
                <Text style={styles.calcLabel}>{g.categoria || g.nombre}</Text>
                <Text style={styles.calcValor}>{formatPesos(g.monto)}</Text>
              </View>
            ))}
            <View style={styles.linea} />
            <View style={styles.filaCalculo}>
              <Text style={styles.calcTotalLabel}>Total Gastado</Text>
              <Text style={styles.calcTotalValor}>{formatPesos(balance.totalGastado)}</Text>
            </View>

            <Text style={styles.detalleSubtitulo}>Criterio de división</Text>
            <View style={styles.filaCalculo}>
              <Text style={styles.calcLabel}>Basado en consumo real individual por artículo, consolidado por grupo familiar.</Text>
            </View>

            <Text style={styles.detalleSubtitulo}>Total aportado por cada grupo</Text>
            {balance.saldos.map((s, i) => (
              <View key={i} style={styles.filaCalculo}>
                <Text style={styles.calcLabel}>{s.nombre}</Text>
                <Text style={styles.calcValor}>{formatPesos(s.pagado)}</Text>
              </View>
            ))}

            <Text style={styles.detalleSubtitulo}>Desglose final de saldos</Text>
            <Text style={styles.formula}>Balance = Total Aportado − Consumo Total del Grupo</Text>
            
            {balance.saldos.map((s, i) => {
              const consumidoGrupo = s.consumido !== undefined ? s.consumido : (s.pagado - s.saldo);
              return (
                <View key={i} style={styles.filaExplicacion}>
                  <View style={[styles.avatarExtraChico, { backgroundColor: s.color || colors.primary }]}>
                    <Text style={styles.avatarTextoExtraChico}>{s.iniciales || s.nombre.slice(0,2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.explicacionTextos}>
                    <Text style={styles.explicacionNombre}>{s.nombre}</Text>
                    <Text style={styles.explicacionCalculo}>
                      Aportó {formatPesos(s.pagado)} — Consumió {formatPesos(consumidoGrupo)}
                    </Text>
                  </View>
                  <Text style={[styles.explicacionMonto, { color: s.saldo >= 0 ? colors.greenGlobal : colors.redGlobal }]}>
                    {s.saldo >= 0 ? '+' : '−'}{formatPesos(s.saldo)}
                  </Text>
                </View>
              );
            })}
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
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, gap: 16,
  },
  btnVolver: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(82, 109, 130, 0.15)',
  },
  headerTextos: { flex: 1 },
  titulo: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  subtitulo: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  
  content: { padding: 20, paddingBottom: 40 },
  seccionTituloPrincipal: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase'
  },

  transCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(82, 109, 130, 0.12)',
  },
  transRowArriba: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  transData: { flex: 1, marginLeft: 16, marginRight: 16 },
  transNombresRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  transNombreSecundario: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  transMontoGrande: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 6 },
  aliasPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(71, 52, 114, 0.08)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8, gap: 6,
  },
  aliasPillTexto: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  avatarGrande: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarTextoGrande: { color: 'white', fontSize: 14, fontWeight: '700' },
  
  btnMarcarPagado: {
    marginTop: 20, backgroundColor: '#E8F4EF', borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  btnMarcarPagadoTexto: { color: colors.greenGlobal, fontWeight: '700', fontSize: 14 },

  listaSaldos: { marginBottom: 16 },
  saldoFilaFigma: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(157, 178, 191, 0.25)',
  },
  saldoFigmaIzq: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarChico: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarTexto: { color: 'white', fontSize: 12, fontWeight: '700' },
  saldoNombreFigma: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  saldoMontoFigma: { fontSize: 15, fontWeight: '700' },

  acordeonHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 20, gap: 8, marginTop: 16 },
  acordeonTitulo: { fontSize: 13, fontWeight: '700', color: colors.primary },
  
  cardDetalle: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#eee' },
  detalleSubtitulo: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 18, marginBottom: 10 },
  filaCalculo: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  calcLabel: { fontSize: 13, color: colors.textSecondary, flex: 1, paddingRight: 8 },
  calcValor: { fontSize: 13, color: colors.textPrimary },
  calcValorResaltado: { fontSize: 13, fontWeight: '700', color: colors.primary },
  calcTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  calcTotalValor: { fontSize: 14, fontWeight: '700', color: colors.primary },
  linea: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  formula: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 12 },

  filaExplicacion: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  avatarExtraChico: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarTextoExtraChico: { color: 'white', fontSize: 8, fontWeight: '700' },
  explicacionTextos: { flex: 1, marginLeft: 10 },
  explicacionNombre: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  explicacionCalculo: { fontSize: 11, color: colors.textSecondary },
  explicacionMonto: { fontSize: 13, fontWeight: '700' },

  saldadoCentrado: { alignItems: 'center', padding: 20 },
  saldadoTexto: { color: colors.greenGlobal, fontWeight: '700', marginTop: 8 },
  errorTexto: { color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  btnReintentar: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnReintentarTexto: { color: 'white', fontWeight: '700' },
});