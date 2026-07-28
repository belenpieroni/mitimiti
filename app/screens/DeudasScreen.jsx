import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { marcarPagadoVivienda, revertirPagoVivienda } from '../services/viviendaService';
import Svg, { Circle, G } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import Toast from '../components/Toast';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getIcono = (tipo) => (tipo === 'Vivienda' ? "home-outline" : "balloon-outline");

const formatPesos = (monto) => {
  const valor = Number(monto) || 0;
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatearFechaLarga = (fechaString) => {
  if (!fechaString) return { fecha: '', hora: '' };
  const d = new Date(fechaString);
  if (isNaN(d.getTime())) return { fecha: fechaString, hora: '' };
  
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  
  let horas = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  const ampm = horas >= 12 ? 'PM' : 'AM';
  horas = horas % 12;
  horas = horas ? horas : 12;
  
  return {
    fecha: `${dia} de ${mes}`,
    hora: `${horas}:${mins} ${ampm}`
  };
};

export default function DeudasScreen({ navigation }) {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFinancialDetail, setShowFinancialDetail] = useState(false);
  const [expandedCompId, setExpandedCompId] = useState(null);
  
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const mostrarToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const [pendientes, setPendientes] = useState([]);
  const [serviciosAPagar, setServiciosAPagar] = useState([]);
  const [pagosRecientes, setPagosRecientes] = useState([]);
  const [uncheckedItems, setUncheckedItems] = useState(new Set());

  const cargarDeudas = async () => {
    const nombreUsuario = user?.name || user?.nombre;
    if (!nombreUsuario) {
      setPendientes([]);
      setServiciosAPagar([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const url = `${API_BASE}/deudas/consolidado/${encodeURIComponent(nombreUsuario)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data?.error || 'No se pudo conectar al servidor');
      }

      if (Array.isArray(data.data)) {
        setPendientes(data.data);
      } else {
        setPendientes(data.data.acreedores || []);
        setServiciosAPagar(data.data.serviciosAPagar || []);
        
        const pagos = data.data.pagosRecientes || [];
        pagos.sort((a, b) => new Date(b.fecha_pago || 0) - new Date(a.fecha_pago || 0));
        setPagosRecientes(pagos);
      }
    } catch (error) {
      console.error('Error al conectar con el backend:', error);
      setPendientes([]);
      setServiciosAPagar([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarDeudas();
    }, [user])
  );

  const totalAcreedores = pendientes.reduce((acc, a) => {
    const activeConcepts = a.conceptos.filter(c => !uncheckedItems.has(c.id));
    const netTotal = activeConcepts.reduce((sum, c) => sum + (c.tipoOperacion === 'resta' ? -c.monto : c.monto), 0);
    return acc + Math.max(0, netTotal);
  }, 0);

  const totalAFavor = pendientes.reduce((acc, a) => {
    const activeConcepts = a.conceptos.filter(c => !uncheckedItems.has(c.id));
    const netTotal = activeConcepts.reduce((sum, c) => sum + (c.tipoOperacion === 'resta' ? -c.monto : c.monto), 0);
    return acc + (netTotal < 0 ? Math.abs(netTotal) : 0);
  }, 0);

  const totalServicios = serviciosAPagar.reduce((acc, s) => acc + (s.monto || 0), 0);
  const totalAPagar = totalAcreedores + totalServicios;
  const totalConceptos = pendientes.reduce((acc, a) => acc + a.conceptos.length, 0) + serviciosAPagar.length;

  const handleConfirmarPago = async (acreedor, concepto) => {
    try {
      if (concepto.esVivienda) {
        await marcarPagadoVivienda(concepto.tipoVivienda, concepto.id);
      } else {
        const response = await fetch(`${API_BASE}/deudas/pagar/${encodeURIComponent(concepto.id)}`, {
          method: 'PATCH'
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data?.error || 'No se pudo confirmar el pago');
        }
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await cargarDeudas();
      setConfirmingId(null);
    } catch (error) {
      console.error('Error al confirmar el pago:', error);
    }
  };

  const handleConfirmarServicio = async (servicio) => {
    try {
      await marcarPagadoVivienda('servicios', servicio.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await cargarDeudas();
      setConfirmingId(null);
    } catch (error) {
      console.error('Error al confirmar el pago:', error);
    }
  };

  const handleRevertirPago = async (pago) => {
    try {
      if (!pago.esVivienda) return;
      await revertirPagoVivienda(pago.tipoVivienda, pago.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await cargarDeudas();
    } catch (error) {
      console.error('Error al revertir pago:', error);
    }
  };

  const toggleCheckbox = (conceptoId) => {
    setUncheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(conceptoId)) {
        next.delete(conceptoId);
      } else {
        next.add(conceptoId);
      }
      return next;
    });
  };

  const handlePagarTodo = async (acreedor, activeConcepts) => {
    if (!activeConcepts || activeConcepts.length === 0) return;
    try {
      const payload = activeConcepts.map(c => ({
        id: c.id,
        esVivienda: c.esVivienda || false,
        tipoVivienda: c.tipoVivienda
      }));

      const netTotal = activeConcepts.reduce((acc, c) => acc + (c.tipoOperacion === 'resta' ? -c.monto : c.monto), 0);
      const gastosAFavor = activeConcepts.filter(c => c.tipoOperacion === 'resta').reduce((sum, c) => sum + c.monto, 0);
      const gastosEnContra = activeConcepts.filter(c => c.tipoOperacion === 'suma').reduce((sum, c) => sum + c.monto, 0);

      const response = await fetch(`${API_BASE}/deudas/pagar_multiple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: payload,
          compensacion: {
            contraparte: acreedor.nombre,
            neto: netTotal,
            gastosAFavor,
            gastosEnContra
          }
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data?.error || 'No se pudo procesar la liquidación');
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      const remainingConcepts = acreedor.conceptos.filter(c => uncheckedItems.has(c.id));
      const remainingNet = remainingConcepts.reduce((acc, c) => acc + (c.tipoOperacion === 'resta' ? -c.monto : c.monto), 0);
      const remainingPositive = Math.max(0, remainingNet);

      const getMensajeCompensacion = (saldoActual) => {
        if (saldoActual <= 0) return '¡Tu deuda está saldada!';
        return `Tu deuda se redujo. Saldo actual: $${formatPesos(saldoActual)}`;
      };

      Alert.alert('Compensación exitosa', getMensajeCompensacion(remainingPositive));

      setUncheckedItems(new Set());
      await cargarDeudas();
    } catch (error) {
      console.error('Error al pagar todo:', error);
    }
  };

  const handleMercadoPago = async (acreedor) => {
    try {
      const alias = acreedor.alias || acreedor.cvu;
      if (!alias) {
        mostrarToast(`No se encontró un Alias o CVU para ${acreedor.nombre}.`, 'error');
        return;
      }
      
      await Clipboard.setStringAsync(alias);
      
      try {
        await Linking.openURL('mercadopago://');
      } catch (e) {
        mostrarToast(`El alias se copió al portapapeles.\nAbre Mercado Pago manualmente para transferir.`);
      }
    } catch (error) {
      mostrarToast('Hubo un problema al intentar copiar el alias.', 'error');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const gruposPagos = [];
  const pagosOrdenados = [...pagosRecientes].sort((a, b) => {
    return new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime();
  });

  const pagosPreview = pagosOrdenados.slice(0, 3);

  pagosPreview.forEach(pago => {
    const { fecha, hora } = formatearFechaLarga(pago.fecha_pago);
    let grupo = gruposPagos.find(g => g.fecha === fecha);
    if (!grupo) {
      grupo = { fecha, pagos: [] };
      gruposPagos.push(grupo);
    }
    grupo.pagos.push({ ...pago, horaFormateada: hora });
  });

  return (
    <View style={styles.safeArea}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>Resumen de tus cuentas pendientes</Text>  
          <Text style={styles.title}>Deudas</Text>
        </View>

        <TouchableOpacity 
          style={styles.balanceCard}
          activeOpacity={0.9}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowFinancialDetail(prev => !prev);
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.balanceLabel}>TOTAL A PAGAR</Text>
              <Text style={styles.balanceAmount}>${formatPesos(totalAPagar)}</Text>
              <Text style={styles.balanceInfo}>
                {totalConceptos} {totalConceptos === 1 ? 'deuda pendiente' : 'deudas pendientes'} - {pendientes.length} {pendientes.length === 1 ? 'acreedor' : 'acreedores'}
              </Text>
            </View>
            
            <View style={styles.pieChartContainer}>
              <Svg width={70} height={70} viewBox="0 0 70 70">
                {totalAPagar === 0 ? (
                  <Circle cx={35} cy={35} r={28} stroke="rgba(255, 255, 255, 0.25)" strokeWidth={7} fill="none" />
                ) : (
                  <G rotation="-90" origin="35, 35">
                    <Circle cx={35} cy={35} r={28} stroke="#d6c1eb" strokeWidth={7} fill="none" />
                    <Circle 
                      cx={35} 
                      cy={35} 
                      r={28} 
                      stroke="white" 
                      strokeWidth={7} 
                      fill="none"
                      strokeDasharray={[ (totalAcreedores / totalAPagar) * 175.93, 175.93 ]}
                    />
                  </G>
                )}
              </Svg>
            </View>
          </View>

          {showFinancialDetail && (
            <View style={styles.detailCollapseContainer}>
              <View style={styles.detailCollapseDivider} />
              <Text style={styles.detailCollapseTitle}>Desglose del Total consolidado</Text>
              <View style={styles.detailCollapseRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="people-outline" size={16} color="white" />
                  <Text style={styles.detailCollapseText}>Gastos de Juntadas:</Text>
                </View>
                <Text style={styles.detailCollapseValue}>${formatPesos(totalAcreedores)}</Text>
              </View>
              <View style={styles.detailCollapseRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="home-outline" size={16} color="white" />
                  <Text style={styles.detailCollapseText}>Servicios de Vivienda:</Text>
                </View>
                <Text style={styles.detailCollapseValue}>${formatPesos(totalServicios)}</Text>
              </View>
              {totalAFavor > 0 && (
                <View style={styles.detailCollapseRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="arrow-up-circle-outline" size={16} color="white" />
                    <Text style={styles.detailCollapseText}>Total a tu favor (Te deben):</Text>
                  </View>
                  <Text style={[styles.detailCollapseValue, { color: '#C8E6C9' }]}>${formatPesos(totalAFavor)}</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>

        {pendientes.length === 0 && serviciosAPagar.length === 0 && pagosRecientes.length === 0 ? (
          <View style={[styles.center, { marginTop: 40 }]}>
            <Ionicons name="sparkles-outline" size={48} color={colors.primary} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6, textAlign: 'center' }}>
              ¡Todo al día!
            </Text>
            <Text style={{ fontSize: 13, color: '#666', textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 }}>
              No tienes deudas pendientes ni actividad reciente.
            </Text>
          </View>
        ) : (
          <>
            {serviciosAPagar.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>SERVICIOS A PAGAR</Text>
                {serviciosAPagar.map((servicio) => (
                  <View key={servicio.id} style={[styles.acreedorWrapper, { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <View style={[styles.avatar, {backgroundColor: '#E65100'}]}><Ionicons name="flash" size={20} color="#FFF" /></View>
                      <View style={styles.userText}>
                        <Text style={styles.userName}>{servicio.titulo}</Text>
                        <Text style={styles.userSub}>{servicio.sub}</Text>
                      </View>
                    </View>
                    <View style={{alignItems: 'flex-end'}}>
                      <Text style={styles.totalAmount}>{servicio.monto != null ? `$${formatPesos(servicio.monto)}` : '$ -'}</Text>
                      {servicio.monto != null && (
                        confirmingId === servicio.id ? (
                          <View style={{ flexDirection: 'row', gap: 5, marginTop: 5 }}>
                            <TouchableOpacity style={styles.btnConfirmar} onPress={() => handleConfirmarServicio(servicio)}><Text style={styles.btnConfirmarText}>Confirmar</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.btnCancelar} onPress={() => setConfirmingId(null)}><Text style={styles.btnCancelarText}>X</Text></TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity style={[styles.btnMarcar, {marginTop: 5}]} onPress={() => setConfirmingId(servicio.id)}>
                            <Text style={styles.btnMarcarText}>Marcar pagado</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}

            {pendientes.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>PENDIENTES</Text>
                {pendientes.map((acreedor) => {
                  const activeConcepts = acreedor.conceptos.filter(c => !uncheckedItems.has(c.id));
                  const netTotal = activeConcepts.reduce((acc, c) => acc + (c.tipoOperacion === 'resta' ? -c.monto : c.monto), 0);
                  const isNetoPositivo = netTotal > 0;
                  const totalFavor = activeConcepts.filter(c => c.tipoOperacion === 'resta').reduce((sum, c) => sum + c.monto, 0);
                  const totalContra = activeConcepts.filter(c => c.tipoOperacion === 'suma').reduce((sum, c) => sum + c.monto, 0);

                  return (
                    <View key={acreedor.id} style={styles.acreedorWrapper}>
                      <TouchableOpacity style={styles.acreedorHeader} onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedId(expandedId === acreedor.id ? null : acreedor.id);
                      }}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{acreedor.avatar}</Text></View>
                        <View style={[styles.userText, { flex: 1, marginLeft: 12 }]}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.userName}>{acreedor.nombre}</Text>
                            <Text style={[
                              styles.totalAmount,
                              netTotal < 0 ? { color: '#33b849' } : (netTotal > 0 ? { color: '#e65100' } : { color: '#666' })
                            ]}>
                              {netTotal < 0 ? 'Te deben: ' : (netTotal > 0 ? 'Debes: ' : 'Al día: ')}${formatPesos(Math.abs(netTotal))}
                            </Text>
                          </View>
                          
                          {acreedor.alias ? (
                            <TouchableOpacity 
                              style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, gap: 4 }}
                              onPress={async () => {
                                await Clipboard.setStringAsync(acreedor.alias);
                                mostrarToast('Alias copiado', 'success');
                              }}
                            >
                              <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{acreedor.alias}</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={{ height: 6 }} />
                          )}
                          
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.userSub}>{activeConcepts.length} deudas seleccionadas</Text>
                            <Ionicons name={expandedId === acreedor.id ? "chevron-up" : "chevron-down"} size={20} color="#666" />
                          </View>
                        </View>
                      </TouchableOpacity>

                      {expandedId === acreedor.id && (
                        <View style={styles.expandableContent}>
                          {acreedor.conceptos.map((concepto, index) => {
                            const isChecked = !uncheckedItems.has(concepto.id);
                            const isResta = concepto.tipoOperacion === 'resta';
                            const montoColor = isResta ? '#33b849' : '#e65100'; 

                            return (
                              <TouchableOpacity 
                                key={`${acreedor.id}-${concepto.id || 'concept'}-${index}`} 
                                style={[styles.conceptRow, { opacity: isChecked ? 1 : 0.5 }]}
                                onPress={() => toggleCheckbox(concepto.id)}
                              >
                                <View style={styles.conceptLeft}>
                                  <View style={styles.conceptTitleRow}>
                                    <Ionicons 
                                      name={isChecked ? "checkbox" : "square-outline"} 
                                      size={20} 
                                      color={isChecked ? colors.primary : '#999'} 
                                      style={{marginRight: 8}} 
                                    />
                                    <Ionicons name={getIcono(concepto.tipo)} size={16} color={colors.primary} style={{marginRight: 8}} />
                                    <Text style={[styles.conceptTitle, !isChecked && { textDecorationLine: 'line-through' }]}>{concepto.titulo}</Text>
                                  </View>
                                  <Text style={[styles.conceptPath, { marginLeft: 28 }]}>{concepto.sub}</Text>
                                </View>
                                <View style={styles.conceptRight}>
                                  <Text style={[styles.conceptPrice, { color: montoColor }]}>
                                    {isResta ? '(-)' : '(+)'} ${formatPesos(concepto.monto)}
                                  </Text>
                                  <Text style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{isResta ? 'Te debe' : 'Tú debes'}</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}

                          
                          <View style={styles.desgloseBox}>
                            <Text style={styles.desgloseTitulo}>Desglose de Saldo</Text>
                            <View style={styles.desgloseFila}>
                              <Text style={styles.desgloseLabel}>Gastos a Favor (Te deben):</Text>
                              <Text style={[styles.desgloseValor, { color: '#33b849' }]}>${formatPesos(totalFavor)}</Text>
                            </View>
                            <View style={styles.desgloseFila}>
                              <Text style={styles.desgloseLabel}>Gastos en Contra (Debes):</Text>
                              <Text style={[styles.desgloseValor, { color: '#e65100' }]}>${formatPesos(totalContra)}</Text>
                            </View>
                            <View style={styles.lineaFina} />
                             <View style={styles.desgloseFila}>
                              <Text style={styles.desgloseLabelBold}>Saldo Neto:</Text>
                              <Text style={[
                                styles.desgloseValorBold,
                                netTotal < 0 ? { color: '#33b849' } : (netTotal > 0 ? { color: '#e65100' } : { color: '#1E293B' })
                              ]}>
                                {netTotal < 0 ? 'A tu favor: ' : (netTotal > 0 ? 'En tu contra: ' : '')}${formatPesos(Math.abs(netTotal))}
                              </Text>
                            </View>
                            {netTotal === 0 && (
                              <View style={styles.compensacionBanner}>
                                <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                                <Text style={styles.compensacionText}>
                                  Este saldo quedó en $0 porque tus gastos de ${formatPesos(totalFavor)} compensaron tu deuda de ${formatPesos(totalContra)}.
                                </Text>
                              </View>
                            )}
                          </View>

                           <TouchableOpacity 
                            style={[styles.btnPagarTodo, !isNetoPositivo && { backgroundColor: '#ccc' }]} 
                            disabled={!isNetoPositivo}
                            onPress={() => handlePagarTodo(acreedor, activeConcepts)}
                          >
                            <Text style={styles.btnPagarTodoText}>
                              {netTotal > 0 
                                ? `Liquidar Saldo Neto a ${acreedor.nombre} - $${formatPesos(netTotal)}`
                                : `No hay saldo pendiente a pagar`
                              }
                            </Text>
                          </TouchableOpacity>

                          {netTotal > 0 && (
                            <TouchableOpacity 
                              style={styles.btnMercadoPago} 
                              onPress={() => handleMercadoPago(acreedor)}
                            >
                              <Ionicons name="wallet-outline" size={18} color="white" style={{ marginRight: 8 }} />
                              <Text style={styles.btnMercadoPagoText}>
                                Pagar $ {formatPesos(netTotal)} con Mercado Pago
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {gruposPagos.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>PAGOS Y COMPENSACIONES RECIENTES</Text>
                {gruposPagos.map((grupo, gIndex) => (
                  <View key={`grupo-${gIndex}`} style={{ marginBottom: 15 }}>
                    <Text style={styles.grupoFechaHeader}>{grupo.fecha}</Text>
                    {grupo.pagos.map((pago, pIndex) => {
                      const isComp = pago.isCompensacion === true;
                      const isExpanded = expandedCompId === pago.id;
                      return (
                        <View key={`${pago.id || pago.titulo}-${pIndex}`} style={{ marginBottom: pIndex === grupo.pagos.length - 1 ? 0 : 10 }}>
                          <TouchableOpacity 
                            activeOpacity={isComp ? 0.7 : 1}
                            style={styles.pagoRecienteCard}
                            onPress={() => {
                              if (isComp) {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setExpandedCompId(expandedCompId === pago.id ? null : pago.id);
                              }
                            }}
                          >
                            <View style={[
                              styles.checkIconContainer,
                              isComp && { backgroundColor: '#F2F4F6' }
                            ]}>
                              <Ionicons 
                                name={isComp ? "swap-horizontal" : "checkmark"} 
                                size={18} 
                                color={isComp ? "#666" : "#33b849"} 
                              />
                            </View>
                            <View style={styles.pagoInfo}>
                              <Text style={styles.pagoTitle}>{pago.titulo}</Text>
                              {pago.sub ? <Text style={styles.pagoSub}>{pago.sub}</Text> : null}
                            </View>
                            <View style={styles.pagoRight}>
                              <Text style={[
                                styles.pagoAmount,
                                isComp && { color: '#666' }
                              ]}>
                                ${formatPesos(pago.monto)}
                              </Text>
                              <Text style={styles.pagoTimeText}>{isComp ? 'Compensado' : pago.horaFormateada}</Text>
                            </View>
                          </TouchableOpacity>

                          {isComp && isExpanded && (
                            <View style={styles.desgloseBox}>
                              <Text style={styles.desgloseTitulo}>Desglose de Saldo</Text>
                              <View style={styles.desgloseFila}>
                                <Text style={styles.desgloseLabel}>Gastos a Favor (Te debían):</Text>
                                <Text style={[styles.desgloseValor, { color: '#33b849' }]}>${formatPesos(pago.gastosAFavor)}</Text>
                              </View>
                              <View style={styles.desgloseFila}>
                                <Text style={styles.desgloseLabel}>Gastos en Contra (Debías):</Text>
                                <Text style={[styles.desgloseValor, { color: '#e65100' }]}>${formatPesos(pago.gastosEnContra)}</Text>
                              </View>
                              <View style={styles.lineaFina} />
                              <View style={styles.desgloseFila}>
                                <Text style={styles.desgloseLabelBold}>Saldo Compensado Neto:</Text>
                                <Text style={styles.desgloseValorBold}>${formatPesos(pago.monto)}</Text>
                              </View>
                              {pago.monto === 0 && (
                                <View style={styles.compensacionBanner}>
                                  <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                                  <Text style={styles.compensacionText}>
                                    Este saldo quedó en $0 porque tus gastos de ${formatPesos(pago.gastosAFavor)} compensaron tu deuda de ${formatPesos(pago.gastosEnContra)}.
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}

                {pagosRecientes.length > 3 && (
                  <TouchableOpacity 
                    style={styles.btnVerHistorial}
                    onPress={() => navigation.navigate('HistorialCompleto', { pagosRecientes })}
                  >
                    <Text style={styles.btnVerHistorialText}>Ver historial completo</Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24 },
  header: { marginBottom: 20 },
  title: {  fontSize: 28, fontWeight: 'bold', color: colors.textPrimary},
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  balanceCard: { backgroundColor: colors.primary, borderRadius: 24, padding: 25, marginBottom: 30 },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  balanceAmount: { color: 'white', fontSize: 36, fontWeight: 'bold', marginVertical: 5 },
  balanceInfo: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 15 },
  acreedorWrapper: { backgroundColor: 'white', borderRadius: 20, marginBottom: 15, overflow: 'hidden' },
  acreedorHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', justifyContent: 'space-between' },
  userInfoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  userText: { marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  userSub: { fontSize: 12, color: '#666' },
  totalAmount: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  expandableContent: { paddingHorizontal: 15, paddingBottom: 15, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  conceptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F9F9F9' },
  conceptTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  conceptTitleRow: { flexDirection: 'row', alignItems: 'center' },
  conceptPath: { fontSize: 12, color: '#666', marginTop: 2 },
  conceptRight: { alignItems: 'flex-end' },
  conceptPrice: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  btnMarcar: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'rgba(54, 44, 97, 0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  btnMarcarText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  btnConfirmar: { backgroundColor: colors.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  btnConfirmarText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  btnCancelar: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'rgba(54, 44, 97, 0.08)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  btnCancelarText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  btnPagarTodo: { backgroundColor: colors.primary, padding: 15, borderRadius: 15, marginTop: 15, alignItems: 'center' },
  btnPagarTodoText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  btnMercadoPago: { backgroundColor: '#009EE3', padding: 15, borderRadius: 15, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnMercadoPagoText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  pagoRecienteCard: { flexDirection: 'row', backgroundColor: 'white', padding: 15, borderRadius: 20, alignItems: 'center', marginBottom: 10 },
  checkIconContainer: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(51, 184, 73, 0.15)', justifyContent: 'center', alignItems: 'center' },
  pagoInfo: { flex: 1, marginLeft: 12 },
  pagoTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  pagoSub: { fontSize: 11, color: '#666' },
  pagoRight: { alignItems: 'flex-end' },
  pagoAmount: { fontSize: 14, fontWeight: 'bold', color: '#35af49' },
  pagoDate: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  pagoDateText: { fontSize: 10, color: '#999', marginLeft: 3 },
  pagoDateHeader: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 4 },
  grupoFechaHeader: { fontSize: 15, fontWeight: 'bold', color: '#444', marginBottom: 10, marginLeft: 5 },
  pagoTimeText: { fontSize: 11, color: '#aaa', marginTop: 4, fontWeight: '500' },
  btnVerHistorial: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 5,
    marginBottom: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFF',
  },
  btnVerHistorialText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  pieChartContainer: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailCollapseContainer: {
    marginTop: 15,
  },
  detailCollapseDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 10,
  },
  detailCollapseTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    opacity: 0.9,
  },
  detailCollapseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  detailCollapseText: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.8,
  },
  detailCollapseValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  desgloseBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  desgloseTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  desgloseFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  desgloseLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  desgloseValor: {
    fontSize: 12,
    fontWeight: '600',
  },
  lineaFina: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  desgloseLabelBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  desgloseValorBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  compensacionBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(71, 52, 114, 0.05)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(71, 52, 114, 0.1)',
  },
  compensacionText: {
    fontSize: 11,
    color: colors.primary,
    flex: 1,
    lineHeight: 15,
    fontWeight: '500',
  },
});