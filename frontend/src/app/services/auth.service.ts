import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario } from '../models/finanzas.models';

// Respuesta del backend al iniciar sesión o registrarse
interface Sesion {
  token: string;
  expiraEn: string; // fecha ISO en la que vence el token
  usuario: Usuario;
}

const CLAVE = 'gams-sesion';

// Maneja la sesión: guarda el token JWT y los datos del usuario mientras el token siga vigente
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/auth`;

  private readonly sesion = signal<Sesion | null>(leerSesionGuardada());

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly token = computed(() => this.sesion()?.token ?? null);
  readonly esAdmin = computed(() => this.usuario()?.rol === 'ADMIN');

  login(email: string, password: string): Observable<Usuario> {
    return this.http.post<Sesion>(`${this.api}/login`, { email, password }).pipe(
      tap((sesion) => this.guardar(sesion)),
      map((sesion) => sesion.usuario),
    );
  }

  registrar(nombre: string, email: string, password: string): Observable<Usuario> {
    return this.http.post<Sesion>(`${this.api}/registro`, { nombre, email, password }).pipe(
      tap((sesion) => this.guardar(sesion)),
      map((sesion) => sesion.usuario),
    );
  }

  // Tareas que deben terminar mientras el token sigue vigente (patrón Observer).
  // Ej.: MovimientosService envía las eliminaciones que esperaban el "Deshacer".
  private readonly antesDeCerrar: Array<() => void> = [];

  alCerrarSesion(tarea: () => void): void {
    this.antesDeCerrar.push(tarea);
  }

  cerrarSesion(): void {
    for (const tarea of this.antesDeCerrar) tarea();
    this.sesion.set(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      // Si no se puede borrar, igual la sesión ya no está en memoria
    }
  }

  // true si hay sesión y el token no venció; si venció, cierra la sesión
  sesionVigente(): boolean {
    const sesion = this.sesion();
    if (!sesion) return false;
    if (estaVencida(sesion)) {
      this.cerrarSesion();
      return false;
    }
    return true;
  }

  private guardar(sesion: Sesion): void {
    this.sesion.set(sesion);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(sesion));
    } catch {
      // Sin localStorage la sesión dura mientras la pestaña esté abierta
    }
  }
}

function estaVencida(sesion: Sesion): boolean {
  return new Date(sesion.expiraEn).getTime() <= Date.now();
}

function leerSesionGuardada(): Sesion | null {
  try {
    const texto = localStorage.getItem(CLAVE);
    if (!texto) return null;
    const sesion: Sesion = JSON.parse(texto);
    return estaVencida(sesion) ? null : sesion;
  } catch {
    return null;
  }
}
