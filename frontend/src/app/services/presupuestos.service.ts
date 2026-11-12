import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { PresupuestoMensual } from '../models/finanzas.models';
import { AuthService } from './auth.service';
import { mensajeDeError } from './errores';

// Presupuesto y meta de ahorro de cada mes del usuario
@Injectable({ providedIn: 'root' })
export class PresupuestosService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/presupuestos`;

  private readonly lista = signal<PresupuestoMensual[]>([]);
  readonly presupuestos = this.lista.asReadonly();
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
    this.http.get<PresupuestoMensual[]>(this.api).subscribe({
      next: (datos) => this.lista.set(datos),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  // Crea el presupuesto del mes o lo actualiza si ya existía
  guardar(
    anio: number,
    mes: number,
    datos: { limiteGasto: number; ahorroObjetivo: number },
  ): Observable<PresupuestoMensual> {
    return this.http
      .put<PresupuestoMensual>(`${this.api}/${anio}/${mes}`, datos)
      .pipe(
        tap((guardado) =>
          this.lista.update((lista) => [
            guardado,
            ...lista.filter((p) => p.anio !== anio || p.mes !== mes),
          ]),
        ),
      );
  }

  eliminar(anio: number, mes: number): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/${anio}/${mes}`)
      .pipe(
        tap(() =>
          this.lista.update((lista) => lista.filter((p) => p.anio !== anio || p.mes !== mes)),
        ),
      );
  }
}
