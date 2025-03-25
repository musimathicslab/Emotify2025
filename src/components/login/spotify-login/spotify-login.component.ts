import { Component } from '@angular/core';
import { SpotifyLoginService } from '../../../services/spotify.service';
import { ButtonDirective } from 'primeng/button';

@Component({
  selector: 'app-spotify-login',
  imports: [ButtonDirective],
  templateUrl: './spotify-login.component.html',
  styleUrl: './spotify-login.component.css',
  standalone: true,
})
export class SpotifyLoginComponent {
  constructor(private spotifyLoginService: SpotifyLoginService) {}

  loginToSpotify() {
    window.location.href = this.spotifyLoginService.getLoginUrl(); // Reindirizza l'utente a Spotify
  }
}
