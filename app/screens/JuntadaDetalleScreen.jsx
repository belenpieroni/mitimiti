import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { juntadasData } from './JuntadasScreen';

function formatPesos(monto) {
  return '$' + Math.abs(monto).toLocaleString('es-AR');
}

const iconosGasto = ['basket-outline', 'wine-outline', 'flame-outline', 'cart-outline', 'restaurant-outline'];
const coloresIcono = ['#c084fc', '#526D82', '#42b271', colors.primary, '#f97316'];

export default function JuntadaDetalleScreen({ route, navigation }) {
  const { juntadaId } = route.params;
  const juntada = juntadasData.find(j => j.id === juntadaId);
  const totalGastado = juntada.gastos.reduce((a, g) => a + g.monto, 0);

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitulo}>{juntada.nombre}</Text>
          <Text style={styles.headerSub}>{juntada.personas.length} participantes · {juntada.fecha}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Card total */}
        <View style={styles.cardTotal}>
          <Text style={styles.cardTotalLabel}>Total gastado</Text>
          <Text style={styles.cardTotalMonto}>{formatPesos(totalGastado)}</Text>
          <View style={styles.avatarStack}>
            {juntada.personas.map((p, i) => (
              <View key={i} style={[styles.avatar, { backgroundColor: p.color, marginLeft: i === 0 ? 0 : -8 }]}>
                <Text style={styles.avatarTexto}>{p.iniciales}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Gastos */}
        <View style={styles.gastosHeader}>
          <Text style={styles.gastosLabel}>GASTOS · {juntada.gastos.length}</Text>
          <TouchableOpacity>
            <Text style={styles.btnAgregar}>+ Agregar</Text>
          </TouchableOpacity>
        </View>

        {juntada.gastos.map((g, i) => (
          <View key={g.id} style={styles.gastoCard}>
            <View style={[styles.gastoIcono, { backgroundColor: coloresIcono[i % coloresIcono.length] + '22' }]}>
              <Ionicons name={iconosGasto[i % iconosGasto.length]} size={20} color={coloresIcono[i % coloresIcono.length]} />
            </View>
            <View style={styles.gastoInfo}>
              <Text style={styles.gastoNombre}>{g.nombre}</Text>
              <Text style={styles.gastoPagador}>Pagó {g.pagador}</Text>
            </View>
            <Text style={styles.gastoMonto}>{formatPesos(g.monto)}</Text>
            <TouchableOpacity style={styles.btnEliminar}>
              <Ionicons name="trash-outline" size={18} color={colors.redGlobal} />
            </TouchableOpacity>
          </View>
        ))}

      </ScrollView>

      {/* Botón Ver balance */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.btnBalance}
          onPress={() => navigation.navigate('Balance', { juntadaId })}
        >
          <Text style={styles.btnBalanceTexto}>Ver balance</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    gap: 10,
  },
  btnVolver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  cardTotal: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  cardTotalLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 8,
  },
  cardTotalMonto: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarTexto: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gastosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gastosLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  btnAgregar: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  gastoCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gastoIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gastoInfo: {
    flex: 1,
  },
  gastoNombre: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  gastoPagador: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  gastoMonto: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  btnEliminar: {
    padding: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.background,
  },
  btnBalance: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  btnBalanceTexto: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});