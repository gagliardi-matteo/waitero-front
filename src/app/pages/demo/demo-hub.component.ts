import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { catchError, of, switchMap } from 'rxjs';
import { DemoContextService } from '../../services/demo-context.service';
import { DemoSession, DemoSessionService } from '../../services/demo-session.service';
import { environment } from '../../../environments/environment';

@Component({selector:'app-demo-hub',standalone:true,imports:[CommonModule,RouterLink],templateUrl:'./demo-hub.component.html',styleUrl:'./demo.component.scss'})
export class DemoHubComponent implements OnInit {
  private sessions=inject(DemoSessionService); private context=inject(DemoContextService);
  session:DemoSession|null=null; qr=''; loading=true; error='';
  ngOnInit():void { const token=this.context.token; (token?this.sessions.current(token).pipe(catchError(()=>this.sessions.create())):this.sessions.create()).subscribe({next:s=>{this.session=s;this.loading=false;void this.makeQr(s);},error:()=>{this.loading=false;this.error='Non è stato possibile avviare la demo. Riprova tra poco.';}}); }
  restart():void { this.loading=true;this.sessions.create().subscribe({next:s=>{this.session=s;this.loading=false;void this.makeQr(s);},error:()=>this.loading=false}); }
  private async makeQr(s:DemoSession):Promise<void>{const configured=(environment as {publicFrontendUrl?:string}).publicFrontendUrl?.replace(/\/+$/,'');const origin=typeof window!=='undefined'?window.location.origin:'';const base=configured||origin;this.qr=await QRCode.toDataURL(`${base}/demo/cliente?s=${encodeURIComponent(s.token)}`,{width:420,margin:2,color:{dark:'#202329',light:'#ffffff'}});}
}
