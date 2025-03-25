import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../components/header/header.component';
import { FooterComponent } from '../components/footer/footer.component';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  standalone: true,
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Emotify 2025';
  private deepLinkListener?: PluginListenerHandle;

  constructor(
    private router: Router,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    this.deepLinkListener = await App.addListener('appUrlOpen', (data: any) => {
      this.ngZone.run(() => {
        console.log('Deep link ricevuto:', data.url);
        try {
          const url = new URL(data.url);
          const code = url.searchParams.get('code');
          if (code) {
            console.log('Navigo a /spotify-callback con code=', code);
            this.router.navigate(['/callback'], { queryParams: { code } });
          }
        } catch (error) {
          console.error('Errore nel parsing dell’URL:', error);
        }
      });
    });
    if (Capacitor.getPlatform() === 'ios') {
      document.body.classList.add('ios');
    }
  }

  ngOnDestroy() {
    if (this.deepLinkListener) {
      this.deepLinkListener.remove();
    }
  }
}
