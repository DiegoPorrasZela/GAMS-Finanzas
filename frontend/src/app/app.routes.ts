import { Routes } from '@angular/router';
import { adminGuard, autenticadoGuard, invitadoGuard } from './guards/auth.guards';
import { Acerca } from './pages/acerca/acerca';
import { Admin } from './pages/admin/admin';
import { Inicio } from './pages/inicio/inicio';
import { Login } from './pages/login/login';
import { Movimientos } from './pages/movimientos/movimientos';
import { Registro } from './pages/registro/registro';
import { TipoCambio } from './pages/tipo-cambio/tipo-cambio';

export const routes: Routes = [
  // Solo sin sesión
  { path: 'login', component: Login, canActivate: [invitadoGuard], title: 'Iniciar sesión | GAMS Finanzas' },
  { path: 'registro', component: Registro, canActivate: [invitadoGuard], title: 'Crear cuenta | GAMS Finanzas' },

  // Requieren sesión
  { path: '', component: Inicio, canActivate: [autenticadoGuard], title: 'Inicio | GAMS Finanzas' },
  {
    path: 'movimientos',
    component: Movimientos,
    canActivate: [autenticadoGuard],
    title: 'Movimientos | GAMS Finanzas',
  },

  // Solo administradores
  {
    path: 'admin',
    component: Admin,
    canActivate: [autenticadoGuard, adminGuard],
    title: 'Administración | GAMS Finanzas',
  },

  // Públicas
  { path: 'tipo-cambio', component: TipoCambio, title: 'Tipo de Cambio | GAMS Finanzas' },
  { path: 'acerca', component: Acerca, title: 'Acerca | GAMS Finanzas' },
  { path: '**', redirectTo: '' },
];
