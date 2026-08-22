import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MenuComponent } from '../menu/menu.component';
import { DemoBannerComponent } from './demo-banner.component';
import { DemoSession, DemoSessionService } from '../../services/demo-session.service';
import { AuthContextService } from '../../services/auth-context.service';
import { DeviceIdService } from '../../services/device-id.service';

@Component({selector:'app-demo-client-page',standalone:true,imports:[CommonModule,RouterLink,MenuComponent,DemoBannerComponent],template:`<app-demo-banner/><div *ngIf="loading" class="demo-state">Caricamento menu demo…</div><section *ngIf="expired" class="demo-expired"><h1>La demo è terminata</h1><p>Avvia una nuova sessione per continuare a provare WaiterO.</p><a routerLink="/demo">Avvia nuova demo</a></section><app-menu *ngIf="session"/>`,styleUrl:'./demo.component.scss'})
export class DemoClientPageComponent implements OnInit { private route=inject(ActivatedRoute);private sessions=inject(DemoSessionService);private auth=inject(AuthContextService);private devices=inject(DeviceIdService);session:DemoSession|null=null;loading=true;expired=false;
 ngOnInit():void{const token=this.route.snapshot.queryParamMap.get('s');this.sessions.current(token).subscribe({next:s=>{this.auth.setContext(s.token,String(s.restaurantId),String(s.tableId),this.devices.getOrCreate(),null,s.tablePublicId,false);this.session=s;this.loading=false;},error:()=>{this.loading=false;this.expired=true;}});}}
