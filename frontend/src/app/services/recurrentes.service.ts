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

  // La fecha es la del primer registro y define el día en que se repite (del mes o de la semana)
  crear(datos: DatosMovimiento, frecuencia: Frecuencia = 'MENSUAL'): Observable<Recurrente> {
    return this.http.post<RecurrenteApi>(this.api, { ...datos, frecuencia }).pipe(
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
