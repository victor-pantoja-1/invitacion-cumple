import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/invitation/invitation.component').then((m) => m.InvitationComponent),
  },
  {
    path: 'i/:token',
    loadComponent: () => import('./features/invitation/invitation.component').then((m) => m.InvitationComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: '' },
];
