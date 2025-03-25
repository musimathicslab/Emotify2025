import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SpotifyLoginService } from '../../../services/spotify.service';
import { StepService } from '../../../services/step.service';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Button } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { NgIf } from '@angular/common';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-spotify-callback',
  templateUrl: './spotify-callback.component.html',
  styleUrls: ['./spotify-callback.component.css'],
  standalone: true,
  imports: [Card, Message, Button, ProgressSpinner, NgIf],
})
export class SpotifyCallbackComponent implements OnInit {
  isLoading = true;
  errorMessage: string | null = null;
  premiumWarningShown = false; // Flag per mostrare l'avviso Premium

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private spotifyLoginService: SpotifyLoginService,
    private stepService: StepService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    console.log('SpotifyCallbackComponent: ngOnInit()');
    this.authenticateUser();
  }

  authenticateUser(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      console.log('Codice ricevuto:', code);

      if (code) {
        this.spotifyLoginService.exchangeCodeForToken(code).subscribe(
          tokenResponse => {
            console.log('Token response:', tokenResponse);
            if (tokenResponse && tokenResponse.access_token) {
              const accessToken = tokenResponse.access_token;
              const refreshToken = tokenResponse.refresh_token;
              const expiresIn = tokenResponse.expires_in; // ad esempio 3600 secondi
              const expirationTime = Date.now() + expiresIn * 1000;

              // Salva i token usando Capacitor Preferences
              Promise.all([
                Preferences.set({
                  key: 'spotifyAccessToken',
                  value: accessToken,
                }),
                Preferences.set({
                  key: 'spotifyRefreshToken',
                  value: refreshToken,
                }),
                Preferences.set({
                  key: 'spotifyTokenExpires',
                  value: expirationTime.toString(),
                }),
              ])
                .then(() => {
                  // Controlla se l'account è premium
                  this.checkPremiumAccount(accessToken);
                  // Imposta lo step successivo e naviga
                  this.stepService.setStep(2);
                  this.router.navigate(['/intro']);
                })
                .catch(error => {
                  console.error('Errore nel salvataggio dei token:', error);
                  this.handleError(
                    'Errore nel salvataggio dei token. Riprova.'
                  );
                });
            } else {
              this.handleError('Risposta token non valida. Riprova.');
            }
          },
          error => {
            console.error(
              'Errore nello scambio del codice per il token:',
              error
            );
            this.handleError(
              'Errore durante l’autenticazione con Spotify. Riprova.'
            );
          }
        );
      } else {
        this.handleError("Codice di autenticazione non trovato nell'URL.");
      }
    });
  }

  /**
   * Controlla se l'account Spotify è Premium.
   * Se non lo è, informa l'utente.
   */
  checkPremiumAccount(accessToken: string): void {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${accessToken}`,
    });
    this.http.get<any>('https://api.spotify.com/v1/me', { headers }).subscribe(
      user => {
        console.log('User info:', user);
        if (user.product !== 'premium') {
          this.premiumWarningShown = true;
          alert(
            "Per utilizzare a pieno tutte le funzionalità dell'app è necessario avere un account Spotify Premium."
          );
        } else {
          console.log('Account Spotify Premium trovato');
        }
      },
      error => {
        console.error('Errore nel controllo dello stato Premium:', error);
      }
    );
  }

  handleError(message: string): void {
    this.isLoading = false;
    this.errorMessage = message;
    console.error('SpotifyCallbackComponent handleError:', message);
  }

  retryLogin(): void {
    this.authenticateUser();
  }
}
