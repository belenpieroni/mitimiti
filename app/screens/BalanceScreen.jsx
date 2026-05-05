import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { obtenerBalance } from '../services/juntadasService';

function formatPesos(monto) {
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}

export default function BalanceScreen({ route, navigation }) {
  const { juntadaId } = route.params;
  const [balance, setBalance] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.titulo}>Balance</Text>
          <Text style={styles.subtitulo}>División equitativa</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Card resumen */}
        <View style={styles.cardResumen}>
          <Text style={styles.resumenLabel}>Total gastado</Text>
          <Text style={styles.resumenMonto}>{formatPesos(balance.totalGastado)}</Text>
          <View style={styles.resumenFila}>
            <View style={styles.resumenItem}>
              <Text style={styles.resumenSubLabel}>Participantes</Text>
              <Text style={styles.resumenSubValor}>{balance.cantidadParticipantes}</Text>
            </View>
            <View style={styles.resumenItem}>
              <Text style={styles.resumenSubLabel}>Le toca a cada uno</Text>
              <Text style={styles.resumenSubValor}>{formatPesos(balance.parteIgualPorPersona)}</Text>
            </View>
          </View>
        </View>

        {/* Saldos individuales */}
        <Text style={styles.seccionTitulo}>SALDOS</Text>
        {balance.saldos.map((s, i) => (
          <View key={i} style={styles.saldoCard}>
            <View style={[styles.saldoAvatar, { backgroundColor: s.color }]}>
              <Text style={styles.saldoAvatarTexto}>{s.iniciales}</Text>
            </View>
            <View style={styles.saldoInfo}>
              <Text style={styles.saldoNombre}>{s.nombre}</Text>
              <Text style={styles.saldoPago}>Pagó {formatPesos(s.pagado)}</Text>
            </View>
            <View style={styles.saldoDerecha}>
              {Math.abs(s.saldo) < 0.01 ? (
                <Text style={styles.saldoEmpate}>Justo</Text>
              ) : s.saldo > 0 ? (
                <>
                  <Text style={styles.saldoPositivo}>+{formatPesos(s.saldo)}</Text>
                  <Text style={styles.saldoEtiqueta}>le deben</Text>
                </>
              ) : (
                <>
                  <Text style={styles.saldoNegativo}>-{formatPesos(s.saldo)}</Text>
                  <Text style={styles.saldoEtiqueta}>debe</Text>
                </>
              )}
            </View>
          </View>
        ))}

        {/* Transferencias para saldar */}
        {balance.transferencias.length > 0 && (
          <>
            <Text style={[styles.seccionTitulo, { marginTop: 24 }]}>PARA SALDAR TODO</Text>
            <Text style={styles.seccionSubtitulo}>
              {balance.transferencias.length} transferencia{balance.transferencias.length > 1 ? 's' : ''} necesaria{balance.transferencias.length > 1 ? 's' : ''}
            </Text>
            {balance.transferencias.map((t, i) => (
              <View key={i} style={styles.transCard}>
                <View style={styles.transNombre}>
                  <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
                  <Text style={styles.transTexto}>
                    <Text style={styles.transNombreResaltado}>{t.de}</Text>
                    {' le paga a '}
                    <Text style={styles.transNombreResaltado}>{t.para}</Text>
                  </Text>
                </View>
                <Text style={styles.transMonto}>{formatPesos(t.monto)}</Text>
              </View>
            ))}
          </>
        )}

        {balance.transferencias.length === 0 && balance.totalGastado > 0 && (
          <View style={styles.saldadoCentrado}>
            <Ionicons name="checkmark-circle" size={36} color={colors.greenGlobal} />
            <Text style={styles.saldadoTexto}>¡Todo está saldado!</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 16, gap: 12,
  },
  btnVolver: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  titulo: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  subtitulo: { fontSize: 12, color: colors.textSecondary },
  content: { padding: 16, paddingBottom: 40 },

  cardResumen: {
    backgroundColor: colors.primary, borderRadius: 20,
    padding: 20, marginBottom: 24,
  },
  resumenLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 },
  resumenMonto: { color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 16 },
  resumenFila: { flexDirection: 'row', gap: 12 },
  resumenItem: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, padding: 12,
  },
  resumenSubLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 },
  resumenSubValor: { color: 'white', fontSize: 15, fontWeight: 'bold' },

  seccionTitulo: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.5, marginBottom: 4,
  },
  seccionSubtitulo: { fontSize: 12, color: colors.textSecondary, marginBottom: 12 },

  saldoCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  saldoAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  saldoAvatarTexto: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  saldoInfo: { flex: 1 },
  saldoNombre: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  saldoPago: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  saldoDerecha: { alignItems: 'flex-end' },
  saldoPositivo: { color: colors.greenGlobal, fontWeight: '700', fontSize: 15 },
  saldoNegativo: { color: colors.redGlobal, fontWeight: '700', fontSize: 15 },
  saldoEmpate: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
  saldoEtiqueta: { fontSize: 11, color: colors.textSecondary },

  transCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  transNombre: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  transTexto: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  transNombreResaltado: { color: colors.textPrimary, fontWeight: '600' },
  transMonto: { fontSize: 15, fontWeight: '700', color: colors.primary },

  saldadoCentrado: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  saldadoTexto: { fontSize: 15, fontWeight: '600', color: colors.greenGlobal },

  errorTexto: { color: colors.textSecondary, textAlign: 'center' },
  btnReintentar: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  btnReintentarTexto: { color: 'white', fontWeight: '600' },
});
