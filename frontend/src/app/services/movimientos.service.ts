import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DatosMovimiento,
  Movimiento,
  TipoMovimiento,
  clasificar,
} from '../models/finanzas.models';
import { AuthService } from './auth.service';
import { mensajeDeError } from './errores';

// Así llega un movimiento desde el backend (tipo en mayúsculas)
interface MovimientoApi extends Omit<Movimiento, 'tipo'> {
  tipo: 'INGRESO' | 'GASTO';
}

const desdeApi = (m: MovimientoApi): Movimiento => ({
  ...m,
  tipo: m.tipo.toLowerCase() as TipoMovimiento,
});

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

// CRUD de movimientos contra el backend. Mantiene una copia local en una signal
// para que Inicio y Movimientos se actualicen solos al agregar, editar o eliminar.
@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/movimientos`;

  private readonly lista = signal<Movimiento[]>([]);
  private duenoDeLaLista: number | null = null;

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  // Siempre del más reciente al más antiguo
  readonly movimientos = computed(() =>
    [...this.lista()].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id),
  );

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

  eliminar(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/${id}`)
      .pipe(tap(() => this.lista.update((lista) => lista.filter((m) => m.id !== id))));
  }
}
