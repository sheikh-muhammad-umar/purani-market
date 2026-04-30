import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { homeSeoResolver } from '../../core/resolvers/seo.resolver';

export const HOME_ROUTES: Routes = [
  { path: '', component: HomeComponent, resolve: { seo: homeSeoResolver } },
];
