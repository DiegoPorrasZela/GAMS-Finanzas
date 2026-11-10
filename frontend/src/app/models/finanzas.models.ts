// Tipos que usa toda la aplicación. El backend envía el tipo en mayúsculas (INGRESO/GASTO);
// los servicios lo convierten a minúsculas para usarlo en las pantallas.

export type TipoMovimiento = 'ingreso' | 'gasto';

// Categorías del sistema (el backend no deja editarlas ni eliminarlas)
export const CATEGORIA_SALDO_INICIAL = 'Saldo inicial'; // dinero con el que empieza (una sola vez)
export const CATEGORIA_AHORRO = 'Ahorro'; // sale del saldo hacia los ahorros
export const CATEGORIA_RETIRO = 'Retiro de ahorros'; // vuelve de los ahorros al saldo

type ConCategoria = { categoria?: string; nombre?: string; tipo: TipoMovimiento };
const nombreDe = (item: ConCategoria) => item.categoria ?? item.nombre;

export const esSaldoInicial = (item: ConCategoria) =>
  item.tipo === 'ingreso' && nombreDe(item) === CATEGORIA_SALDO_INICIAL;
export const esAhorro = (item: ConCategoria) =>
  item.tipo === 'gasto' && nombreDe(item) === CATEGORIA_AHORRO;
export const esRetiro = (item: ConCategoria) =>
  item.tipo === 'ingreso' && nombreDe(item) === CATEGORIA_RETIRO;
export const esCategoriaDelSistema = (item: ConCategoria) =>
  esSaldoInicial(item) || esAhorro(item) || esRetiro(item);

// Qué es realmente un movimiento: el ahorro sale del saldo pero NO es un gasto,
// y el saldo inicial o un retiro de ahorros entran al saldo pero NO son ingresos ganados
export type Clase = 'ingreso' | 'gasto' | 'ahorro' | 'retiro' | 'saldoInicial';
export function clasificar(item: ConCategoria): Clase {
  if (esAhorro(item)) return 'ahorro';
  if (esRetiro(item)) return 'retiro';
  if (esSaldoInicial(item)) return 'saldoInicial';
  return item.tipo;
}

// QUINCENAL = el 15 y el último día de cada mes
export type Frecuencia = 'DIARIA' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

// En la frecuencia mensual, el día 31 significa "el último día del mes" (28, 29, 30 o 31)
export const ULTIMO_DIA = 31;

export interface Movimiento {
  id: number;
  descripcion: string;
  monto: number;
  fecha: string; // AAAA-MM-DD
  tipo: TipoMovimiento;
  categoriaId: number;
  categoria: string; // nombre de la categoría
  automatico: boolean; // lo registró un movimiento automático (ej. el sueldo)
}

// Ingreso, gasto o ahorro que se registra solo cada día, semana o mes
export interface Recurrente {
  id: number;
  descripcion: string;
  monto: number;
  tipo: TipoMovimiento;
  categoriaId: number;
  categoria: string;
  frecuencia: Frecuencia;
  dia: number; // día del mes (frecuencia mensual)
  proximoCargo: string; // próxima fecha en que se registrará
  activo: boolean;
}

// Lo que se envía al crear o editar (el tipo lo define la categoría)
export interface DatosMovimiento {
  descripcion: string;
  monto: number;
  fecha: string;
  categoriaId: number;
}

export interface Categoria {
  id: number;
  nombre: string;
  tipo: TipoMovimiento;
}

// Plan de un mes: cuánto se quiere gastar como máximo y cuánto ahorrar
export interface PresupuestoMensual {
  anio: number;
  mes: number; // 1 a 12
  limiteGasto: number;
  ahorroObjetivo: number;
}

export interface Aporte {
  id: number;
  monto: number;
  fecha: string;
}

// Meta de ahorro con su avance (calculado por el backend a partir de los aportes)
export interface MetaAhorro {
  id: number;
  nombre: string;
  montoObjetivo: number;
  fechaLimite: string | null;
  ahorrado: number;
  faltante: number;
  porcentaje: number;
  aportes: Aporte[];
}

export interface DatosMeta {
  nombre: string;
  montoObjetivo: number;
  fechaLimite: string | null;
}

export type Rol = 'ADMIN' | 'USUARIO';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}
