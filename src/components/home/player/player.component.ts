import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, lastValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG components
import { Slider } from 'primeng/slider';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessagesModule } from 'primeng/messages';
import { StyleClass } from 'primeng/styleclass';
import { ProgressSpinner } from 'primeng/progressspinner';
import { AsyncPipe, DecimalPipe, LowerCasePipe, NgIf } from '@angular/common';
import { Toast } from 'primeng/toast';

// Servizi interni
import { SpotifyPlayerService } from '../../../services/spotify-player.service';
import { LastFmService } from '../../../services/lastfm.service';
import { MemoryModelImpl } from '../../../models/memory-model';
import { RLAgent } from '../../../models/rlagent';
import { RatingsData } from '../../../models/track-rating';
import { MessageService } from 'primeng/api';
import { Preferences } from '@capacitor/preferences';
import { RatingComponent } from '../rating/rating.component';

// Importa il classificatore e il helper per il vocabolario
import {
  TagClassifierService,
  TagVocabularyHelper,
} from '../../../services/tag-classifier.service';

// Importa costanti e la funzione helper per il mapping dei tag
import {
  FEATURE_THRESHOLDS,
  MUSIC_TAGS,
  VOCAB_DANCE,
  VOCAB_INSTR,
  VOCAB_LOUD,
  VOCAB_SPEECH,
  VOCAB_TEMPO,
} from '../../../constants/music-tags.constants';
import { getTagForFeature } from '../../../constants/tag-mapper.util';
import { EMOTION_CONFIGURATIONS } from '../emotion-graph/emotion-graph.component';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';

interface PermissionStatus {
  display: PermissionState; // "granted" | "denied" | "prompt"
}

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css'],
  providers: [MessageService],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    Slider,
    Card,
    AsyncPipe,
    Button,
    MessagesModule,
    StyleClass,
    ProgressSpinner,
    NgIf,
    Toast,
    DecimalPipe,
    RatingComponent,
    LowerCasePipe,
  ],
})
export class PlayerComponent implements OnInit, OnDestroy {
  isPlaying$ = new BehaviorSubject<boolean>(false);
  trackTitle$ = new BehaviorSubject<string>('Nessun brano in riproduzione');
  artistName$ = new BehaviorSubject<string>('');
  albumCover$ = new BehaviorSubject<string>('');
  currentTime$ = new BehaviorSubject<string>('0:00');
  totalTime$ = new BehaviorSubject<string>('0:00');
  isPlayerReady$!: BehaviorSubject<boolean>;
  progress = 0;
  formGroup: FormGroup;
  private isWarningShown = false; // Flag per prevenire messaggi di warning duplicati

  // Preferences: recently played e training progress
  private recentlyPlayedKey = 'recentlyPlayedData';
  // Se non vuoi che la lista venga resettata dopo 5 ore, aumenta questo valore oppure rimuovi il reset
  private readonly RECENTLY_PLAYED_MAX_AGE = 5 * 60 * 60 * 1000;
  private recentlyPlayed: string[] = [];
  private isLoadingNewSong = false;
  private emotionTrainingCounts: { [emotion: number]: number } = {};
  trainingLimit = 10; // Limite per ogni emozione

  // Abilita/disabilita il rating (se il training è completato)
  enableRating = true;

  @Input() selectedEmotion = 0;
  @Input() selectedActivity = 0;
  @Input() selectedLocation = 0;
  @Input() selectedEmotionLevel = '';

  private memoryModel: MemoryModelImpl;
  private rlAgent: RLAgent;
  private destroy$ = new Subject<void>();

  currentAudioFeatures: number[] = [];
  private candidateTracks: { title: string; artist: string }[] = [];
  private lastState: number[] = [];
  private lastAction = 0;
  // Flag per evitare lo skip automatico se la traccia non è stata valutata
  isTrackRated = false;

  private isAppActive = true; // inizialmente l'app è in primo piano

  private tagVocabularyHelper = new TagVocabularyHelper();
  private storageKey = 'trainingCount';

  private tagClassifier: TagClassifierService = new TagClassifierService(
    VOCAB_TEMPO,
    VOCAB_DANCE,
    VOCAB_INSTR,
    VOCAB_SPEECH,
    VOCAB_LOUD
  );

