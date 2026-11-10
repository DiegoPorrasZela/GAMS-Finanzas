import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { DatosMovimiento, Frecuencia, Recurrente, TipoMovimiento } from '../models/finanzas.models';
import { AuthService } from './auth.service';
import { mensajeDeError } from './errores';

interface RecurrenteApi extends Omit<Recurrente, 'tipo'> {
  tipo: 'INGRESO' | 'GASTO';
}

const desdeApi = (r: RecurrenteApi): Recurrente => ({
  ...r,
  tipo: r.tipo.toLowerCase() as TipoMovimiento,
});

// Ingresos y gastos automáticos (sueldo, alquiler...). El backend los registra cuando llega su fecha.
@Injectable({ providedIn: 'root' })
export class RecurrentesService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/recurrentes`;

  private readonly lista = signal<Recurrente[]>([]);
  readonly recurrentes = this.lista.asReadonly();
  readonly error = signal<string | null>(null);

  constructor() {
    // Si cambia el usuario de la sesión, se descartan los datos del anterior
    const auth = inject(AuthService);
    let usuarioAnterior = auth.usuario()?.id;
    effect(() => {
      const usuario = auth.usuario()?.id;
      if (usuario !== usuarioAnterior) {
        usuarioAnterior = usuario;
        this.lista.set([]);
      }
    });
  }

  cargar(): void {
    this.error.set(null);
    this.http.get<RecurrenteApi[]>(this.api).subscribe({
      next: (datos) => this.lista.set(datos.map(desdeApi)),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  // datos.fecha es "desde": el primer registro es la primera fecha del calendario a partir de ese día.
  // dia: día del mes para la frecuencia mensual (31 = último día); si no se envía, se usa el de la fecha.
  crear(datos: DatosMovimiento, frecuencia: Frecuencia = 'MENSUAL', dia?: number): Observable<Recurrente> {
    return this.http.post<RecurrenteApi>(this.api, { ...datos, frecuencia, dia }).pipe(
      map(desdeApi),
      tap((nuevo) => this.lista.update((lista) => [...lista, nuevo])),
    );
  }

  cambiarEstado(recurrente: Recurrente, activo: boolean): Observable<Recurrente> {
    const { descripcion, monto, categoriaId } = recurrente;
    return this.http
      .put<RecurrenteApi>(`${this.api}/${recurrente.id}`, { descripcion, monto, categoriaId, activo })
      .pipe(
        map(desdeApi),
        tap((editado) =>
          this.lista.update((lista) => lista.map((r) => (r.id === editado.id ? editado : r))),
        ),
      );
  }

  eliminar(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/${id}`)
      .pipe(tap(() => this.lista.update((lista) => lista.filter((r) => r.id !== id))));
  }
}
