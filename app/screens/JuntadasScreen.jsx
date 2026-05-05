import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const coloresDisponibles = [
  '#473472', '#526D82', '#9DB2BF', '#42b271',
  '#c084fc', '#f97316', '#ec6c6a', '#38bdf8'
];

const juntadasIniciales = [
  {
    id: '1',
    nombre: 'Asado del sábado',
    descripcion: '',
    fecha: '28 abr 2026',
    personas: [
      { nombre: 'Martín', iniciales: 'MR', color: colors.primary },
      { nombre: 'Jorge', iniciales: 'JL', color: '#526D82' },
      { nombre: 'Sofía', iniciales: 'SO', color: '#9DB2BF' },
      { nombre: 'Alan', iniciales: 'AL', color: '#42b271' },
    ],
    gastos: [
      { id: 'g1', nombre: 'Carne y verduras', pagador: 'Martín', monto: 7200 },
      { id: 'g2', nombre: 'Bebidas', pagador: 'Jorge', monto: 3400 },
      { id: 'g3', nombre: 'Carbón y leña', pagador: 'Sofía', monto: 1900 },
    ],
    deuda: 4075,
    tipo: 'cobrar',
  },
  {
    id: '2',
    nombre: 'Viaje Bariloche',
    descripcion: '',
    fecha: '15 mar 2026',
    personas: [
      { nombre: 'Martín', iniciales: 'MR', color: colors.primary },
      { nombre: 'Jorge', iniciales: 'JL', color: '#526D82' },
      { nombre: 'Sofía', iniciales: 'SO', color: '#9DB2BF' },
      { nombre: 'Alan', iniciales: 'AL', color: '#42b271' },
      { nombre: 'Laura', iniciales: 'LU', color: '#c084fc' },
      { nombre: 'Camila', iniciales: 'CA', color: '#f97316' },
    ],
    gastos: [],
    deuda: 0,
    tipo: 'ninguna',
  },
  {
    id: '3',
    nombre: 'Cumple Lau',
    descripcion: '',
    fecha: '10 abr 2026',
    personas: [
      { nombre: 'Martín', iniciales: 'MR', color: colors.primary },
      { nombre: 'Sofía', iniciales: 'SO', color: '#9DB2BF' },
      { nombre: 'Laura', iniciales: 'LU', color: '#c084fc' },
      { nombre: 'Camila', iniciales: 'CA', color: '#f97316' },
    ],
    gastos: [],
    deuda: 0,
    tipo: 'ninguna',
  },
];

function getIniciales(nombre) {
  const partes = nombre.trim().split(' ');
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}

function formatPesos(monto) {
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}

function AvatarStack({ personas }) {
  const visibles = personas.slice(0, 4);
  const extras = personas.length - 4;
  return (
    <View style={styles.avatarStack}>
      {visibles.map((p, i) => (
        <View key={i} style={[styles.avatar, { backgroundColor: p.color, marginLeft: i === 0 ? 0 : -8 }]}>
          <Text style={styles.avatarTexto}>{p.iniciales}</Text>
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

// Estado global simple compartido entre pantallas
export let juntadasData = [...juntadasIniciales];
export function agregarJuntada(nueva) {
  juntadasData = [nueva, ...juntadasData];
}

export { getIniciales, coloresDisponibles };

export default function JuntadasScreen({ navigation }) {
  const [juntadas, setJuntadas] = useState(juntadasIniciales);

  // Actualiza la lista cuando vuelve de CrearJuntada
  navigation.addListener('focus', () => {
    setJuntadas([...juntadasData]);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.subtitulo}>Tus eventos</Text>
          <Text style={styles.titulo}>Juntadas</Text>
        </View>
        <TouchableOpacity
          style={styles.btnNueva}
          onPress={() => navigation.navigate('CrearJuntada')}
        >
          <Ionicons name="add" size={16} color="white" />
          <Text style={styles.btnNuevaTexto}>Nueva</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.lista}>
        {juntadas.map((j) => (
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
                  {j.personas.length} personas · {j.gastos.length} gastos
                </Text>
                <AvatarStack personas={j.personas} />
              </View>
              <View style={styles.cardDerecha}>
                <Text style={styles.cardMonto}>
                  {j.gastos.length > 0 ? formatPesos(j.gastos.reduce((a, g) => a + g.monto, 0)) : '$0'}
                </Text>
                {j.tipo === 'cobrar' && <Text style={styles.teCobrar}>Te deben {formatPesos(j.deuda)}</Text>}
                {j.tipo === 'pagar' && <Text style={styles.teDebes}>Debés {formatPesos(j.deuda)}</Text>}
                {j.tipo === 'ninguna' && <Text style={styles.sinDeuda}>Sin deudas</Text>}
              </View>
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  subtitulo: { fontSize: 13, color: colors.textSecondary },
  titulo: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary },
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
});