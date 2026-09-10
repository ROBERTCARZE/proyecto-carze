/* ==========================================================================
   CONSTANTS.JS — Constantes de negocio compartidas
   CARZE Contratistas Generales S.A.C.
   --------------------------------------------------------------------------
   Antes duplicadas en caja_diaria.js, dashboard.js y flujo_caja.js.
   Si mañana cambian de banco o agregan una categoría de gasto, se edita
   un solo archivo en vez de tres.

   Uso:
       import { MESES, MESES_LARGO, CAT_LABELS, CAT_COLORS } from "./constants.js";
   ========================================================================== */

export const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
    'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const CAT_LABELS = {
    SCOTIABANK: 'Scotiabank',
    INTERBANK: 'Interbank',
    COSTOS_DIRECTOS: 'Costos Directos',
    GASTOS_DE_PERSONAL: 'Personal',
    LOGISTICA_Y_CAMPO: 'Logística',
    FINANCIERO_CAJA: 'Financiero',
    GASTOS_ADMINISTRATIVOS_Y_FIJOS: 'Administrativo',
    GASTOS_INDIRECTOS: 'Indirectos',
    AHORRO: 'Ahorro'
};

export const CAT_COLORS = {
    SCOTIABANK: '#c8102e',
    INTERBANK: '#0033a0',
    COSTOS_DIRECTOS: '#1e40af',
    GASTOS_DE_PERSONAL: '#9333ea',
    LOGISTICA_Y_CAMPO: '#f59e0b',
    FINANCIERO_CAJA: '#dc2626',
    GASTOS_ADMINISTRATIVOS_Y_FIJOS: '#475569',
    GASTOS_INDIRECTOS: '#ea580c',
    AHORRO: '#059669'
};
