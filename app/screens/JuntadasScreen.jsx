import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { listarJuntadas, subscribeLocalJuntadas } from '../services/juntadasService';
import { useAuth } from '../context/AuthContext';

export const coloresDisponibles = [
  '#473472', '#526D82', '#9DB2BF', '#42b271',
  '#c084fc', '#f97316', '#ec6c6a', '#38bdf8',
];

export function getIniciales(nombre) {
  if (!nombre) return '??';
  const partes = nombre.trim().split(' ');
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}

function formatPesos(monto) {
  if (monto === undefined || monto === null || isNaN(monto)) return '$0';
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}

function AvatarStack({ personas }) {
  const visibles = personas?.slice(0, 4) || [];
  const extras = (personas?.length || 0) - 4;
  return (
    <View style={styles.avatarStack}>
      {visibles.map((p, i) => (
        <View key={i} style={[styles.avatar, { backgroundColor: p.color || colors.textSecondary, marginLeft: i === 0 ? 0 : -8 }]}>
          <Text style={styles.avatarTexto}>{p.iniciales || getIniciales(p.nombre)}</Text>
        </View>
      ))}
      {extras > 0 && (
        <View style={[styles.avatar, { backgroundColor: colors.textSecondary, marginLeft: -8 }]}>
          <Text style={styles.avatarTexto}>+{extras}</Text>
        </View>
      )}
    </View>
  );
}

export default function JuntadasScreen({ navigation }) {
  const { user } = useAuth(); 
  const [juntadas, setJuntadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeLocalJuntadas((list) => {
      setJuntadas(list);
    });
    return unsubscribe;
  }, []);

  const cargarJuntadas = useCallback(async () => {
    const nombreUsuario = user?.name || user?.nombre;
    
    if (!nombreUsuario) {
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);
    try {
      await listarJuntadas(nombreUsuario); 
    } catch (e) {
      console.error("Error cargando juntadas:", e);
      setError('No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => { 
      cargarJuntadas(); 
    }, [cargarJuntadas])
  );

  if (cargando) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.cargandoTexto}>Cargando juntadas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.errorTexto}>{error}</Text>
        <TouchableOpacity style={styles.btnReintentar} onPress={cargarJuntadas}>
          <Text style={styles.btnReintentarTexto}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.subtitulo}>Tus eventos</Text>
          <Text style={styles.titulo}>Juntadas</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.btnUnirme}
            onPress={() => navigation.navigate('JoinViaLink')}
          >
            <Ionicons name="link-outline" size={16} color={colors.primary} />
            <Text style={styles.btnUnirmeTexto}>Unirme</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnNueva}
            onPress={() => navigation.navigate('CrearJuntada')}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text style={styles.btnNuevaTexto}>Nueva</Text>
          </TouchableOpacity>
        </View>
      </View>

      {juntadas.length === 0 ? (
        <View style={styles.centrado}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.vacioPrincipal}>Sin juntadas todavía</Text>
          <Text style={styles.vacioSub}>Tocá "Nueva" para crear la primera</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          {juntadas.map((j) => {
            const totalGastado = j.totalGastado !== undefined 
              ? j.totalGastado 
              : (j.gastos?.reduce((sum, g) => sum + (g.monto || 0), 0) || 0);

            const cantidadParticipantes = j.cantidadParticipantes !== undefined 
              ? j.cantidadParticipantes 
              : (j.participantes?.length || 0);

            const cantidadGastos = j.cantidadGastos !== undefined 
              ? j.cantidadGastos 
              : (j.gastos?.length || 0);

            const tipoDeuda = j.tipo || 'ninguna';
            const montoDeuda = j.deuda || 0;

            return (
              <TouchableOpacity
                key={j.id}
                style={styles.card}
                onPress={() => navigation.navigate('JuntadaDetalle', { juntadaId: j.id })}
              >
                <View style={styles.cardFila}>
                  <View style={styles.iconoContenedor}>
                    <Ionicons name="people-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardNombre}>{j.nombre}</Text>
                    <Text style={styles.cardSub}>
                      {cantidadParticipantes} personas · {cantidadGastos} gastos
                    </Text>
                    <AvatarStack personas={j.participantes} />
                  </View>
                  <View style={styles.cardDerecha}>
                    <Text style={styles.cardMonto}>{formatPesos(totalGastado)}</Text>
                    {tipoDeuda === 'cobrar' && <Text style={styles.teCobrar}>Te deben {formatPesos(montoDeuda)}</Text>}
                    {tipoDeuda === 'pagar'  && <Text style={styles.teDebes}>Debés {formatPesos(montoDeuda)}</Text>}
                    {tipoDeuda === 'ninguna' && <Text style={styles.sinDeuda}>Sin deudas</Text>}
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centrado: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitulo: { fontSize: 13, color: colors.textSecondary },
  titulo: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary },
  btnUnirme: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF4FA',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 4,
    borderWidth: 1, borderColor: '#CAD8E5',
  },
  btnUnirmeTexto: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  btnNueva: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 4,
  },
  btnNuevaTexto: { color: 'white', fontWeight: '600', fontSize: 14 },
  lista: { padding: 16, gap: 10 },
  card: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 14 },
  cardFila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconoContenedor: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center',
  },
  cardInfo: { flex: 1, gap: 3 },
  cardNombre: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textSecondary },
  cardDerecha: { alignItems: 'flex-end', gap: 2 },
  cardMonto: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  teCobrar: { color: colors.greenGlobal, fontSize: 12, fontWeight: '600' },
  teDebes: { color: colors.redGlobal, fontSize: 12, fontWeight: '600' },
  sinDeuda: { color: colors.textSecondary, fontSize: 12 },
  avatarStack: { flexDirection: 'row', marginTop: 4 },
  avatar: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.cardBg,
  },
  avatarTexto: { color: 'white', fontSize: 8, fontWeight: 'bold' },
  cargandoTexto: { color: colors.textSecondary, marginTop: 8 },
  errorTexto: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  btnReintentar: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  btnReintentarTexto: { color: 'white', fontWeight: '600' },
  vacioPrincipal: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  vacioSub: { fontSize: 13, color: colors.textSecondary },
});