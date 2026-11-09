// Tipos que usa toda la aplicación. El backend envía el tipo en mayúsculas (INGRESO/GASTO);
// los servicios lo convierten a minúsculas para usarlo en las pantallas.

export type TipoMovimiento = 'ingreso' | 'gasto';

export interface Movimiento {
  id: number;
  descripcion: string;
  monto: number;
  fecha: string; // AAAA-MM-DD
  tipo: TipoMovimiento;
  categoriaId: number;
  categoria: string; // nombre de la categoría
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
