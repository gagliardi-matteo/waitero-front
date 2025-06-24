import { Component } from '@angular/core';
import { AuthService } from '../../auth/AuthService';
import { NgIf, NgFor, CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  imports: [NgIf, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {

  constructor(public authService: AuthService) {}

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }

}
