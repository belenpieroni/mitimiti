import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { crearGastoVivienda, crearServicioVivienda, actualizarGastoVivienda, actualizarServicioVivienda } from '../../services/viviendaService';

const CATEGORIAS = [
  'Transferencias', 'Comidas y bebidas', 'Transporte', 'Impuestos',
  'Salud y cuidado personal', 'Supermercado', 'Suscripciones',
  'Hogar', 'Indumentaria', 'Shopping', 'Otras categorías'
];

const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual', 'Bimestral', 'Semestral', 'Anual'];

export default function AgregarViviendaScreen({ route, navigation }) {
  const [esServicio, setEsServicio] = useState(true);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [frecuencia, setFrecuencia] = useState('Mensual');
  const [categoria, setCategoria] = useState('Supermercado');
  const [modalCatVisible, setModalCatVisible] = useState(false);

  const editMode = route?.params?.editMode || false;
  const data = route?.params?.data || null;

  React.useEffect(() => {
    if (editMode && data) {
      setEsServicio(!!data.periodicidad);
      setNombre(data.nombre || '');
      setMonto(data.monto ? String(data.monto) : '');
      if (data.periodicidad) {
        const p = data.periodicidad;
        setFrecuencia(p.charAt(0).toUpperCase() + p.slice(1));
      }
      if (data.categoria) setCategoria(data.categoria);
    }
  }, [editMode, data]);

  const handleGuardar = async () => {
    try {
      if (esServicio) {
        const payload = {
          nombre,
          monto: Number(monto),
          periodicidad: frecuencia.toLowerCase(),
          proximoVencimiento: editMode && data?.proximoVencimiento ? data.proximoVencimiento : new Date().toISOString(),
          participantes: editMode && data?.participantes ? data.participantes : ["Martín"]
        };
        if (editMode) {
          await actualizarServicioVivienda(data.id, payload);
        } else {
          await crearServicioVivienda(payload);
        }
      } else {
        const payload = {
          nombre,
          monto: Number(monto),
          categoria,
          fecha: editMode && data?.fecha ? data.fecha : new Date().toISOString(),
          pagador: editMode && data?.pagador ? data.pagador : 'Martín',
          participantes: editMode && data?.participantes ? data.participantes : ["Martín"]
        };
        if (editMode) {
          await actualizarGastoVivienda(data.id, payload);
        } else {
          await crearGastoVivienda(payload);
        }
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Hubo un problema al guardar.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnBack}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editMode ? (esServicio ? 'Editar Servicio' : 'Editar Gasto') : 'Nuevo gasto en vivienda'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tab, esServicio && styles.tabActive, editMode && !esServicio && {opacity: 0.5}]} 
            onPress={() => !editMode && setEsServicio(true)}
            disabled={editMode}>
            <Ionicons name="repeat" size={24} color={esServicio ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabTitle, esServicio && {color: '#fff'}]}>Servicio</Text>
            <Text style={[styles.tabSub, esServicio && {color: 'rgba(255,255,255,0.7)'}]}>Periódico</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, !esServicio && styles.tabActive, editMode && esServicio && {opacity: 0.5}]} 
            onPress={() => !editMode && setEsServicio(false)}
            disabled={editMode}>
            <Ionicons name="bag" size={24} color={!esServicio ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabTitle, !esServicio && {color: '#fff'}]}>Gasto</Text>
            <Text style={[styles.tabSub, !esServicio && {color: 'rgba(255,255,255,0.7)'}]}>Puntual</Text>
          </TouchableOpacity>
        </View>

        {esServicio && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.infoText}>
              Cargás el servicio una sola vez. Cuando cambie el precio, editás el monto y listo — la división se recalcula automáticamente.
            </Text>
          </View>
        )}

        <Text style={styles.label}>{esServicio ? 'SERVICIO' : 'GASTO'}</Text>
        <TextInput 
          style={styles.input} 
          placeholder={esServicio ? "Ej: Luz, internet..." : "Ej: Super, ferretería..."} 
          value={nombre}
          onChangeText={setNombre}
        />

        <Text style={styles.label}>MONTO</Text>
        <TextInput 
          style={styles.input} 
          placeholder="$ 0" 
          keyboardType="numeric"
          value={monto}
          onChangeText={setMonto}
        />

        {esServicio ? (
          <View>
            <Text style={styles.label}>FRECUENCIA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frecuenciaScroll}>
              {FRECUENCIAS.map(f => (
                <TouchableOpacity 
                  key={f}
                  style={[styles.frecBtn, frecuencia === f && styles.frecBtnActive]}
                  onPress={() => setFrecuencia(f)}
                >
                  <Text style={[styles.frecBtnText, frecuencia === f && styles.frecBtnTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View>
            <Text style={styles.label}>CATEGORÍA</Text>
            <TouchableOpacity style={styles.catSelector} onPress={() => setModalCatVisible(true)}>
              <Text style={styles.catSelectorText}>{categoria}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardar}>
          <Text style={styles.btnGuardarText}>{editMode ? 'Actualizar' : 'Guardar'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Categorías */}
      <Modal visible={modalCatVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalCatVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar categoría</Text>
              <TouchableOpacity onPress={() => setModalCatVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CATEGORIAS.map(cat => (
                <TouchableOpacity 
                  key={cat} 
                  style={styles.catItem}
                  onPress={() => { setCategoria(cat); setModalCatVisible(false); }}
                >
                  <Text style={[styles.catItemText, categoria === cat && { fontWeight: 'bold', color: colors.textSecondary }]}>{cat}</Text>
                  {categoria === cat && <Ionicons name="checkmark" size={20} color={colors.textSecondary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, marginBottom: 20 },
  btnBack: { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  scroll: { padding: 20 },
  tabsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  tab: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#ddd' },
  tabActive: { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  tabTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginTop: 8 },
  tabSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  infoBox: { flexDirection: 'row', backgroundColor: '#e9e6df', padding: 16, borderRadius: 12, marginBottom: 20, gap: 12, alignItems: 'center', borderWidth: 1, borderColor: '#d3cfc5' },
  infoText: { flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#fff', padding: 16, borderRadius: 12, fontSize: 16, color: colors.textPrimary },
  frecuenciaScroll: { flexDirection: 'row', overflow: 'visible' },
  frecBtn: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: '#eee' },
  frecBtnActive: { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
  frecBtnText: { color: colors.textPrimary, fontWeight: 'bold' },
  frecBtnTextActive: { color: '#fff' },
  catSelector: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catSelectorText: { fontSize: 16, color: colors.textPrimary },
  btnGuardar: { backgroundColor: colors.textSecondary, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 40 },
  btnGuardarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  catItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  catItemText: { fontSize: 16, color: colors.textPrimary }
});
