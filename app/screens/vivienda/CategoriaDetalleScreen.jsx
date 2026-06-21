import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { getGastosVivienda } from '../../services/viviendaService';
import { CATEGORIA_META } from './SalidasPorCategoriaScreen';

export default function CategoriaDetalleScreen({ route, navigation }) {
  const { categoria } = route.params;
  const [gastos, setGastos] = useState([]);

  useEffect(() => {
    cargarGastos();
  }, []);

  const cargarGastos = async () => {
    try {
      const data = await getGastosVivienda();
      setGastos(data.filter(g => g.categoria === categoria));
    } catch (error) {
      console.error(error);
    }
  };

  const total = gastos.reduce((sum, g) => sum + g.monto, 0);
  const meta = CATEGORIA_META[categoria] || { color: '#42b271', icon: 'pricetag' };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de categoría</Text>
      </View>
      <View style={styles.topSection}>
        <View style={[styles.catIcon, { backgroundColor: meta.color }]}><Ionicons name={meta.icon} size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.catName}>{categoria}</Text>
          <Text style={styles.catMonth}>Junio 2026</Text>
        </View>
        <Text style={styles.catTotal}>${total.toLocaleString('es-AR')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.countTitle}>{gastos.length} gasto{gastos.length !== 1 ? 's' : ''} en esta categoría</Text>
        <View style={styles.divider} />
        {gastos.map((g, i) => (
          <View key={i} style={styles.gastoRow}>
            <View style={styles.gastoIcon}><Ionicons name="card-outline" size={20} color={colors.textSecondary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.gastoName}>{g.nombre}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.gastoAmount}>- ${g.monto.toLocaleString('es-AR')}</Text>
              <Text style={styles.gastoDate}>
                {new Date(g.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
  btnBack: { marginRight: 16 },
  headerTitle: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
  topSection: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 40, alignItems: 'center' },
  catIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  catMonth: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  catTotal: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  scroll: { flexGrow: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  countTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: '#eee', marginBottom: 16 },
  gastoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  gastoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f4f8', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  gastoName: { fontSize: 16, color: colors.textPrimary },
  gastoAmount: { fontSize: 16, color: colors.textPrimary, fontWeight: '600' },
  gastoDate: { fontSize: 12, color: colors.textSecondary, marginTop: 4 }
});
