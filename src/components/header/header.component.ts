import { Component, ElementRef, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Toast } from 'primeng/toast';
import { StyleClass } from 'primeng/styleclass';
import { MessageService } from 'primeng/api';
import { saveAs } from 'file-saver';
import { StepService } from '../../services/step.service';
import { NgClass } from '@angular/common';
import { Preferences } from '@capacitor/preferences';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { TagVocabularyHelper } from '../../services/tag-classifier.service';
import { SpotifyPlayerService } from '../../services/spotify-player.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, Button, Dialog, StyleClass, Toast, NgClass],
  templateUrl: './header.component.html',
  standalone: true,
  providers: [MessageService],
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  menuVisible: boolean = false;
  settingsVisible: boolean = false;
  private tagVocabularyHelper = new TagVocabularyHelper();

  constructor(
    private router: Router,
    private messageService: MessageService,
    private stepService: StepService,
    private eRef: ElementRef
  ) {}

  @HostListener('document:click', ['$event.target'])
  onClickOutside(targetElement: HTMLElement) {
    if (this.menuVisible && !this.eRef.nativeElement.contains(targetElement)) {
      this.menuVisible = false;
    }
  }

  @HostListener('document:touchend', ['$event.target'])
  onTouchEndOutside(targetElement: HTMLElement) {
    if (this.menuVisible && !this.eRef.nativeElement.contains(targetElement)) {
      this.menuVisible = false;
    }
  }

  toggleMenu() {
    this.menuVisible = !this.menuVisible;
  }

  logout(): void {
    this.menuVisible = false;

    Promise.all([
      Preferences.remove({ key: 'spotifyAccessToken' }),
      Preferences.remove({ key: 'spotifyRefreshToken' }),
      Preferences.remove({ key: 'lastfmToken' }),
      Preferences.remove({ key: 'lastfmSessionKey' }),
    ])
      .then(() => {
        this.router.navigate(['/intro']);
        this.stepService.setStep(0);
      })
      .catch(error => console.error('Errore durante il logout:', error));
  }

  showSettingsModal(): void {
    this.menuVisible = false;
    this.settingsVisible = true;
  }

  resetTraining() {
    Promise.all([
      Preferences.remove({ key: 'memoryData' }),
      Preferences.remove({ key: 'trainingCount' }), // Rimuove anche il contatore
    ])
      .then(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Training Reset!',
          detail: 'Il modello è stato resettato con successo.',
          life: 4000,
        });
        // Forza il reload della pagina per rinizializzare il PlayerComponent
        window.location.reload();
      })
      .catch(error =>
        console.error('Errore durante il reset del training:', error)
      );
  }

  async exportData() {
    const memoryDataResult = await Preferences.get({ key: 'memoryModel' });
    const modelWeightsResult = await Preferences.get({ key: 'modelWeights' });
    const memoryData = memoryDataResult.value;
    const modelWeights = modelWeightsResult.value;

    if (!memoryData && !modelWeights) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Nessun dato da esportare',
        detail: 'Non ci sono dati salvati al momento.',
        life: 4000,
      });
      return;
    }

    const exportObject = {
      memoryModel: memoryData ? JSON.parse(memoryData) : null,
      modelWeights: modelWeights ? JSON.parse(modelWeights) : null,
    };

    const exportJson = JSON.stringify(exportObject, null, 2);

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: 'emotify_data.json',
          data: exportJson,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });

        // Condividi il file, omettendo la proprietà "text"
        await Share.share({
          title: 'Export dei dati',
          // text: '', // Puoi omettere questa proprietà se non serve
          url: result.uri,
          dialogTitle: 'Condividi i dati',
        });
        this.messageService.add({
          severity: 'success',
          summary: 'Esportazione completata',
          detail: 'I dati sono stati esportati e condivisi con successo!',
          life: 4000,
        });
      } catch (error) {
        console.error("Errore durante l'esportazione dei dati:", error);
        this.messageService.add({
          severity: 'error',
          summary: 'Errore di esportazione',
          detail: 'Non è stato possibile esportare i dati.',
          life: 4000,
        });
      }
    } else {
      const blob = new Blob([exportJson], { type: 'application/json' });
      saveAs(blob, 'emotify_data.json');
      this.messageService.add({
        severity: 'success',
        summary: 'Esportazione completata',
        detail:
          'I tuoi dati e i pesi del modello sono stati esportati con successo!',
        life: 4000,
      });
    }
  }

  resetAllData(): void {
    Promise.all([
      Preferences.remove({ key: 'memoryModel' }),
      Preferences.remove({ key: 'modelWeights' }),
      Preferences.remove({ key: 'trainingCount' }),
      // Usa il metodo resetVocabulary() del tuo helper, se disponibile
      this.tagVocabularyHelper.resetVocabulary(),
    ])
      .then(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Reset Completato',
          detail:
            'Tutti i dati sono stati resettati. L’app verrà riavviata con uno stato iniziale.',
          life: 4000,
        });
        window.location.reload();
      })
      .catch(error => {
        console.error('Errore durante il reset dei dati:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Errore di Reset',
          detail: 'Non è stato possibile resettare tutti i dati.',
          life: 4000,
        });
      });
  }

  onMenuItemClick() {
    this.menuVisible = false;
  }
}
