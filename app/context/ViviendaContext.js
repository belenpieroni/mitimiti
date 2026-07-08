import React, { createContext, useContext, useState } from 'react';
import { getAcuerdosReparto, guardarAcuerdoReparto } from '../services/viviendaService';

const ViviendaContext = createContext();

export function ViviendaProvider({ children }) {
  const [reglas, setReglas] = useState([]);
  const [cargando, setCargando] = useState(false);

  const normalizarAcuerdos = (data) =>
    (Array.isArray(data) ? data : []).map((item) => ({
      id: item.id ?? item.nombre,
      nombre: item.nombre ?? 'Sin nombre',
      modelo: item.modelo ?? 'partes_iguales',
      participantes: (item.participantes ?? []).map((p) => ({
        nombre: p?.nombre ?? 'Sin nombre',
        porcentaje: Number(p?.porcentaje ?? 0),
      })),
    }));

  const cargarAcuerdos = async (retryCount = 1) => {
    setCargando(true);
    try {
      const data = await getAcuerdosReparto();
      setReglas(normalizarAcuerdos(data));
      return true;
    } catch (e) {
      if (retryCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        return cargarAcuerdos(retryCount - 1);
      }

      console.error('Error cargando acuerdos:', e.message);
      return false;
    } finally {
      setCargando(false);
    }
  };

const agregarRegla = async (nuevaRegla) => {
  try {
    await guardarAcuerdoReparto(nuevaRegla);
    await cargarAcuerdos(); // ← esto actualiza `reglas` en el contexto
  } catch (e) {
    console.error('Error guardando regla:', e);
  }
};

  return (
    <ViviendaContext.Provider value={{ reglas, setReglas, cargando, agregarRegla, recargar: cargarAcuerdos }}>
      {children}
    </ViviendaContext.Provider>
  );
}

export function useVivienda() {
  return useContext(ViviendaContext);
}

function normalizarModelo(tipo) {
  const map = {
    'PROPORCIONAL': 'proporcional',
    'IGUALITARIO': 'partes_iguales',
    'RESPONSABLE_UNICO': 'responsable_unico',
  };
  return map[tipo] ?? tipo ?? 'partes_iguales';
}