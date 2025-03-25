import { Component, OnInit } from '@angular/core';
import { StepService } from '../../../services/step.service';
import { EmotionMapComponent } from '../emotion-map/emotion-map.component';
import { EmotionGraphComponent } from '../emotion-graph/emotion-graph.component';
import { PlayerComponent } from '../player/player.component';
import { SpotifyLoginComponent } from '../../login/spotify-login/spotify-login.component';

import { Steps } from 'primeng/steps';
import { Card } from 'primeng/card';
import { NgForOf, NgIf } from '@angular/common';
import {
  ACTIVITIES,
  LOCATIONS,
  STEPS,
} from '../../../constants/place.constants';
import { Capacitor } from '@capacitor/core';
import { MobileLoginComponent } from '../../login/mobile-login-lastfm/mobile-login-lastfm.component';
import { LastfmLoginComponent } from '../../login/lastfm-login/lastfm-login.component';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-context-selector',
  templateUrl: './context-selector.component.html',
  styleUrls: ['./context-selector.component.css'],
  standalone: true,
  imports: [
    EmotionMapComponent,
    EmotionGraphComponent,
    PlayerComponent,
    SpotifyLoginComponent,
    LastfmLoginComponent,
    Steps,
    Card,
    NgIf,
    NgForOf,
    MobileLoginComponent,
    LastfmLoginComponent,
  ],
})
export class ContextSelectorComponent implements OnInit {
  currentStep: number = 0;
  selectedLocation: string | null = null;
  selectedActivity: string | null = null;
  selectedEmotion: string = 'PAURA';
  selectedEmotionLevel: string = 'LOW';

  isLastFmLoggedIn = false;
  isSpotifyLoggedIn = false;
  isMobile = false;

  steps = STEPS.map(step => ({
    label: step.label,
    command: () => this.goToStep(step.stepIndex),
  }));

  locations = LOCATIONS;
  allActivities = ACTIVITIES;
  filteredActivities = this.allActivities;

  constructor(private stepService: StepService) {}

  async ngOnInit(): Promise<void> {
    // Verifica se l'app è in modalità mobile
    this.isMobile = Capacitor.isNativePlatform();

    // Recupera i token dalle Preferences
    const lastFmUserResult = await Preferences.get({ key: 'lastfmUser' });
    const lastFmAuthToken = await Preferences.get({ key: 'lastfmToken' });
    const spotifyTokenResult = await Preferences.get({
      key: 'spotifyAccessToken',
    });

    this.isLastFmLoggedIn = !!lastFmAuthToken.value;
    this.isSpotifyLoggedIn = !!spotifyTokenResult.value;

    // Se non ci sono step salvati, impostiamo in base allo stato di autenticazione
    // (Altrimenti il StepService ha già caricato il valore salvato)
    if (!(await this.getSavedStep())) {
      if (this.isLastFmLoggedIn && this.isSpotifyLoggedIn) {
        await this.stepService.setStep(2);
      } else if (this.isLastFmLoggedIn && !this.isSpotifyLoggedIn) {
        await this.stepService.setStep(1);
      }
    }

    // Sottoscrizione per aggiornare currentStep
    this.stepService.currentStep.subscribe(step => {
      this.currentStep = step;
    });
  }

  async getSavedStep(): Promise<number | null> {
    const result = await Preferences.get({ key: 'currentStep' });
    return result.value ? parseInt(result.value, 10) : null;
  }

  goToNextStep(): void {
    if (this.currentStep < this.steps.length - 1) {
      this.stepService.setStep(this.currentStep + 1);
    }
  }

  handleStepSelection(event: any): void {
    // Se l'evento è un numero, usalo direttamente come indice
    const stepIndex =
      typeof event === 'number'
        ? event
        : this.steps.findIndex(s => s.label === event.item.label);

    if (stepIndex < 0) {
      console.warn('🚨 Errore: Step non trovato!', event);
      return;
    }
    if (this.currentStep >= 2 && stepIndex <= 1) {
      console.warn('🚫 Non puoi tornare ai passi di login.');
      return;
    }
    this.goToStep(stepIndex);
  }

  goToStep(step: number): void {
    console.log('Naviga al passo:', step);
    if (this.currentStep >= 2 && step <= 1) {
      console.warn(
        `🚫 Non puoi tornare ai passi di login dopo averli superati.`
      );
      return;
    }
    if (this.canNavigateToStep(step)) {
      this.stepService.setStep(step);
    } else {
      console.warn(`🚫 Passo ${step} non consentito.`);
    }
  }

  canNavigateToStep(step: number): boolean {
    if (this.currentStep >= 2 && step <= 1) {
      console.warn(
        `🚫 Non puoi tornare ai passi di login dopo aver superato il login.`
      );
      return false;
    }
    if (step <= this.currentStep) return true;
    if (step === 1 && !this.isLastFmLoggedIn) return false;
    if (step === 2 && !this.isSpotifyLoggedIn) return false;
    if (step === 3 && !this.selectedLocation) return false;
    if (step === 4 && !this.selectedActivity) return false;
    if (step === 5 && !this.selectedEmotion) return false;
    return step === this.currentStep + 1;
  }

  selectLocation(location: string): void {
    this.selectedLocation = location;
    this.filteredActivities = this.allActivities.filter(activity =>
      activity.locations.includes(location)
    );
    this.goToNextStep();
  }

  selectActivity(activity: string): void {
    this.selectedActivity = activity;
    this.goToNextStep();
  }

  handleEmotionSelected(emotion: string): void {
    this.selectedEmotion = emotion; // ad esempio, "FELICITÀ"
    Preferences.set({ key: 'selectedEmotion', value: emotion });
    this.goToStep(5); // Vai allo step del grafico
  }

  handleEmotionLevelSelected(emotion: { name: string; level: string }): void {
    if (!emotion || !emotion.name || !emotion.level) {
      console.error('Errore: dati emozione non validi', emotion);
      return;
    }
    this.selectedEmotionLevel = emotion.name;

    this.goToStep(6);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = 'img/image.png';
  }
}
