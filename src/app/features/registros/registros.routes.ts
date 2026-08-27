import { Routes } from '@angular/router';

export const REGISTROS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./presentation/registros-list.page').then((m) => m.RegistrosListPage),
  },
];
