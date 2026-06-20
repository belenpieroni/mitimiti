import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { listarJuntadas, obtenerBalanceGlobal } from '../services/juntadasService';
import { useAuth } from '../navigation/AppNavigator';

const modulos = [
  { id: '1', nombre: 'Juntadas', icono: 'people-outline' },
  { id: '2', nombre: 'Vivienda', icono: 'home-outline' },
  { id: '3', nombre: 'Viajes', icono: 'airplane-outline' },
];

function getSaludo() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatPesos(monto) {
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();

  const nombre = user?.name || 'Usuario';
  const iniciales = user?.iniciales || 'US';

  const [balance, setBalance] = useState({
    total: 0,
    porCobrar: 0,
    porPagar: 0
  });
  const [juntadas, setJuntadas]         = useState([]);
  const [cargando, setCargando]         = useState(true);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      // Llamadas en paralelo
      const [balGlobal, listaJuntadas] = await Promise.all([
        obtenerBalanceGlobal(nombre),
        listarJuntadas(),
      ]);
      setBalance(balGlobal);
      setJuntadas(listaJuntadas.slice(0, 5)); // solo las 5 más recientes en Home
    } catch {
      // Si falla la red, mostramos la pantalla sin datos (offline gracioso)
    } finally {
      setCargando(false);
    }
  }, [nombre]);

  useFocusEffect(
    useCallback(() => { cargarDatos(); }, [cargarDatos])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.saludo}>{getSaludo()}</Text>
          <Text style={styles.nombre}>Hola, {nombre}</Text>
        </View>
        <View style={styles.headerIconos}>
          <TouchableOpacity style={styles.iconoBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Perfil')}
          >
            <Text style={styles.avatarTexto}>{iniciales}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Balance */}
      <View style={styles.cardBalance}>
        <Text style={styles.balanceLabel}>Balance total</Text>
        {cargando ? (
          <ActivityIndicator color="white" style={{ marginVertical: 12 }} />
        ) : (
          <>
            <Text style={styles.balanceTotal}>
              {balance.total < 0 ? '– ' : balance.total > 0 ? '+ ' : ''}
              {formatPesos(balance.total)}
            </Text>
            <View style={styles.balanceFila}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceSubLabel}>Por cobrar</Text>
                <Text style={[styles.balanceValor, { color: colors.greenGlobal }]}>
                  {formatPesos(balance.porCobrar)}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceSubLabel}>Por pagar</Text>
                <Text style={[styles.balanceValor, { color: '#ec6c6a' }]}>
                  {formatPesos(balance.porPagar)}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Módulos */}
      <Text style={styles.seccionTitulo}>Módulos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modulosScroll}>
        {modulos.map((mod) => (
          <View key={mod.id} style={styles.moduloCard}>
            <Ionicons name={mod.icono} size={28} color={colors.primary} />
            <Text style={styles.moduloNombre}>{mod.nombre}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Activos recientemente */}
      <View style={styles.seccionHeader}>
        <Text style={styles.seccionTitulo}>Activos recientemente</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Juntadas')}>
          <Text style={styles.verTodo}>Ver todo &gt;</Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      ) : juntadas.length === 0 ? (
        <View style={styles.vacioCentrado}>
          <Text style={styles.vacioTexto}>Sin juntadas todavía</Text>
        </View>
      ) : (
        juntadas.map((j) => (
          <TouchableOpacity
            key={j.id}
            style={styles.juntadaCard}
            onPress={() => navigation.navigate('Juntadas', { screen: 'JuntadaDetalle', params: { juntadaId: j.id } })}
          >
            <View style={styles.juntadaIcono}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.juntadaInfo}>
              <Text style={styles.juntadaNombre}>{j.nombre}</Text>
              <Text style={styles.juntadaSub}>
                Juntada · {j.cantidadParticipantes} personas · {formatPesos(j.totalGastado)}
              </Text>
            </View>
            <View>
              {j.tipo === 'cobrar' && <Text style={styles.teCobrar}>Te deben {formatPesos(j.deuda)}</Text>}
              {j.tipo === 'pagar'  && <Text style={styles.teDebes}>Debés {formatPesos(j.deuda)}</Text>}
              {j.tipo === 'ninguna'&& <Text style={styles.sinDeuda}>Sin deudas</Text>}
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 56 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  saludo: { fontSize: 13, color: colors.textSecondary },
  nombre: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  headerIconos: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconoBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.cardBg, justifyContent: 'center', alignItems: 'center',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarTexto: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  cardBalance: { backgroundColor: colors.primary, borderRadius: 20, padding: 20, marginBottom: 24 },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 },
  balanceTotal: { color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 16 },
  balanceFila: { flexDirection: 'row', gap: 12 },
  balanceItem: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12,
  },
  balanceSubLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  balanceValor: { fontSize: 16, fontWeight: 'bold' },
  seccionTitulo: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  seccionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12, marginTop: 8,
  },
  verTodo: { color: colors.textSecondary, fontSize: 13 },
  modulosScroll: { marginBottom: 24 },
  moduloCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 16,
    marginRight: 12, alignItems: 'center', width: 110, gap: 8,
  },
  moduloNombre: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  juntadaCard: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  juntadaIcono: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center',
  },
  juntadaInfo: { flex: 1 },
  juntadaNombre: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  juntadaSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  teCobrar: { color: colors.greenGlobal, fontWeight: '600', fontSize: 13 },
  teDebes:  { color: colors.redGlobal,  fontWeight: '600', fontSize: 13 },
  sinDeuda: { color: colors.textSecondary, fontSize: 13 },
  vacioCentrado: { alignItems: 'center', paddingVertical: 24 },
  vacioTexto: { color: colors.textSecondary, fontSize: 13 },
});
