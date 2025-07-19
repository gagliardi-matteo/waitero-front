import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class AuthContextService {
  private token: string | null = null;
  private restaurantId: string | null = null;
  private tableId: string | null = null;

  setContext(token: string, restaurantId: string, tableId: string) {
    this.token = token;
    this.restaurantId = restaurantId;
    this.tableId = tableId;

    sessionStorage.setItem('authToken', token);
    sessionStorage.setItem('restaurantId', restaurantId);
    sessionStorage.setItem('tableId', tableId);
  }

  get tokenValue(): string | null {
    return this.token ?? sessionStorage.getItem('authToken');
  }

  get restaurantIdValue(): string | null {
    return this.restaurantId ?? sessionStorage.getItem('restaurantId');
  }

  get tableIdValue(): string | null {
    return this.tableId ?? sessionStorage.getItem('tableId');
  }

  clear() {
    this.token = null;
    this.restaurantId = null;
    this.tableId = null;
    sessionStorage.clear();
  }
}
