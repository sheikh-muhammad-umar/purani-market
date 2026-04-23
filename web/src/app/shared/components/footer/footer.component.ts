import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '../../../core/constants/routes';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class FooterComponent {
  readonly ROUTES = ROUTES;
  year = new Date().getFullYear();
}
