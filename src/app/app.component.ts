import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SidebarComponent } from './util/sidebar/sidebar.component';
import { AuthService } from './auth/AuthService';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

  showSidebar(): boolean {
    const url = this.router.url.toLowerCase();
    return this.isLoggedIn() && !(url === '/menu' || url.startsWith('/menu/'));
  }
}
