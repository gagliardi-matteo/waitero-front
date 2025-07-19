import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthContextService } from '../../services/auth-context.service';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-access',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './access.component.html',
  styleUrl: './access.component.scss'
})
export class AccessComponent implements OnInit{

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthContextService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    const restaurantId = this.route.snapshot.paramMap.get('restaurantId');
    const tableId = this.route.snapshot.paramMap.get('tableId');
    if (!token) {
      this.router.navigate(['/errore']);
      return;
    }

    if (!restaurantId || !tableId || !token) return;
    
    this.http.post<{ valid: boolean }>(`${environment.apiUrl}/customer/validate-token`, {
      token, restaurantId, tableId
    }).subscribe(res => {
      if (!res.valid) {
        this.router.navigate(['/errore']);
        return;
      }

      this.auth.setContext(token, restaurantId, tableId);

      // 🔁 Pulizia URL
      this.router.navigate(['/menu'], { replaceUrl: true });
    });
  }

}
