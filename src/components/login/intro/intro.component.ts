import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LastFmService } from '../../../services/lastfm.service';
import { StepService } from '../../../services/step.service';
import { Card } from 'primeng/card';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Message } from 'primeng/message';
import { Button } from 'primeng/button';
import { NgIf } from '@angular/common';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-intro',
  templateUrl: './intro.component.html',
  styleUrls: ['./intro.component.css'],
  standalone: true,
  imports: [Card, ProgressSpinner, Message, Button, NgIf],
})
export class IntroComponent implements OnInit {
  isLoading = true; // Stato di caricamento
  errorMessage: string | null = null; // Messaggio di errore

  constructor(
    private lastFmService: LastFmService,
    private stepService: StepService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initialize();
  }

  /**
   * Inizializza il componente recuperando i dati di sessione tramite Capacitor Preferences.
   */
  async initialize() {
    try {
      const usernameRes = await Preferences.get({ key: 'lastFmUser' });
      const sessionKeyRes = await Preferences.get({ key: 'lastfmSessionKey' });
      const username = usernameRes.value;
      const sessionKey = sessionKeyRes.value;

      if (username && sessionKey) {
        await this.stepService.setStep(1);
        await this.router.navigate(['/intro']);
      } else {
        console.log('Sessione Last.fm non trovata, richiedo login.');
        await this.authenticateUser();
      }
    } catch (error) {
      this.handleError("Errore durante l'inizializzazione.");
    }
  }

  /**
   * Autentica l'utente richiedendo il token e salvando i dati tramite Preferences.
   */
  async authenticateUser(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;

    try {
      const token = await this.lastFmService.handleCallback();
      if (token) {
        await Preferences.set({ key: 'lastfmToken', value: token });
        this.lastFmService.getAuthenticatedUser().subscribe(
          username => {
            if (username) {
              console.log('Sessione avviata per:', username);
              this.stepService.setStep(1);
              this.router.navigate(['/intro']);
            } else {
              this.handleError('Impossibile ottenere la sessione.');
            }
          },
          error => this.handleError('Errore di autenticazione. Riprova.')
        );
      } else {
        this.handleError('Login fallito o token non trovato.');
      }
    } catch (error) {
      console.error("Errore durante l'autenticazione:", error);
      this.handleError("Errore durante l'autenticazione.");
    }
  }

  handleError(message: string): void {
    this.isLoading = false;
    this.errorMessage = message;
    console.error(message);
  }

  retryLogin(): void {
    this.authenticateUser();
  }
}
