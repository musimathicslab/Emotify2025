import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { LastFmService } from '../../../services/lastfm.service';
import { StepService } from '../../../services/step.service';
import { Preferences } from '@capacitor/preferences';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-mobile-login',
  templateUrl: './mobile-login-lastfm.component.html',
  styleUrls: ['./mobile-login-lastfm.component.css'],
  providers: [MessageService],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ProgressSpinnerModule],
})
export class MobileLoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private lastFmService: LastFmService,
    private stepService: StepService,
    private messageService: MessageService
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = null;

    const { username, password } = this.loginForm.value;

    try {
      const response: any = await lastValueFrom(
        this.lastFmService.mobileLogin(username, password)
      );
      if (response?.session) {
        // Nel MobileLoginComponent, dopo aver ottenuto la risposta dal login:
        Promise.all([
          Preferences.set({
            key: 'lastfmUser',
            value: response.session.name,
          }),
          Preferences.set({
            key: 'lastfmSessionKey',
            value: response.session.key,
          }),
          // Salva anche 'lastfmToken' con la session key (o un altro valore se disponibile)
          Preferences.set({
            key: 'lastfmToken',
            value: response.session.key,
          }),
        ]).then(() => {
          this.messageService.add({
            severity: 'success',
            summary: 'Login Success',
            detail: 'Autenticazione mobile avvenuta con successo',
          });
          this.stepService.setStep(1);
        });

        this.messageService.add({
          severity: 'success',
          summary: 'Login Success',
          detail: 'Autenticazione mobile avvenuta con successo',
        });
        this.stepService.setStep(1);
      } else {
        this.handleError('Sessione non ottenuta. Riprova.');
      }
    } catch (error) {
      this.handleError('Errore di autenticazione. Riprova.');
    } finally {
      this.isLoading = false;
    }
  }

  handleError(message: string): void {
    this.errorMessage = message;
    console.error(message);
  }
}
