import { Routes } from '@angular/router';
import { Inicio } from './pages/inicio/inicio';
import { Movimientos } from './pages/movimientos/movimientos';
import { Acerca } from './pages/acerca/acerca';
import { TipoCambio } from './pages/tipo-cambio/tipo-cambio';

export const routes: Routes = [
  { path: '', component: Inicio, title: 'Inicio | GAMS Finanzas' },
  { path: 'movimientos', component: Movimientos, title: 'Movimientos | GAMS Finanzas' },
  { path: 'acerca', component: Acerca, title: 'Acerca | GAMS Finanzas' },
  { path: 'tipo-cambio', component: TipoCambio, title: 'Tipo de Cambio | GAMS Finanzas' },
  { path: '**', redirectTo: '' },
];
