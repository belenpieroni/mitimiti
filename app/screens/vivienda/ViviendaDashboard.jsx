import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { getGastosVivienda, getServiciosVivienda } from '../../services/viviendaService';
import { useFocusEffect } from '@react-navigation/native';

// Colores para Avatares
const coloresDisponibles = [
  '#473472', '#526D82', '#9DB2BF', '#42b271',
  '#c084fc', '#f97316', '#ec6c6a', '#38bdf8',
];

function getIniciales(nombre) {
  const partes = nombre.trim().split(' ');
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}

function getColorByNombre(nombre) {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return coloresDisponibles[Math.abs(hash) % coloresDisponibles.length];
}

function AvatarStack({ personas = [] }) {
  const visibles = personas.slice(0, 4);
  const extras = personas.length - 4;
  return (
    <View style={styles.avatarStack}>
      {visibles.map((p, i) => (
        <View key={i} style={[styles.avatar, { backgroundColor: getColorByNombre(p), marginLeft: i === 0 ? 0 : -8 }]}>
          <Text style={styles.avatarTexto}>{getIniciales(p)}</Text>
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

const ICONS_MAP = {
  'Netflix': 'tv-outline',
  'Spotify': 'musical-notes-outline',
  'Factura de Luz': 'flash-outline',
  'Internet / Fibra': 'wifi-outline',
  'Agua': 'water-outline'
};

export default function ViviendaDashboard({ navigation }) {
  const [gastos, setGastos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      cargarData();
    }, [])
  );

  const cargarData = async () => {
    try {
      const gastosData = await getGastosVivienda();
      const serviciosData = await getServiciosVivienda();
      setGastos(gastosData);
      setServicios(serviciosData);
    } catch (error) {
      console.error(error);
    }
  };

  const totalMes = gastos.reduce((sum, g) => sum + g.monto, 0);

  const renderDiasParaVencer = (isoDate) => {
    const diff = new Date(isoDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Vencido';
    if (days === 0) return 'Vence hoy';
    return `Vence en ${days} días`;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>Casa compartida</Text>
        <View style={styles.headerRow}>
          <Text style={styles.mainTitle}>Vivienda</Text>
          <TouchableOpacity style={styles.btnGasto} onPress={() => navigation.navigate('AgregarVivienda')}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.btnGastoText}>Gasto</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.totalCard} onPress={() => navigation.navigate('SalidasPorCategoria')}>
          <Text style={styles.totalLabel}>Total del mes</Text>
          <Text style={styles.totalAmount}>${totalMes.toLocaleString('es-AR')}</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Tu parte pendiente</Text>
              <Text style={styles.badgeValue}>$0</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Ya pagado</Text>
              <Text style={[styles.badgeValue, {color: colors.greenGlobal}]}>$0</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>SERVICIOS PERIÓDICOS</Text>

        {servicios.map(srv => {
          const isUrgente = new Date(srv.proximoVencimiento) - new Date() <= 5 * 24 * 60 * 60 * 1000;
          const iconName = ICONS_MAP[srv.nombre] || 'receipt-outline';
          const tuParte = srv.monto / (srv.participantes?.length || 1);
          
          return (
            <TouchableOpacity key={srv.id} style={styles.servicioCard} onPress={() => setServicioSeleccionado(srv)}>
              <View style={[styles.servicioIcon, isUrgente ? {} : {backgroundColor: '#F0F4F8'}]}>
                <Ionicons name={iconName} size={24} color={isUrgente ? colors.redGlobal : colors.textSecondary} />
              </View>
              <View style={styles.servicioInfo}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4}}>
                  <Text style={[styles.servicioName, {flexShrink: 1}]} numberOfLines={1}>{srv.nombre}</Text>
                  <View style={styles.badgePeriodo}>
                    <Ionicons name="sync" size={10} color={colors.primary} />
                    <Text style={styles.badgePeriodoText}>{srv.periodicidad}</Text>
                  </View>
                </View>
                <Text style={[styles.servicioDate, isUrgente && {color: colors.redGlobal}]}>
                  {renderDiasParaVencer(srv.proximoVencimiento)}
                </Text>
                <Text style={styles.servicioTuParte}>Tu parte: ${tuParte.toLocaleString('es-AR')}</Text>
                <View style={{marginTop: 6}}>
                  <AvatarStack personas={srv.participantes || []} />
                </View>
              </View>
              <View style={styles.servicioRight}>
                <Text style={styles.servicioAmount}>${srv.monto.toLocaleString('es-AR')}</Text>
                {isUrgente && <View style={styles.badgeUrgente}><Text style={styles.badgeUrgenteText}>Urgente</Text></View>}
                {!isUrgente && <View style={styles.badgeAlDia}><Text style={styles.badgeAlDiaText}>Al día</Text></View>}
                <TouchableOpacity style={styles.btnTick}>
                  <Ionicons name="checkmark" size={20} color={colors.greenGlobal} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Modal Detalles Servicio */}
      <Modal visible={!!servicioSeleccionado} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setServicioSeleccionado(null)} />
          {servicioSeleccionado && (
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => {
                  const srv = servicioSeleccionado;
                  setServicioSeleccionado(null);
                  navigation.navigate('AgregarVivienda', { editMode: true, data: srv }); 
                }}>
                  <Ionicons name="create-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setServicioSeleccionado(null)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <View style={[styles.servicioIcon, {width: 64, height: 64, borderRadius: 20, marginBottom: 16, backgroundColor: '#F0F4F8'}]}>
                  <Ionicons name={ICONS_MAP[servicioSeleccionado.nombre] || 'receipt-outline'} size={32} color={colors.textSecondary} />
                </View>
                <Text style={[styles.servicioName, {fontSize: 22}]}>{servicioSeleccionado.nombre}</Text>
                <View style={[styles.badgePeriodo, {marginVertical: 8}]}>
                  <Ionicons name="sync" size={12} color={colors.primary} />
                  <Text style={styles.badgePeriodoText}>{servicioSeleccionado.periodicidad}</Text>
                </View>
                <Text style={[styles.servicioAmount, {fontSize: 32, marginVertical: 8}]}>${servicioSeleccionado.monto.toLocaleString('es-AR')}</Text>
                
                <View style={{flexDirection: 'row', gap: 16, marginBottom: 8}}>
                  <Text style={{fontSize: 14, color: colors.textSecondary}}>Tu parte: <Text style={{fontWeight: 'bold'}}>${(servicioSeleccionado.monto / (servicioSeleccionado.participantes?.length || 1)).toLocaleString('es-AR')}</Text></Text>
                  <Text style={{fontSize: 14, color: colors.textSecondary}}>•</Text>
                  <Text style={{fontSize: 14, color: (new Date(servicioSeleccionado.proximoVencimiento) - new Date() <= 5 * 24 * 60 * 60 * 1000) ? colors.redGlobal : colors.textSecondary}}>{renderDiasParaVencer(servicioSeleccionado.proximoVencimiento)}</Text>
                </View>
                
                <View style={styles.modalDivider} />
                
                <Text style={styles.modalSubtitle}>Participantes ({servicioSeleccionado.participantes?.length || 0})</Text>
                <View style={{flexDirection: 'row', gap: 12, marginTop: 12, alignSelf: 'flex-start'}}>
                  {(servicioSeleccionado.participantes || []).map((p, i) => (
                    <View key={i} style={{alignItems: 'center'}}>
                      <View style={[styles.avatar, { width: 40, height: 40, borderRadius: 20, backgroundColor: getColorByNombre(p) }]}>
                        <Text style={[styles.avatarTexto, {fontSize: 14}]}>{getIniciales(p)}</Text>
                      </View>
                      <Text style={{fontSize: 12, marginTop: 4}}>{p}</Text>
                    </View>
                  ))}
                </View>
                
                <TouchableOpacity style={styles.btnMarcarPagado}>
                  <Text style={styles.btnMarcarPagadoText}>Marcar como pagado</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 100 },
  headerTitle: { color: colors.textSecondary, fontSize: 13 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary },
  btnGasto: { flexDirection: 'row', backgroundColor: colors.textSecondary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', gap: 4 },
  btnGastoText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  totalCard: { backgroundColor: colors.textSecondary, borderRadius: 20, padding: 20, marginBottom: 30 },
  totalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 },
  totalAmount: { color: '#fff', fontSize: 36, fontWeight: 'bold', marginVertical: 8 },
  badgesRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  badge: { backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 12, flex: 1 },
  badgeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  badgeValue: { color: '#F1948A', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },
  servicioCard: { backgroundColor: colors.cardBg, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  servicioIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FDECEC', justifyContent: 'center', alignItems: 'center' },
  servicioInfo: { flex: 1 },
  servicioName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  badgePeriodo: { flexDirection: 'row', backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignItems: 'center', gap: 4 },
  badgePeriodoText: { fontSize: 10, fontWeight: 'bold', color: colors.primary },
  servicioDate: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  servicioTuParte: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  servicioRight: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' },
  servicioAmount: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  badgeUrgente: { backgroundColor: '#FDECEC', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  badgeUrgenteText: { fontSize: 10, color: colors.redGlobal, fontWeight: 'bold' },
  badgeAlDia: { backgroundColor: '#E9F7EF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  badgeAlDiaText: { fontSize: 10, color: colors.greenGlobal, fontWeight: 'bold' },
  btnTick: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  avatarStack: { flexDirection: 'row' },
  avatar: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBg },
  avatarTexto: { color: 'white', fontSize: 7, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalBody: { alignItems: 'center', marginTop: 10 },
  modalSubtitle: { fontSize: 14, fontWeight: 'bold', color: colors.textSecondary, alignSelf: 'flex-start' },
  modalDivider: { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 20 },
  btnMarcarPagado: { backgroundColor: colors.textSecondary, width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 30 },
  btnMarcarPagadoText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
