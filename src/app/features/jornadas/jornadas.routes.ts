import { Routes } from '@angular/router';

export const JORNADAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./presentation/jornadas-list.page').then((m) => m.JornadasListPage),
  },
];
