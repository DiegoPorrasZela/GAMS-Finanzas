import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Forma de cada elemento que devuelve Frankfurter v2 en /rates
export interface Tasa {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

// Forma de cada elemento que devuelve Frankfurter v2 en /currencies
export interface Moneda {
  iso_code: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class TipoCambioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://api.frankfurter.dev/v2';

  obtenerMonedas(): Observable<Moneda[]> {
    return this.http.get<Moneda[]>(`${this.apiUrl}/currencies`);
  }

  // Tasas de una moneda a otra desde la fecha indicada hasta hoy (la última es la de hoy)
  obtenerTasas(base: string, destino: string, desde: string): Observable<Tasa[]> {
    return this.http.get<Tasa[]>(`${this.apiUrl}/rates`, {
      params: { base, quotes: destino, from: desde },
    });
  }
}
