import { Component } from '@angular/core';
import { AuthService } from '../../auth/AuthService';
import { NgIf, CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [NgIf, CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {

  constructor(public authService: AuthService) {}

  isLoggedIn(): boolean {
    return this.authService.isAuthenticated();
  }
}
