import { Component } from '@angular/core';
import { LastFmService } from '../../../services/lastfm.service';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-lastfm-login',
  templateUrl: './lastfm-login.component.html',
  styleUrls: ['./lastfm-login.component.css'],
  standalone: true,
  imports: [Button],
})
export class LastfmLoginComponent {
  constructor(private lastFmService: LastFmService) {}

  loginWithLastFm(): void {
    this.lastFmService.performLastFmLogin();
  }
}
