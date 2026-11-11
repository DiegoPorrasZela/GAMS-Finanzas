import { Routes } from '@angular/router';
import { adminGuard, autenticadoGuard, invitadoGuard } from './guards/auth.guards';

// Carga diferida (lazy loading): cada página se descarga recién cuando se visita.
// Así la primera carga es más liviana, sobre todo en el celular.
export const routes: Routes = [
  // Solo sin sesión
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [invitadoGuard],
    title: 'Iniciar sesión | GAMS Finanzas',
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
    canActivate: [invitadoGuard],
    title: 'Crear cuenta | GAMS Finanzas',
  },

  // Requieren sesión
  {
    path: '',
    loadComponent: () => import('./pages/inicio/inicio').then((m) => m.Inicio),
    canActivate: [autenticadoGuard],
    title: 'Inicio | GAMS Finanzas',
  },
  {
    path: 'movimientos',
    loadComponent: () => import('./pages/movimientos/movimientos').then((m) => m.Movimientos),
    canActivate: [autenticadoGuard],
    title: 'Movimientos | GAMS Finanzas',
  },
  {
    path: 'metas',
    loadComponent: () => import('./pages/metas/metas').then((m) => m.Metas),
    canActivate: [autenticadoGuard],
    title: 'Metas de ahorro | GAMS Finanzas',
  },

  // Solo administradores
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    canActivate: [autenticadoGuard, adminGuard],
    title: 'Administración | GAMS Finanzas',
  },

  // Públicas
  {
    path: 'tipo-cambio',
    loadComponent: () => import('./pages/tipo-cambio/tipo-cambio').then((m) => m.TipoCambio),
    title: 'Tipo de Cambio | GAMS Finanzas',
  },
  {
    path: 'acerca',
    loadComponent: () => import('./pages/acerca/acerca').then((m) => m.Acerca),
    title: 'Acerca | GAMS Finanzas',
  },
  { path: '**', redirectTo: '' },
];