  // Mapping per location, emozione e attività
  mapLocation(location: string | null): number {
    const mapping: { [key: string]: number } = {
      casa: 1,
      ufficio: 2,
      scuola: 3,
      palestra: 4,
      parco: 5,
      viaggio: 6,
    };
    return location && mapping[location.toLowerCase()]
      ? mapping[location.toLowerCase()]
      : 0;
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
      panorami: 10,
    };
    return activity && mapping[activity.toLowerCase()]
      ? mapping[activity.toLowerCase()]
      : 0;
  }

  constructor(
    private spotifyPlayerService: SpotifyPlayerService,
    private fb: FormBuilder,
    private lastFmService: LastFmService,
    private messageService: MessageService
  ) {
    this.isPlayerReady$ = this.spotifyPlayerService.playerReady$;
    this.memoryModel = new MemoryModelImpl();
    this.rlAgent = new RLAgent(9, 10);
    this.formGroup = this.fb.group({ value: [0] });
  }

  async requestNotificationPermission() {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') {
      console.log('Notifiche autorizzate');
    } else {
      console.warn('Notifiche non autorizzate');
    }
  }

  private async sendTrackRatingNotification(): Promise<void> {
    if (!this.isAppActive) {
      // controlla che l'app sia in background
      await LocalNotifications.schedule({
        notifications: [
          {
            id: new Date().getTime(),
            title: 'Valutazione Richiesta 🎧',
            body: 'Devi valutare la traccia prima di procedere alla successiva.',
            sound: 'default',
          },
        ],
      });
    } else {
      console.log('App in primo piano: nessuna notifica inviata.');
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadTrainingProgress();
    await this.rlAgent.loadBestWeightsFromPreferences();
    await this.tagVocabularyHelper.loadVocabulary();
    await this.loadRecentlyPlayed();
    await this.loadSelectedParameters();
    await App.addListener('appStateChange', ({ isActive }) => {
      this.isAppActive = isActive;
      console.log('App active status:', this.isAppActive);
    });
    await this.requestNotificationPermission();
    [VOCAB_TEMPO, VOCAB_DANCE, VOCAB_INSTR, VOCAB_SPEECH, VOCAB_LOUD]
      .flat()
      .forEach(tag => this.tagVocabularyHelper.updateTagCounts([tag]));

    this.isPlaying$ = this.spotifyPlayerService.isPlaying$;
    this.trackTitle$ = this.spotifyPlayerService.trackTitle$;
    this.artistName$ = this.spotifyPlayerService.artistName$;
    this.albumCover$ = this.spotifyPlayerService.albumCover$;
    this.currentTime$ = this.spotifyPlayerService.currentTime$;
    this.totalTime$ = this.spotifyPlayerService.totalTime$;

    this.spotifyPlayerService.currentTrackId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(trackId => {});

    // Gestione del progresso della traccia
    this.spotifyPlayerService.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.progress = progress;
        this.formGroup.patchValue({ value: progress }, { emitEvent: false });

        if (this.progress >= 99) {
          if (!this.isTrackRated && !this.isWarningShown) {
            console.warn(
              'Traccia terminata, ma non valutata. Blocco autoplay.'
            );
            this.spotifyPlayerService.pause();
            this.messageService.add({
              severity: 'warn',
              summary: 'Valutazione richiesta',
              detail: "Devi valutare la traccia prima di riprodurne un'altra.",
              life: 3000,
            });
            this.sendTrackRatingNotification();
            this.isWarningShown = true; // Impedisce che vengano mostrati altri messaggi di warning
          } else if (this.isTrackRated && !this.isWarningShown) {
            this.isWarningShown = true; // Impedisce la ripetizione del messaggio
            this.playNextSongWithRL();
          }
        } else {
          this.isWarningShown = false; // Reset del flag quando si inizia una nuova traccia
        }
      });

    this.formGroup
      .get('value')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.progress = value;
      });

    this.memoryModel.tracks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tracks => {
        console.log('Memory tracks aggiornate:', tracks);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePlay(): void {
    this.spotifyPlayerService.togglePlay();
  }
  previousTrack(): void {
    if (this.isLoadingNewSong) return;
    this.spotifyPlayerService.previousTrack();
  }
  nextTrack(): void {
    if (this.isLoadingNewSong) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attendere...',
        detail: "Un'operazione è già in corso, attendere un attimo.",
        life: 3000,
      });
      return;
    }

    if (!this.isTrackRated && !this.isWarningShown) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Valutazione richiesta',
        detail: 'Devi valutare la traccia prima di passare alla successiva.',
        life: 3000,
      });
      this.sendTrackRatingNotification();
      this.isWarningShown = true; // Impedisce il messaggio di warning duplicato
      return;
    }

    if (this.currentTrainingCount >= this.trainingLimit) {
      this.isTrackRated = false;
      this.isWarningShown = false; // Reset del flag per la nuova traccia
      this.playNextSongWithRL();
      return;
    }

    this.isTrackRated = false;
    this.isWarningShown = false;
    this.spotifyPlayerService.nextTrack();
  }

  get currentTrackId$() {
    return this.spotifyPlayerService.currentTrackId$;
  }

  // Costruisce lo stato per il RLAgent
  private buildRLState(
    emotion: number,
    activity: number,
    location: number,
    emotionLevel: number,
    features: number[]
  ): number[] {
    if (!features || features.length !== 5) {
      console.warn(
        `buildRLState: features non validi. Attesi 5, ottenuti ${features ? features.length : 0}. Uso valori di default.`
      );
      features = [50, 50, 50, 50, 50];
    }
    const state = [
      Number(emotion),
      Number(activity),
      Number(location),
      Number(emotionLevel),
      ...features.map(val => Number(val)),
    ];
    console.log('Stato costruito per RLAgent:', state);
    return state;
  }

  // Avvia la riproduzione della prossima traccia tramite il RLAgent
  public async playNextSongWithRL(): Promise<void> {
    // Resetta il flag per il nuovo brano
    this.isTrackRated = false;
    this.currentAudioFeatures = this.ensureAudioFeatures(
      this.currentAudioFeatures
    );
    let candidateTracks: { title: string; artist: string }[] = [];

    const currentEmotion = this.selectedEmotion;
    const currentCount = this.emotionTrainingCounts[currentEmotion] || 0;

    // Se il training per l'emozione non è completo, usa le top tracks dell'utente
    if (currentCount < this.trainingLimit) {
      console.log(
        'Training in corso per emozione',
        currentEmotion,
        ': uso top tracks interne.'
      );
      candidateTracks = await this.spotifyPlayerService.getUserTopTracks(50);
      console.log(candidateTracks);
    } else {
      // Altrimenti, usa i tag predetti per cercare tracce candidate
      const predicted = this.tagClassifier.predictTag(
        this.currentAudioFeatures
      );
      console.log('Tag predetti dal classificatore:', predicted);
      const predictedTags = [
        predicted.tempo,
        predicted.dance,
        predicted.instr,
        predicted.speech,
        predicted.loud,
      ];
      console.log('Predicted tags:', predictedTags);
      const currentTitle = this.spotifyPlayerService.getCurrentTrackTitle();
      const currentArtist = this.spotifyPlayerService.getCurrentArtist();
      const commonMemoryTags = await this.analyzeCommonMemoryTags(
        predictedTags,
        currentTitle,
        currentArtist
      );
      console.log('Common memory tags:', commonMemoryTags);
      const searchTags = commonMemoryTags;
      console.log('Tag usati per la ricerca:', searchTags);
      for (const tag of searchTags) {
        const candidate = await this.findTrackByTag(tag);
        if (candidate) candidateTracks.push(candidate);
      }
      // Se non sono stati trovati candidati tramite i tag, usa le top tracks dell'utente
      if (candidateTracks.length === 0) {
        console.warn(
          'Nessun candidato trovato tramite tag. Uso top tracks Spotify.'
        );
        candidateTracks = await this.spotifyPlayerService.getUserTopTracks(50);
      }
    }

    // Rimuovo duplicati (ignorando le maiuscole)
    candidateTracks = candidateTracks.reduce(
      (unique, candidate) => {
        if (
          !unique.find(
            c => c.title.toLowerCase() === candidate.title.toLowerCase()
          )
        ) {
          unique.push(candidate);
        }
        return unique;
      },
      [] as { title: string; artist: string }[]
    );
    console.log('Candidate tracks dopo rimozione duplicati:', candidateTracks);

    // Filtro le tracce già riprodotte
    let filteredCandidates = candidateTracks.filter(
      candidate => !this.recentlyPlayed.includes(candidate.title.toLowerCase())
    );
    console.log(
      'Candidate tracks dopo filtro tracce già riprodotte:',
      filteredCandidates
    );

    // Definisci il numero minimo di tracce richiesto
    const minRequiredTracks = 5;

    // Fallback 1: Aggiungo le 50 tracce top dell'utente, se il numero di tracce è insufficiente
    if (filteredCandidates.length < minRequiredTracks) {
      console.warn(
        "Fallback 1: poche tracce candidate trovate. Aggiungo le 50 tracce top dell'utente."
      );
      let fallback1 = await this.spotifyPlayerService.getUserTopTracks(50);
      fallback1 = fallback1.filter(
        candidate =>
          !this.recentlyPlayed.includes(candidate.title.toLowerCase())
      );
      filteredCandidates = filteredCandidates.concat(fallback1);
    }

    // Fallback 2: Aggiungo le tracce che l'utente ha "messo il cuore" (liked tracks)
    if (filteredCandidates.length < minRequiredTracks) {
      console.warn(
        'Fallback 2: tracce insufficienti. Aggiungo le tracce salvate (liked tracks).'
      );
      let fallback2 = await this.spotifyPlayerService.getUserLikedTracks(50);
      fallback2 = fallback2.filter(
        candidate =>
          !this.recentlyPlayed.includes(candidate.title.toLowerCase())
      );
      filteredCandidates = filteredCandidates.concat(fallback2);
    }

  

    if (filteredCandidates.length === 0) {
      console.warn('Tutti i candidati sono già stati riprodotti recentemente.');
      return;
    }
    this.candidateTracks = filteredCandidates;

    // Seleziono casualmente una traccia dalla lista finale
    const chosenCandidate = this.selectRandomCandidate(this.candidateTracks);
    const trackId = await lastValueFrom(
      this.spotifyPlayerService.searchTrack(
        chosenCandidate.title,
        chosenCandidate.artist
      )
    );
    if (trackId) {
      this.updateRecentlyPlayed(chosenCandidate.title);
      await this.spotifyPlayerService.playTrack(trackId);
    } else {
      console.error('Nessun trackId trovato per', chosenCandidate);
    }
    this.isLoadingNewSong = false;

    const safeEmotionLevel = Number(this.selectedEmotionLevel);
    const state = this.buildRLState(
      this.selectedEmotion,
      this.selectedActivity,
      this.selectedLocation,
      safeEmotionLevel,
      this.currentAudioFeatures
    );
    console.log('Stato passato a RLAgent:', state);
    this.lastState = state;
  }

  // Analizza i tag in memoria confrontandoli con quelli predetti
  private async analyzeCommonMemoryTags(
    predictedTags: string[],
    currentTitle: string,
    currentArtist: string,
    topN: number = 10,
    minRequired: number = 3
  ): Promise<string[]> {
    const memoryTracks = this.memoryModel.getAllTracks();
    const filteredTracks = memoryTracks.filter(track => {
      if (!track.tags || !Array.isArray(track.tags)) {
        return false;
      }
      const matchingTagsCount = predictedTags.filter(tag =>
        track.tags.includes(tag)
      ).length;
      return matchingTagsCount >= minRequired;
    });

    let allTags: string[] = [];
    filteredTracks.forEach(track => {
      if (track.tags && Array.isArray(track.tags)) {
        allTags.push(...track.tags);
      }
    });

    const frequency: { [tag: string]: number } = {};
    allTags.forEach(tag => {
      frequency[tag] = (frequency[tag] || 0) + 1;
    });
    console.log('Frequenza dei tag:', frequency);

    let sortedTags = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    const defaultTags = new Set(['slow', 'vocal']);
    let commonTags = sortedTags.filter(tag => !defaultTags.has(tag));
    console.log('Tag comuni (esclusi default):', commonTags);

    if (commonTags.length === 0 && filteredTracks.length > 0) {
      console.warn(
        'Nessun tag comune trovato esclusi quelli di default. Uso i tag della prima traccia filtrata.'
      );
      commonTags = filteredTracks[0].tags.filter(tag => !defaultTags.has(tag));
    }

    if (commonTags.length === 0) {
      console.warn(
        'Fallback: nessun tag utile trovato in memoria. Uso Last.fm.'
      );
      try {
        const externalTags = await lastValueFrom(
          this.lastFmService.getTrackTopTags(currentTitle, currentArtist)
        );
        console.log('Tag esterni da Last.fm:', externalTags);
        commonTags = externalTags;
      } catch (error) {
        console.error('Errore nel fallback Last.fm:', error);
        commonTags = predictedTags;
      }
    }

    const topTags = commonTags.slice(0, topN);
    console.log('Tag comuni finali da usare per la ricerca:', topTags);
    return topTags;
  }

  // Ricerca una traccia tramite tag
  private async findTrackByTag(
    tag: string
  ): Promise<{ title: string; artist: string } | null> {
    try {
      const topTracks = await lastValueFrom(
        this.lastFmService.getTopTracksByTag(tag, 10)
      );
      if (!topTracks || topTracks.length === 0) {
        console.log(`Nessuna traccia trovata per il tag "${tag}".`);
        return null;
      }
      const availableTracks = topTracks.filter(
        track => !this.recentlyPlayed.includes(track.name.toLowerCase())
      );
      let chosenTrack;
      if (availableTracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        chosenTrack = availableTracks[randomIndex];
      } else {
        const randomIndex = Math.floor(Math.random() * topTracks.length);
        chosenTrack = topTracks[randomIndex];
        this.recentlyPlayed = [];
      }
      let selectedArtist = 'Unknown Artist';
      if (chosenTrack.artist && chosenTrack.artist.name) {
        selectedArtist = chosenTrack.artist.name;
      } else if (typeof chosenTrack.artist === 'string') {
        selectedArtist = chosenTrack.artist;
      }
      return { title: chosenTrack.name, artist: selectedArtist };
    } catch (error) {
      console.error(
        `Errore nel recupero delle tracce per il tag "${tag}":`,
        error
      );
      return null;
    }
  }

  // Gestisce il rating della traccia
  async handleRatings(ratings: RatingsData): Promise<void> {
    if (this.isLoadingNewSong) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attendere...',
        detail:
          'Caricamento in corso della nuova traccia, attendere un attimo.',
        life: 3000,
      });
      return;
    }
    this.isLoadingNewSong = true;
    console.log('Valutazioni ricevute:', ratings);

    // Imposta il flag per indicare che la traccia è stata valutata
    this.isTrackRated = true;

    const currentTrackTitle = this.spotifyPlayerService.getCurrentTrackTitle();
    const currentArtist = this.spotifyPlayerService.getCurrentArtist();
    if (!currentTrackTitle || !currentArtist) {
      console.warn('Nessuna traccia o artista in riproduzione.');
      this.isLoadingNewSong = false;
      return;
    }

    try {
      const tempo =
        ratings.parameterControls.find(p => p.label === 'Tempo')?.value || 50;
      const danceability =
        ratings.parameterControls.find(p => p.label === 'Danceability')
          ?.value || 50;
      const instrumentalness =
        ratings.parameterControls.find(p => p.label === 'Instrumentalness')
          ?.value || 50;
      const speechiness =
        ratings.parameterControls.find(p => p.label === 'Speechiness')?.value ||
        50;
      const loudness =
        ratings.parameterControls.find(p => p.label === 'Loudness')?.value ||
        50;

      this.currentAudioFeatures = this.ensureAudioFeatures([
        tempo,
        danceability,
        instrumentalness,
        speechiness,
        loudness,
      ]);

      const target = {
        tempo: getTagForFeature(
          tempo,
          FEATURE_THRESHOLDS.TEMPO,
          MUSIC_TAGS.TEMPO
        ),
        dance: getTagForFeature(
          danceability,
          FEATURE_THRESHOLDS.DANCEABILITY,
          MUSIC_TAGS.DANCEABILITY
        ),
        instr: getTagForFeature(
          instrumentalness,
          FEATURE_THRESHOLDS.INSTRUMENTALNESS,
          MUSIC_TAGS.INSTRUMENTALNESS
        ),
        speech: getTagForFeature(
          speechiness,
          FEATURE_THRESHOLDS.SPEECHINESS,
          MUSIC_TAGS.SPEECHINESS
        ),
        loud: getTagForFeature(
          loudness,
          FEATURE_THRESHOLDS.LOUDNESS,
          MUSIC_TAGS.LOUDNESS
        ),
      };
      const customTags = [
        target.tempo,
        target.dance,
        target.instr,
        target.speech,
        target.loud,
      ];
      console.log('Tag personalizzati calcolati:', customTags);

      const externalTags = await lastValueFrom(
        this.lastFmService.getTrackTopTags(currentTrackTitle, currentArtist)
      ).catch(error => {
        console.error('Errore nel recupero dei tag da Last.fm:', error);
        return [];
      });
      console.log('Tag esterni recuperati da Last.fm:', externalTags);

      await this.memoryModel.addTrackToMemory(
        currentTrackTitle,
        currentArtist,
        String(this.selectedEmotion ?? 0),
        parseFloat(this.selectedEmotionLevel) || 0,
        this.selectedActivity ?? 0,
        this.selectedLocation ?? 0,
        customTags,
        tempo,
        danceability,
        instrumentalness,
        speechiness,
        loudness,
        externalTags
      );
      console.log(
        `Traccia "${currentTrackTitle}" salvata con tag:`,
        customTags
      );

      const safeEmotionLevel = Number(this.selectedEmotionLevel);

      // Ora costruisci lo stato passando safeEmotionLevel come numero
      const fullContext = this.buildRLState(
        this.selectedEmotion,
        this.selectedActivity,
        this.selectedLocation,
        safeEmotionLevel,
        this.currentAudioFeatures
      );
      const targetEmotion = [...[0, 0, 0, 0, 0]]; // Spread operator per creare un nuovo array mutabile
      targetEmotion[Number(ratings.selectedEmotion)] = 1;

      // Esegue il training sul modello e sul classificatore
      await this.memoryModel.trainModel(
        fullContext,
        this.currentAudioFeatures,
        targetEmotion
      );
      await this.tagClassifier.trainOnSample(this.currentAudioFeatures, target);
      console.log('Classifier addestrato sul campione con tag target:', target);

      const predictedTags = this.tagClassifier.predictTag(
        this.currentAudioFeatures
      );
      console.log('Tag predetti dal classificatore:', predictedTags);

      const sessionKeyResult = await Preferences.get({
        key: 'lastfmSessionKey',
      });
      const sessionKey = sessionKeyResult.value;
      if (sessionKey) {
        this.lastFmService
          .addTagsToTrack(
            currentArtist,
            currentTrackTitle,
            customTags,
            sessionKey
          )
          .subscribe(result => {
            console.log('Tag aggiornati su Last.fm:', result);
          });
      } else {
        console.warn(
          'Session key non disponibile: impossibile aggiornare i tag su Last.fm.'
        );
      }

      if (!this.lastState || this.lastState.length !== 9) {
        this.lastState = this.buildRLState(
          this.selectedEmotion,
          this.selectedActivity,
          this.selectedLocation,
          safeEmotionLevel,
          this.currentAudioFeatures
        );
      }
      const nextState = this.buildRLState(
        this.selectedEmotion,
        this.selectedActivity,
        this.selectedLocation,
        safeEmotionLevel,
        this.currentAudioFeatures
      );

      let reward = this.selectedEmotion === ratings.selectedEmotion ? 1 : 0;

      console.log('Reward calcolato (similarità coseno):', reward);

      await this.rlAgent.trainStep(this.lastState, this.lastAction, reward);
      console.log('RLAgent trainStep completato');

      await this.rlAgent.saveBestWeightsToPreferences();

      this.lastState = nextState;

      // Aggiorna il contatore di training per l'emozione corrente
      let currentEmotion = Number(this.selectedEmotion);
      if (isNaN(currentEmotion)) {
        console.error(
          'selectedEmotion non è un numero valido. Imposto il default a 0.'
        );
        currentEmotion = 0;
      }
      this.emotionTrainingCounts[currentEmotion] =
        (this.emotionTrainingCounts[currentEmotion] || 0) + 1;
      console.log(
        `Training Count per emozione ${currentEmotion}: ${this.emotionTrainingCounts[currentEmotion]}`
      );

      if (this.emotionTrainingCounts[currentEmotion] >= this.trainingLimit) {
        this.enableRating = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Addestramento Completato per questa emozione',
          detail:
            "Il modello ha appreso sufficientemente per l'emozione corrente.",
          life: 5000,
        });
      }

      await this.saveTrainingProgress();
      console.log(`Training Count persistente:`, this.emotionTrainingCounts);

      // Dopo un breve delay, avvia la prossima traccia
      setTimeout(() => {
        this.playNextSongWithRL();
      }, 2000);
    } catch (error) {
      console.error('Errore nel processo di rating:', error);
      this.isLoadingNewSong = false;
    }
  }

  // Garantisce che l'array di audio features abbia 5 elementi
  private ensureAudioFeatures(features: number[]): number[] {
    if (!features || features.length !== 5) {
      console.warn(
        `ensureAudioFeatures: lunghezza non valida (${features ? features.length : 0}). Uso valori di default.`
      );
      return [50, 50, 50, 50, 50];
    }
    return features;
  }

  // Seleziona casualmente una traccia candidata
  private selectRandomCandidate(
    candidates: { title: string; artist: string }[]
  ): { title: string; artist: string } {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  get currentTrainingCount(): number {
    return this.emotionTrainingCounts[this.selectedEmotion] || 0;
  }

  // Carica il progresso del training dalle Preferences
  private async loadTrainingProgress(): Promise<void> {
    try {
      const result = await Preferences.get({ key: this.storageKey });
      if (result.value !== null) {
        this.emotionTrainingCounts = JSON.parse(result.value);
        console.log('Training progress caricato:', this.emotionTrainingCounts);
      } else {
        console.log('Nessun training progress salvato trovato.');
      }
    } catch (error) {
      console.error('Errore nel caricamento del training progress:', error);
    }
  }

  // Salva il progresso del training nelle Preferences
  private async saveTrainingProgress(): Promise<void> {
    try {
      await Preferences.set({
        key: this.storageKey,
        value: JSON.stringify(this.emotionTrainingCounts),
      });
      console.log('Training progress salvato:', this.emotionTrainingCounts);
    } catch (error) {
      console.error('Errore nel salvataggio del training progress:', error);
    }
  }

  // Aggiorna la lista delle tracce già riprodotte
  private updateRecentlyPlayed(title: string): void {
    const titleLower = title.toLowerCase();
    if (!this.recentlyPlayed.includes(titleLower)) {
      this.recentlyPlayed.push(titleLower);
      if (this.recentlyPlayed.length > 30) {
        this.recentlyPlayed.shift();
      }
      this.saveRecentlyPlayed();
    }
  }
  private async saveRecentlyPlayed(): Promise<void> {
    try {
      const dataToStore = {
        list: this.recentlyPlayed,
        timestamp: Date.now(),
      };
      await Preferences.set({
        key: this.recentlyPlayedKey,
        value: JSON.stringify(dataToStore),
      });
      console.log('✅ Lista recentlyPlayed salvata:', dataToStore);
    } catch (error) {
      console.error('🚨 Errore nel salvataggio di recentlyPlayed:', error);
    }
  }

  /**
   * Carica la lista delle tracce riprodotte. Se sono passate più di 5 ore dall'ultimo aggiornamento,
   * resetta la lista; altrimenti la ripristina.
   */
  private async loadRecentlyPlayed(): Promise<void> {
    try {
      const result = await Preferences.get({ key: this.recentlyPlayedKey });
      if (result.value) {
        const storedData = JSON.parse(result.value);
        const { list, timestamp } = storedData;
        const now = Date.now();
        if (now - timestamp > this.RECENTLY_PLAYED_MAX_AGE) {
          console.log('🔄 Sono passate più di 5 ore: reset di recentlyPlayed.');
          this.recentlyPlayed = [];
          await Preferences.remove({ key: this.recentlyPlayedKey });
        } else {
          this.recentlyPlayed = list || [];
          console.log('✅ Lista recentlyPlayed caricata:', this.recentlyPlayed);
        }
      } else {
        console.log('Nessuna recentlyPlayed salvata, uso lista vuota.');
        this.recentlyPlayed = [];
      }
    } catch (error) {
      console.error('🚨 Errore nel caricamento di recentlyPlayed:', error);
      this.recentlyPlayed = [];
    }
  }

  // Mappe per le etichette da mostrare
  private emotionLabels: { [key: number]: string } = {
    0: 'Tristezza',
    1: 'Rabbia',
    2: 'Felicità',
    3: 'Paura',
    4: 'Disgusto',
  };
  private activityLabels: { [key: number]: string } = {
    1: 'Lavorando',
    2: 'Studiando',
    3: 'Rilassando',
    4: 'Allenandoti',
    5: 'Leggendo',
    6: 'Giocando',
    7: 'Meditando',
    8: 'Cucinando',
    9: 'Fotografando',
    10: 'Panorami',
  };
  private locationLabels: { [key: number]: string } = {
    1: 'Casa',
    2: 'Ufficio',
    3: 'Scuola',
    4: 'Palestra',
    5: 'Parco',
    6: 'Viaggio',
  };

  get emotionLevelLabel(): string {
    // Assumiamo che this.selectedEmotion sia un numero e che this.emotionLabels sia definito in maiuscolo
    const emotionKey = this.emotionLabels[this.selectedEmotion].toUpperCase(); // ad es. "PAURA"
    const levelIndex = Number(this.selectedEmotionLevel); // converte "7" in 7
    const levels = EMOTION_CONFIGURATIONS[emotionKey];
    if (levels && levelIndex >= 0 && levelIndex < levels.length) {
      return levels[levelIndex].label; // Restituisce il label (ad es. "TERRORE")
    }
    return 'Sconosciuto';
  }

  private mapEmotionLevelFromConfig(
    emotionKey: string,
    levelLabel: string
  ): number {
    // Normalizza la chiave in uppercase
    const normalizedKey = emotionKey.toUpperCase();
    const levels = EMOTION_CONFIGURATIONS[normalizedKey];
    if (!levels || levels.length === 0) {
      console.warn(
        `Nessuna configurazione trovata per l'emozione: ${normalizedKey}`
      );
      return 0;
    }
    // Cerca l'indice dove il label corrisponde (case-insensitive)
    const index = levels.findIndex(
      item => item.label.toUpperCase() === levelLabel.toUpperCase()
    );
    if (index === -1) {
      console.warn(
        `Livello "${levelLabel}" non trovato per l'emozione ${normalizedKey}. Uso default (0).`
      );
      return 0;
    }
    return index;
  }

  get emotionLabel(): string {
    return this.emotionLabels[this.selectedEmotion] || 'Sconosciuta';
  }
  get activityLabel(): string {
    return this.activityLabels[this.selectedActivity] || 'Sconosciuta';
  }
  get locationLabel(): string {
    return this.locationLabels[this.selectedLocation] || 'Sconosciuta';
  }
  // Metodo aggiornato per caricare e parsare i parametri
  async loadSelectedParameters(): Promise<void> {
    try {
      const locationResult = await Preferences.get({ key: 'selectedLocation' });
      if (locationResult.value) {
        this.selectedLocation = this.mapLocation(locationResult.value);
      }
      const activityResult = await Preferences.get({ key: 'selectedActivity' });
      if (activityResult.value) {
        this.selectedActivity = this.mapActivity(activityResult.value);
      }
      const emotionResult = await Preferences.get({ key: 'selectedEmotion' });
      if (emotionResult.value) {
        this.selectedEmotion = this.mapEmotion(emotionResult.value);
      }
      const emotionLevelResult = await Preferences.get({
        key: 'selectedEmotionLevel',
      });
      if (emotionLevelResult.value) {
        // Ottieni la chiave dell'emozione, ad esempio "PAURA" per selectedEmotion 3
        const emotionKey = this.emotionLabels[this.selectedEmotion];
        // Converte il label in indice usando la configurazione
        const levelIndex = this.mapEmotionLevelFromConfig(
          emotionKey,
          emotionLevelResult.value
        );
        // Salva l'indice come stringa oppure come numero, a seconda delle tue esigenze
        this.selectedEmotionLevel = String(levelIndex);
      }
      console.log('Parametri caricati:', {
        selectedLocation: this.selectedLocation,
        selectedActivity: this.selectedActivity,
        selectedEmotion: this.selectedEmotion,
        selectedEmotionLevel: this.selectedEmotionLevel,
      });
    } catch (error) {
      console.error('Errore nel caricamento dei parametri:', error);
    }
  }
}
