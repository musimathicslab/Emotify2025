import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { RatingModule } from 'primeng/rating';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TrackRating } from '../../models/track-rating';
import { EmotionsService } from '../../services/emotions.service';
import { NgClass, NgIf } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { StyleClass } from 'primeng/styleclass';
import { MemoryModelImpl } from '../../models/memory-model';
import { LastFmService } from '../../services/lastfm.service';

type MemoryItem = [string, TrackRating[]];

@Component({
  selector: 'app-memory-page',
  standalone: true,
  imports: [
    TableModule,
    InputTextModule,
    RatingModule,
    ButtonModule,
    DropdownModule,
    FormsModule,
    NgClass,
    ReactiveFormsModule,
    Tooltip,
    ConfirmDialogModule,
    Dialog,
    NgIf,
    StyleClass,
  ],
  providers: [ConfirmationService],
  templateUrl: './memory-page.component.html',
  styleUrls: ['./memory-page.component.css'],
})
export class MemoryPageComponent implements OnInit {
  emotions: { name: string; code: number }[] = [];
  trackRatings: TrackRating[] = [];

  editingTrack: TrackRating | null = null;
  showEditDialog = false;

  /**
   * Chiave usata nel localStorage (contiene un array di coppie [string, TrackRating[]])
   */
  private readonly STORAGE_KEY = 'memoryModel';
  private memoryModel: MemoryModelImpl;

  constructor(
    private emotionService: EmotionsService,
    private confirmationService: ConfirmationService,
    private lastFmService: LastFmService
  ) {
    this.memoryModel = new MemoryModelImpl(this.lastFmService);
  }

  ngOnInit() {
    this.emotions = this.emotionService.getEmotionNames();
    this.loadTracks();
  }

  loadTracks(): void {
    this.trackRatings = this.memoryModel.getAllTracks();
  }

  /**
   * Salva le modifiche in localStorage.
   * NOTA: Questo salverà un *array piatto* di TrackRating,
   * quindi sovrascriverà la struttura [chiave, arrayDiTracce] originale.
   *
   * Se vuoi mantenere la struttura a mappa, devi riorganizzare i dati
   * in [chiave, array] prima di fare il JSON.stringify().
   */
  saveChanges(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.trackRatings));
    console.log('💾 Tracce salvate in localStorage:', this.trackRatings);
    alert('Modifiche salvate!');
  }

  onEdit(track: TrackRating) {
    // Cloniamo l'oggetto per non modificare subito l'array
    this.editingTrack = { ...track };
    // Mostra la dialog
    this.showEditDialog = true;
  }

  clearMemory() {
    // Se vuoi cancellare solo la chiave 'memoryModel':
    localStorage.removeItem('memoryModel');
    // e se i tuoi dati stanno anche in 'trackRatings', rimuovi anche quello:
    localStorage.removeItem('trackRatings');

    // Oppure, se vuoi pulire *tutto* localStorage:
    // localStorage.clear();

    // Poi aggiorna l’array in memoria
    this.trackRatings = [];
    console.log('🚮 Memoria cancellata!');
  }

  onClearMemoryClick() {
    this.confirmationService.confirm({
      message: 'Sei sicuro di voler cancellare la memoria?',
      header: 'Conferma Eliminazione',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Conferma',
      rejectLabel: 'Annulla',
      accept: () => {
        this.clearMemory();
      },
      reject: () => {
        console.log('Eliminazione annullata.');
      },
    });
  }

  cancelDialog() {
    this.showEditDialog = false;
    this.editingTrack = null;
  }

  saveDialogChanges() {
    if (this.editingTrack) {
      const index = this.trackRatings.findIndex(
        t => t.id === this.editingTrack!.id
      );
      if (index >= 0) {
        this.trackRatings[index] = this.editingTrack;
      }
    }
    this.showEditDialog = false;
    this.editingTrack = null;
  }
}
