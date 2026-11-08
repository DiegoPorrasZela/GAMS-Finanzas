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

export type Rol = 'ADMIN' | 'USUARIO';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}
