import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { DatosMeta, MetaAhorro } from '../models/finanzas.models';
import { AuthService } from './auth.service';
import { mensajeDeError } from './errores';

// Metas de ahorro y sus aportes. El backend devuelve cada meta con su avance ya calculado.
@Injectable({ providedIn: 'root' })
export class MetasService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/metas`;

  private readonly lista = signal<MetaAhorro[]>([]);
  readonly metas = this.lista.asReadonly();
  readonly cargando = signal(false);
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
    this.cargando.set(true);
    this.error.set(null);
    this.http.get<MetaAhorro[]>(this.api).subscribe({
      next: (datos) => {
        this.lista.set(datos);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  crear(datos: DatosMeta): Observable<MetaAhorro> {
    return this.http
      .post<MetaAhorro>(this.api, datos)
      .pipe(tap((nueva) => this.lista.update((lista) => [...lista, nueva])));
  }

  actualizar(id: number, datos: DatosMeta): Observable<MetaAhorro> {
    return this.http
      .put<MetaAhorro>(`${this.api}/${id}`, datos)
      .pipe(tap((meta) => this.reemplazar(meta)));
  }

  eliminar(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/${id}`)
      .pipe(tap(() => this.lista.update((lista) => lista.filter((m) => m.id !== id))));
  }

  aportar(id: number, datos: { monto: number; fecha: string }): Observable<MetaAhorro> {
    return this.http
      .post<MetaAhorro>(`${this.api}/${id}/aportes`, datos)
      .pipe(tap((meta) => this.reemplazar(meta)));
  }

  quitarAporte(id: number, aporteId: number): Observable<MetaAhorro> {
    return this.http
      .delete<MetaAhorro>(`${this.api}/${id}/aportes/${aporteId}`)
      .pipe(tap((meta) => this.reemplazar(meta)));
  }

  private reemplazar(meta: MetaAhorro): void {
    this.lista.update((lista) => lista.map((m) => (m.id === meta.id ? meta : m)));
  }
}
