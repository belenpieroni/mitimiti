import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { getGastosVivienda } from '../../services/viviendaService';
import Svg, { Path, G, Circle } from 'react-native-svg';

export const CATEGORIA_META = {
  'Transferencias': { color: '#9DB2BF', icon: 'swap-horizontal' },
  'Comidas y bebidas': { color: '#f97316', icon: 'restaurant' },
  'Transporte': { color: '#38bdf8', icon: 'bus' },
  'Impuestos': { color: '#ec6c6a', icon: 'document-text' },
  'Salud y cuidado personal': { color: '#c084fc', icon: 'medkit' },
  'Supermercado': { color: '#42b271', icon: 'cart' },
  'Suscripciones': { color: '#eab308', icon: 'play-circle' },
  'Hogar': { color: '#526D82', icon: 'home' },
  'Indumentaria': { color: '#ec4899', icon: 'shirt' },
  'Shopping': { color: '#8b5cf6', icon: 'bag-handle' },
  'Otras categorías': { color: '#9ca3af', icon: 'grid' }
};

export default function SalidasPorCategoriaScreen({ navigation }) {
  const [gastos, setGastos] = useState([]);
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    cargarGastos();
  }, []);

  const cargarGastos = async () => {
    try {
      const data = await getGastosVivienda();
      setGastos(data);
    } catch (error) {
      console.error(error);
    }
  };

  const getMonthDate = (offset) => {
    const d = new Date();
    d.setMonth(d.getMonth() - offset);
    return d;
  };

  const currentMonthDate = getMonthDate(monthOffset);
  const currentMonthStr = currentMonthDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  const formattedMonth = currentMonthStr.charAt(0).toUpperCase() + currentMonthStr.slice(1);

  const gastosFiltrados = gastos.filter(g => {
    const gDate = new Date(g.fecha);
    return gDate.getMonth() === currentMonthDate.getMonth() && gDate.getFullYear() === currentMonthDate.getFullYear();
  });

  const categorias = {};
  gastosFiltrados.forEach(g => {
    categorias[g.categoria] = (categorias[g.categoria] || 0) + g.monto;
  });

  const categoriasArray = Object.keys(categorias).map(cat => ({
    nombre: cat,
    monto: categorias[cat]
  })).sort((a,b) => b.monto - a.monto);

  const total = gastosFiltrados.reduce((sum, g) => sum + g.monto, 0);

  const size = 200;
  const strokeWidth = 30;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  let currentAngle = 0;

  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * percent) * radius;
    const y = Math.sin(2 * Math.PI * percent) * radius;
    return [x, y];
  };

  const paths = categoriasArray.map(cat => {
    const percent = total > 0 ? cat.monto / total : 0;
    const [startX, startY] = getCoordinatesForPercent(currentAngle);
    currentAngle += percent;
    const effectivePercent = percent >= 1 ? 0.999 : percent;
    const [endX, endY] = getCoordinatesForPercent(currentAngle);
    const largeArcFlag = effectivePercent > 0.5 ? 1 : 0;
    const pathData = [
      `M ${startX + center} ${startY + center}`, 
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX + center} ${endY + center}`
    ].join(' ');
    
    return {
      d: pathData,
      color: CATEGORIA_META[cat.nombre]?.color || '#ccc',
      key: cat.nombre,
      isFull: percent === 1
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnBack}>
          <Ionicons name="arrow-back" size={24} color={'#fff'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gastos por categoría</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.monthSelector}>
            <TouchableOpacity onPress={() => setMonthOffset(prev => prev + 1)}>
              <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{formattedMonth}</Text>
            <TouchableOpacity 
              onPress={() => setMonthOffset(prev => Math.max(0, prev - 1))}
              disabled={monthOffset === 0}
            >
              <Ionicons name="chevron-forward" size={24} color={monthOffset === 0 ? '#ccc' : colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.chartContainer}>
            <Svg width={size} height={size}>
              {total === 0 ? (
                <Circle cx={center} cy={center} r={radius} stroke="#e0e0e0" strokeWidth={strokeWidth} fill="none" />
              ) : (
                <G rotation="-90" origin={`${center}, ${center}`}>
                  {paths.map(p => (
                    p.isFull ? 
                    <Circle key={p.key} cx={center} cy={center} r={radius} stroke={p.color} strokeWidth={strokeWidth} fill="none" />
                    :
                    <Path
                      key={p.key}
                      d={p.d}
                      stroke={p.color}
                      strokeWidth={strokeWidth}
                      fill="none"
                    />
                  ))}
                </G>
              )}
            </Svg>
            <View style={styles.chartTotalOverlay}>
              <Text style={styles.chartTotalLabel}>Total</Text>
              <Text style={styles.chartTotal}>${total.toLocaleString('es-AR')}</Text>
            </View>
          </View>
          
          {total === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No hay gastos registrados en este mes.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {categoriasArray.map((c, i) => {
                const meta = CATEGORIA_META[c.nombre] || { color: '#ccc', icon: 'pricetag' };
                return (
                  <TouchableOpacity key={i} style={styles.catRow} onPress={() => navigation.navigate('CategoriaDetalle', { categoria: c.nombre })}>
                    <View style={[styles.catIcon, {backgroundColor: meta.color}]}>
                      <Ionicons name={meta.icon} size={20} color="#fff" />
                    </View>
                    <Text style={styles.catName}>{c.nombre}</Text>
                    <Text style={styles.catAmount}>${c.monto.toLocaleString('es-AR')}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
  btnBack: { marginRight: 16 },
  headerTitle: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
  scroll: { flexGrow: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  card: { flex: 1 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 40 },
  monthTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  chartContainer: { width: 200, height: 200, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  chartTotalOverlay: { position: 'absolute', alignItems: 'center' },
  chartTotalLabel: { fontSize: 12, color: colors.textSecondary },
  chartTotal: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  emptyState: { alignItems: 'center', marginTop: 20 },
  emptyStateText: { color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' },
  list: { gap: 16 },
  catRow: { flexDirection: 'row', alignItems: 'center' },
  catIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  catName: { flex: 1, fontSize: 16, color: colors.textPrimary },
  catAmount: { fontSize: 16, fontWeight: 'bold', marginRight: 8, color: colors.textPrimary }
});
