import { Signal, computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, startWith, switchMap, tap } from 'rxjs';
import { Moneda, MonedaExtranjera } from '../models/finanzas.models';
import { sumarDias } from '../utils/fechas';

// Forma de cada elemento que devuelve Frankfurter v2 en /rates
export interface Tasa {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

// Forma de cada elemento que devuelve Frankfurter v2 en /currencies
export interface MonedaApi {
  iso_code: string;
  name: string;
  type: 'currency' | 'crypto' | 'metal'; // la API también trae criptomonedas y metales
}

// Cuántos soles vale 1 unidad de la moneda, y de qué día es esa tasa
export interface TasaEnSoles {
  tasa: number;
  fecha: string;
}

@Injectable({ providedIn: 'root' })
export class TipoCambioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://api.frankfurter.dev/v2';
  // Una tasa de un día no cambia: se pide una sola vez por moneda y fecha
  private readonly cache = new Map<string, Observable<TasaEnSoles>>();

  obtenerMonedas(): Observable<MonedaApi[]> {
    return this.http.get<MonedaApi[]>(`${this.apiUrl}/currencies`);
  }

  // Tasas de una moneda a otra desde la fecha indicada hasta hoy (la última es la de hoy)
  obtenerTasas(base: string, destino: string, desde: string): Observable<Tasa[]> {
    return this.http.get<Tasa[]>(`${this.apiUrl}/rates`, {
      params: { base, quotes: destino, from: desde },
    });
  }

  // Tasa en soles del día indicado. Los fines de semana y feriados no hay tasa nueva,
  // así que se pide la última semana y se usa la más reciente hasta esa fecha.
  tasaEnSoles(moneda: MonedaExtranjera, fecha: string): Observable<TasaEnSoles> {
    const clave = `${moneda}|${fecha}`;
    const guardada = this.cache.get(clave);
    if (guardada) return guardada;

    const pedido = this.http
      .get<Tasa[]>(`${this.apiUrl}/rates`, {
        params: { base: moneda, quotes: 'PEN', from: sumarDias(fecha, -7), to: fecha },
      })
      .pipe(
        map((tasas) => {
          const ultima = tasas.filter((t) => t.quote === 'PEN').at(-1);
          if (!ultima) throw new Error(`Sin tipo de cambio de ${moneda} para ${fecha}`);
          return { tasa: ultima.rate, fecha: ultima.date };
        }),
        tap({ error: () => this.cache.delete(clave) }), // si falla, se vuelve a intentar la próxima vez
        shareReplay(1),
      );
    this.cache.set(clave, pedido);
    return pedido;
  }
}

export type EstadoConversion =
  | { estado: 'soles' }
  | { estado: 'cargando' }
  | { estado: 'lista'; tasa: number; fecha: string }
  | { estado: 'error' };

/**
 * Conversión a soles que sigue a la moneda y la fecha elegidas en un formulario.
 * Debe llamarse al crear el componente (usa inject). Si cambia la moneda o la fecha,
 * descarta el pedido anterior y busca la nueva tasa.
 */
export function conversionASoles(
  moneda: Signal<Moneda>,
  fecha: Signal<string>,
): Signal<EstadoConversion> {
  const servicio = inject(TipoCambioService);
  const pedido = computed(() => ({ moneda: moneda(), fecha: fecha() }), {
    equal: (a, b) => a.moneda === b.moneda && a.fecha === b.fecha,
  });
  return toSignal(
    toObservable(pedido).pipe(
      switchMap(({ moneda, fecha }) =>
        moneda === 'PEN' || !fecha
          ? of<EstadoConversion>({ estado: 'soles' })
          : servicio.tasaEnSoles(moneda, fecha).pipe(
              map((t): EstadoConversion => ({ estado: 'lista', ...t })),
              startWith<EstadoConversion>({ estado: 'cargando' }),
              catchError(() => of<EstadoConversion>({ estado: 'error' })),
            ),
      ),
    ),
    { initialValue: { estado: 'soles' } },
  );
}

// Monto en soles con 2 decimales
export const aSoles = (monto: number, tasa: number) => Math.round(monto * tasa * 100) / 100;
