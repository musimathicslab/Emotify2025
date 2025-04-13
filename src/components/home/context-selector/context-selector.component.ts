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
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-context-selector',
  templateUrl: './context-selector.component.html',
  styleUrls: ['./context-selector.component.css'],
  standalone: true,
  providers: [MessageService],
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
    Toast,
  ],
})
export class ContextSelectorComponent implements OnInit {
  currentStep: number = 0;
  selectedLocation: string | null = null;
  selectedActivity: string | null = null;
  selectedEmotion: string = '';
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

  constructor(
    private stepService: StepService,
  ) {}

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

    // Recupera lo step salvato (verificando il timestamp)
    const savedStep = await this.getSavedStep();
    if (savedStep !== null) {
      await this.stepService.setStep(savedStep);
    } else {
      if (this.isLastFmLoggedIn && this.isSpotifyLoggedIn) {
        await this.stepService.setStep(2);
      } else if (this.isLastFmLoggedIn && !this.isSpotifyLoggedIn) {
        await this.stepService.setStep(1);
      } else {
        await this.stepService.setStep(0);
      }
    }

    const savedLocation = await Preferences.get({ key: 'selectedLocation' });
    if (savedLocation.value) {
      this.selectedLocation = savedLocation.value;

      // Filtra le attività compatibili con il luogo salvato
      this.filteredActivities = this.allActivities.filter(activity =>
        activity.locations.includes(this.selectedLocation!)
      );

      console.log(
        `✅ Attività filtrate per il luogo selezionato: ${this.selectedLocation}`
      );
    } else {
      console.warn('⚠️ Nessun luogo salvato trovato.');
      this.filteredActivities = this.allActivities; // Mostra tutte le attività se il luogo non è selezionato
    }
    // Recupera l'attività salvata (se presente)
    const savedActivity = await Preferences.get({ key: 'selectedActivity' });
    if (savedActivity.value) {
      this.selectedActivity = savedActivity.value;
    }

    // Sottoscrizione per aggiornare currentStep
    this.stepService.currentStep.subscribe(step => {
      this.currentStep = step;
    });
  }

  async getSavedStep(): Promise<number | null> {
    const stepResult = await Preferences.get({ key: 'currentStep' });
    const timestampResult = await Preferences.get({
      key: 'currentStepTimestamp',
    });

    if (stepResult.value && timestampResult.value) {
      const savedStep = parseInt(stepResult.value, 10);
      const savedTimestamp = parseInt(timestampResult.value, 10);
      const now = Date.now();
      if (now - savedTimestamp > 600000) {
        if (this.isLastFmLoggedIn && this.isSpotifyLoggedIn) {
          return 3;
        }
        return null;
      } else {
        return savedStep;
      }
    }
    return null;
  }

  goToNextStep(): void {
    const nextStep = this.currentStep + 1;
    if (this.canNavigateToStep(nextStep)) {
      this.stepService.setStep(nextStep);
    } else {
      console.warn(
        `Non puoi avanzare perché non hai selezionato tutti i dati necessari.`
      );
    }
  }

  handleStepSelection(event: any): void {
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
    // Se si sta andando avanti allo step delle attività (es. step 4)
    // e se il luogo è stato selezionato, applica il filtro
    if (step === 4 && step > this.currentStep && this.selectedLocation) {
      this.filteredActivities = this.allActivities.filter(activity =>
        activity.locations.includes(this.selectedLocation!)
      );
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

  handleEmotionSelected(emotion: string): void {
    // Selezione e salvataggio (converti in numero se necessario)
    this.selectedEmotion = emotion;
    Preferences.set({ key: 'selectedEmotion', value: emotion });
    this.goToStep(5);
  }

  selectLocation(location: string): void {
    // Salva e applica filtro
    this.selectedLocation = location;
    Preferences.set({ key: 'selectedLocation', value: location });
    this.filteredActivities = this.allActivities.filter(activity =>
      activity.locations.includes(location)
    );
    this.goToNextStep();
  }

  selectActivity(activity: string): void {
    this.selectedActivity = activity;
    Preferences.set({ key: 'selectedActivity', value: activity });
    this.goToNextStep();
  }

  handleEmotionLevelSelected(emotion: { name: string; level: string }): void {
    if (!emotion || !emotion.name || !emotion.level) {
      console.error('Errore: dati emozione non validi', emotion);
      return;
    }
    this.selectedEmotionLevel = emotion.level;
    Preferences.set({ key: 'selectedEmotionLevel', value: emotion.level });
    this.goToStep(6);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = 'img/image.png';
  }

  mapLocation(location: string | null): number {
    const mapping: { [key: string]: number } = {
      casa: 1,
      ufficio: 2,
      scuola: 3,
      palestra: 4,
      parco: 5,
      viaggio: 6,
    };
    return location && mapping[location] ? mapping[location] : 0;
  }
  mapEmotion(emotion: string | null): number {
    const mapping: { [key: string]: number } = {
      tristezza: 0,
      rabbia: 1,
      felicità: 2,
      paura: 3,
      disgusto: 4,
    };
    return emotion ? (mapping[emotion.toLowerCase()] ?? 0) : 0;
  }
  mapActivity(activity: string | null): number {
    const mapping: { [key: string]: number } = {
      lavorando: 1,
      studiando: 2,
      rilassando: 3,
      allenandoti: 4,
      leggendo: 5,
      giocando: 6,
      meditando: 7,
      cucinando: 8,
      fotografando: 9,
      Panorami: 10,
    };
    return activity && mapping[activity] ? mapping[activity] : 0;
  }
}
