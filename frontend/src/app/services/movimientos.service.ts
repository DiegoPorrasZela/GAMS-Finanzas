import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DatosMovimiento,
  Movimiento,
  MonedaExtranjera,
  TipoMovimiento,
  clasificar,
} from '../models/finanzas.models';
import { AuthService } from './auth.service';
import { mensajeDeError } from './errores';

// Así llega un movimiento desde el backend (tipo en mayúsculas)
interface MovimientoApi extends Omit<Movimiento, 'tipo' | 'monedaOriginal' | 'montoOriginal'> {
  tipo: 'INGRESO' | 'GASTO';
  monedaOriginal?: MonedaExtranjera | null;
  montoOriginal?: number | null;
}

const desdeApi = (m: MovimientoApi): Movimiento => ({
  ...m,
  tipo: m.tipo.toLowerCase() as TipoMovimiento,
  monedaOriginal: m.monedaOriginal ?? null,
  montoOriginal: m.montoOriginal ?? null,
});

// Segundos que se puede deshacer una eliminación
export const SEGUNDOS_PARA_DESHACER = 5;

// Totales de una lista (se usa en Inicio, Movimientos y Metas):
// - ingresos: lo ganado (sin saldo inicial ni retiros de ahorros)
// - gastos: lo consumido (sin lo que se separó a ahorros)
// - ahorro: lo separado a ahorros menos lo retirado
// - saldo: cómo cambió el dinero disponible (todo lo que entró menos todo lo que salió)
export function calcularTotales(lista: Movimiento[]) {
  let ingresos = 0;
  let gastos = 0;
  let ahorro = 0;
  let saldo = 0;
  for (const m of lista) {
    saldo += m.tipo === 'ingreso' ? m.monto : -m.monto;
    switch (clasificar(m)) {
      case 'ingreso':
        ingresos += m.monto;
        break;
      case 'gasto':
        gastos += m.monto;
        break;
      case 'ahorro':
        ahorro += m.monto;
        break;
      case 'retiro':
        ahorro -= m.monto;
        break;
    }
  }
  return { ingresos, gastos, ahorro, saldo };
}

interface EliminacionPendiente {
  temporizador: ReturnType<typeof setTimeout>;
  alFallar: (error: unknown) => void;
}

// CRUD de movimientos contra el backend. Mantiene una copia local en una signal
// para que Inicio y Movimientos se actualicen solos al agregar, editar o eliminar.
@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/movimientos`;

  private readonly lista = signal<Movimiento[]>([]);
  private duenoDeLaLista: number | null = null;

  // Eliminaciones que esperan unos segundos por si el usuario las deshace (ver eliminarConDeshacer)
  private readonly pendientes = new Map<number, EliminacionPendiente>();
  private readonly ocultos = signal<ReadonlySet<number>>(new Set());

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  // Siempre del más reciente al más antiguo (sin los que se están eliminando)
  readonly movimientos = computed(() => {
    const ocultos = this.ocultos();
    return this.lista()
      .filter((m) => !ocultos.has(m.id))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  });

  constructor() {
    // Al cerrar sesión o cerrar la pestaña, lo que esperaba el "Deshacer" se elimina de una vez
    this.auth.alCerrarSesion(() => this.confirmarPendientes());
    if (typeof window !== 'undefined') {
      const alSalir = () => this.confirmarPendientes();
      window.addEventListener('pagehide', alSalir);
      inject(DestroyRef).onDestroy(() => window.removeEventListener('pagehide', alSalir));
    }
  }

  cargar(): void {
    const usuarioId = this.auth.usuario()?.id ?? null;
    if (usuarioId !== this.duenoDeLaLista) {
      // Cambió el usuario: no mostrar ni por un instante los datos del anterior
      this.lista.set([]);
      this.duenoDeLaLista = usuarioId;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.http.get<MovimientoApi[]>(this.api).subscribe({
      next: (datos) => {
        this.lista.set(datos.map(desdeApi));
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  agregar(datos: DatosMovimiento): Observable<Movimiento> {
    return this.http.post<MovimientoApi>(this.api, datos).pipe(
      map(desdeApi),
      tap((nuevo) => this.lista.update((lista) => [...lista, nuevo])),
    );
  }

  actualizar(id: number, datos: DatosMovimiento): Observable<Movimiento> {
    return this.http.put<MovimientoApi>(`${this.api}/${id}`, datos).pipe(
      map(desdeApi),
      tap((editado) => this.lista.update((lista) => lista.map((m) => (m.id === id ? editado : m)))),
    );
  }

  /**
   * Patrón "Deshacer": el movimiento desaparece de la lista al instante, pero recién se elimina
   * en el servidor pasados unos segundos. Devuelve la función que lo deshace.
   * Si el servidor rechaza la eliminación (ej. ese ahorro ya está en una meta), vuelve a aparecer.
   */
  eliminarConDeshacer(
    id: number,
    alFallar: (error: unknown) => void,
    segundos = SEGUNDOS_PARA_DESHACER,
  ): () => void {
    this.cancelarPendiente(id);
    this.ocultar(id);
    this.pendientes.set(id, {
      temporizador: setTimeout(() => this.enviarEliminacion(id), segundos * 1000),
      alFallar,
    });
    return () => {
      if (this.cancelarPendiente(id)) this.mostrar(id);
    };
  }

  // Envía ya las eliminaciones que esperaban el "Deshacer"
  confirmarPendientes(): void {
    for (const id of [...this.pendientes.keys()]) this.enviarEliminacion(id);
  }

  private enviarEliminacion(id: number): void {
    const pendiente = this.pendientes.get(id);
    if (!pendiente) return;
    clearTimeout(pendiente.temporizador);
    this.pendientes.delete(id);
    // keepalive: la petición termina aunque el usuario cierre la pestaña justo en ese momento
    this.http.delete<void>(`${this.api}/${id}`, { keepalive: true }).subscribe({
      next: () => {
        this.lista.update((lista) => lista.filter((m) => m.id !== id));
        this.mostrar(id);
      },
      error: (e) => {
        this.mostrar(id);
        pendiente.alFallar(e);
      },
    });
  }

  private cancelarPendiente(id: number): boolean {
    const pendiente = this.pendientes.get(id);
    if (!pendiente) return false;
    clearTimeout(pendiente.temporizador);
    this.pendientes.delete(id);
    return true;
  }

  private ocultar(id: number): void {
    this.ocultos.update((ocultos) => new Set(ocultos).add(id));
  }

  private mostrar(id: number): void {
    this.ocultos.update((ocultos) => {
      const copia = new Set(ocultos);
      copia.delete(id);
      return copia;
    });
  }
}
