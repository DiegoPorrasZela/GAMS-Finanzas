import { Injectable, computed, signal } from '@angular/core';

export type TipoMovimiento = 'ingreso' | 'gasto';

export interface Movimiento {
  id: number;
  descripcion: string;
  categoria: string;
  monto: number;
  tipo: TipoMovimiento;
  fecha: string; // AAAA-MM-DD
}

export const CATEGORIAS: Record<TipoMovimiento, string[]> = {
  ingreso: ['Sueldo', 'Mesada', 'Freelance', 'Venta', 'Otros'],
  gasto: ['Comida', 'Transporte', 'Servicios', 'Educación', 'Salud', 'Ocio', 'Compras', 'Otros'],
};

// Suma ingresos, gastos y saldo de una lista (se usa en Inicio y en Movimientos)
export function calcularTotales(lista: Movimiento[]) {
  const sumar = (tipo: TipoMovimiento) =>
    lista.filter((m) => m.tipo === tipo).reduce((total, m) => total + m.monto, 0);
  const ingresos = sumar('ingreso');
  const gastos = sumar('gasto');
  return { ingresos, gastos, saldo: ingresos - gastos };
}

const CLAVE = 'gams-movimientos';

// Datos de ejemplo hasta que exista el backend (Avance 2)
const EJEMPLO: Movimiento[] = [
  {
    id: 1,
    descripcion: 'Pago de prácticas',
    categoria: 'Sueldo',
    monto: 1500,
    tipo: 'ingreso',
    fecha: '2026-09-20',
  },
  {
    id: 2,
    descripcion: 'Menú del almuerzo',
    categoria: 'Comida',
    monto: 15,
    tipo: 'gasto',
    fecha: '2026-09-19',
  },
  {
    id: 3,
    descripcion: 'Recarga de tarjeta de bus',
    categoria: 'Transporte',
    monto: 30,
    tipo: 'gasto',
    fecha: '2026-09-18',
  },
  {
    id: 4,
    descripcion: 'Plan de celular',
    categoria: 'Servicios',
    monto: 45,
    tipo: 'gasto',
    fecha: '2026-09-15',
  },
  {
    id: 5,
    descripcion: 'Salida al cine',
    categoria: 'Ocio',
    monto: 160,
    tipo: 'gasto',
    fecha: '2026-09-12',
  },
  {
    id: 6,
    descripcion: 'Libro de cálculo',
    categoria: 'Educación',
    monto: 85,
    tipo: 'gasto',
    fecha: '2026-09-08',
  },
  {
    id: 7,
    descripcion: 'Diseño de logo',
    categoria: 'Freelance',
    monto: 250,
    tipo: 'ingreso',
    fecha: '2026-09-05',
  },
];

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private readonly lista = signal<Movimiento[]>(this.leer());

  // Siempre del más reciente al más antiguo
  readonly movimientos = computed(() =>
    [...this.lista()].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id),
  );

  agregar(datos: Omit<Movimiento, 'id'>): void {
    const id = Math.max(0, ...this.lista().map((m) => m.id)) + 1;
    this.lista.update((lista) => [...lista, { ...datos, id }]);
    this.guardar();
  }

  eliminar(id: number): void {
    this.lista.update((lista) => lista.filter((m) => m.id !== id));
    this.guardar();
  }

  restablecer(): void {
    this.lista.set(EJEMPLO);
    this.guardar();
  }

  // localStorage puede fallar (modo privado, almacenamiento bloqueado): en ese caso usamos el ejemplo
  private leer(): Movimiento[] {
    try {
      const texto = localStorage.getItem(CLAVE);
      return texto ? JSON.parse(texto) : EJEMPLO;
    } catch {
      return EJEMPLO;
    }
  }

  private guardar(): void {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(this.lista()));
    } catch {
      // Si no se puede guardar, los datos siguen en memoria mientras la página esté abierta
    }
  }
}
