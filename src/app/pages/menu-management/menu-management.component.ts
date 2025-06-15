import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SidebarComponent } from '../../util/sidebar/sidebar.component';

@Component({
  selector: 'app-menu-management',
  imports: [CommonModule],
  templateUrl: './menu-management.component.html',
  styleUrl: './menu-management.component.scss',
})
export class MenuManagementComponent {
  mockMenu = [
    {
      name: 'Lasagna',
      category: 'Primi',
      price: 12,
      imageUrl: 'https://www.antoniettapolcaro.it/wp-content/uploads/2024/05/Lasagna-alla-napoletana_2022-scaled-2.jpg'
    },
    {
      name: 'Tagliatelle al Ragù',
      category: 'Primi',
      price: 11,
      imageUrl: 'https://www.cucchiaio.it/content/dam/cucchiaio/it/ricette/2009/11/ricetta-tagliatelle-bolognese/tagliatelle-alla-bolognese-ante.jpg'
    },
    {
      name: 'Risotto ai Funghi',
      category: 'Primi',
      price: 13,
      imageUrl: 'https://www.elviradolciecucina.it/wp-content/uploads/2018/12/risotto-funghi-e-fonduta-orizz-logo.jpg'
    },
    {
      name: 'Carbonara',
      category: 'Primi',
      price: 12,
      imageUrl: 'https://www.informacibo.it/wp-content/uploads/2018/04/carbonara.jpg'
    },
    {
      name: 'Genovese',
      category: 'Primi',
      price: 11,
      imageUrl: 'https://www.cucchiaio.it/content/dam/cucchiaio/it/ricette/2025/03/pasta-alla-genovese/Pasta%20alla%20genovese_orizz.jpg'
    },
    {
      name: 'Bistecca alla Fiorentina',
      category: 'Secondi',
      price: 20,
      imageUrl: 'https://cdn.shopify.com/s/files/1/0496/8506/9978/files/Progetto_senza_titolo_13_-_Copia_1024x1024.png?v=1690018032'
    },
    {
      name: 'Pollo Arrosto',
      category: 'Secondi',
      price: 14,
      imageUrl: 'https://www.salepepe.it/files/2017/03/POLLO-ARROSTO.jpg'
    },
    {
      name: 'Salmone Grigliato',
      category: 'Secondi',
      price: 17,
      imageUrl: 'https://www.grandchef.net/cm/showfiles.php/ricette/salmone-alla-griglia/salmone-alla-griglia.jpg'
    },
    {
      name: 'Tiramisù',
      category: 'Dolci',
      price: 6,
      imageUrl: 'https://www.giallozafferano.it/images/173-17354/Tiramisu_650x433_wm.jpg'
    },
    {
      name: 'Cheesecake ai Frutti di Bosco',
      category: 'Dolci',
      price: 6.5,
      imageUrl: 'https://bennet-cdn.thron.com/delivery/public/thumbnail/bennet/009a2c67-3ae5-4b57-80a3-273da7e9f3a2/c82oyu/std/750x596/009a2c67-3ae5-4b57-80a3-273da7e9f3a2?format=auto'
    },
    {
      name: 'Panna Cotta',
      category: 'Dolci',
      price: 5,
      imageUrl: 'https://www.cucchiaio.it/content/cucchiaio/it/ricette/2009/11/ricetta-panna-cotta/_jcr_content/header-par/image_single.img.jpg/1646829031222.jpg'
    }
  ];


  get menuByCategory() {
    const map = new Map<string, any[]>();
    for (const item of this.mockMenu) {
      if (!map.has(item.category)) {
        map.set(item.category, []);
      }
      map.get(item.category)!.push(item);
    }
    return Array.from(map.entries());
  }


}

