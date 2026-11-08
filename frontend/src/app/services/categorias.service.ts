import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Categoria, TipoMovimiento } from '../models/finanzas.models';
import { mensajeDeError } from './errores';

interface CategoriaApi {
  id: number;
  nombre: string;
  tipo: 'INGRESO' | 'GASTO';
}

const desdeApi = (c: CategoriaApi): Categoria => ({
  ...c,
  tipo: c.tipo.toLowerCase() as TipoMovimiento,
});

const ordenar = (lista: Categoria[]) =>
  [...lista].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre, 'es'));

// Todos ven las categorías; crear, editar y eliminar solo lo permite el backend a ADMIN
@Injectable({ providedIn: 'root' })
export class CategoriasService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/categorias`;

  private readonly lista = signal<Categoria[]>([]);
  readonly categorias = this.lista.asReadonly();
  readonly error = signal<string | null>(null);

  cargar(): void {
    this.error.set(null);
    this.http.get<CategoriaApi[]>(this.api).subscribe({
      next: (datos) => this.lista.set(ordenar(datos.map(desdeApi))),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  crear(nombre: string, tipo: TipoMovimiento): Observable<Categoria> {
    return this.http.post<CategoriaApi>(this.api, { nombre, tipo: tipo.toUpperCase() }).pipe(
      map(desdeApi),
      tap((nueva) => this.lista.update((lista) => ordenar([...lista, nueva]))),
    );
  }

  actualizar(id: number, nombre: string, tipo: TipoMovimiento): Observable<Categoria> {
    return this.http
      .put<CategoriaApi>(`${this.api}/${id}`, { nombre, tipo: tipo.toUpperCase() })
      .pipe(
        map(desdeApi),
        tap((editada) =>
          this.lista.update((lista) => ordenar(lista.map((c) => (c.id === id ? editada : c)))),
        ),
      );
  }

  eliminar(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/${id}`)
      .pipe(tap(() => this.lista.update((lista) => lista.filter((c) => c.id !== id))));
  }
}
