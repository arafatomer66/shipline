import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/projects-list.page').then(m => m.ProjectsListPage) },
  { path: 'p/:id', loadComponent: () => import('./pages/project.page').then(m => m.ProjectPage) },
];
