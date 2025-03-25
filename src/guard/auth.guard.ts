import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { LastFmService } from '../services/lastfm.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private lastFmService: LastFmService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.lastFmService.isAuthenticated()) {
      return true;
    } else {
      this.router.navigate(['/intro']); // Reindirizza al login di Last.fm se non autenticato
      return false;
    }
  }
}
