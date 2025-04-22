import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, lastValueFrom, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';

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
import { CapitalizePipe } from '../../../pipes/capitalize.pipe';

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
    CapitalizePipe, // Importa la pipe qui
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
  private isWarningShown = false; // Previene messaggi duplicati

  // Preferences: recently played e training progress
  private recentlyPlayedKey = 'recentlyPlayedData';
  private readonly RECENTLY_PLAYED_MAX_AGE = 5 * 60 * 60 * 1000;
  private recentlyPlayed: string[] = [];
  isLoadingNewSong = false;
  private emotionTrainingCounts: { [emotion: number]: number } = {};
  trainingLimit = 10; // Limite per ogni emozione

  // Abilita/disabilita rating in base al training
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
  isTrackRated = false; // Previene skip automatico

  private isAppActive = true; // L'app parte in primo piano

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
    // Inizializzo RLAgent con 9 come dimensione di input e 5 come dimensione di output (le 5 audio features)
    this.rlAgent = new RLAgent(9, 5);
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

  // Aggiungi una proprietà privata per tenere traccia se il cambio traccia è già stato triggerato
  private nextTrackTriggered: boolean = false;

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

    this.spotifyPlayerService.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.progress = progress;
        this.formGroup.patchValue({ value: progress }, { emitEvent: false });

        // Se il progress è ≥98 e non è già stato triggerato il cambio traccia:
        if (this.progress >= 99) {
          this.nextTrackTriggered = true; // Blocca invocazioni ripetute

          // Se non abbiamo completato il training, verifica se è necessario chiedere la valutazione
          if (!(this.currentTrainingCount >= this.trainingLimit)) {
            if (!this.isTrackRated && !this.isWarningShown) {

              this.messageService.add({
                severity: 'warn',
                summary: 'Valutazione richiesta',
                detail:
                  'Devi valutare la traccia prima di passare alla successiva.',
                life: 3000,
              });
              this.sendTrackRatingNotification();
              this.isWarningShown = true;
              return;
            } else if (this.isTrackRated && !this.isWarningShown) {
              this.isWarningShown = true;
              this.playNextSongWithRL();
            }
          } else {
            // Se il training è completato, passa direttamente alla traccia successiva
            this.playNextSongWithRL();
          }
        }

        // Resetta il flag se il progress scende sotto la soglia,
        // così da poter triggerare un nuovo cambio traccia quando la traccia effettivamente finisce
        if (this.progress < 98) {
          this.nextTrackTriggered = false;
          this.isWarningShown = false;
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

    if (this.currentTrainingCount >= this.trainingLimit) {
      this.isTrackRated = false;
      this.isWarningShown = false;
      this.playNextSongWithRL();
      return;
    }

    if (
      !this.isTrackRated &&
      !(this.currentTrainingCount >= this.trainingLimit)
    ) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Valutazione richiesta',
        detail: 'Devi valutare la traccia prima di passare alla successiva.',
        life: 3000,
      });
      this.sendTrackRatingNotification();
      this.isWarningShown = true;
      return;
    }

    this.isTrackRated = false;
    this.isWarningShown = false;
    this.spotifyPlayerService.nextTrack();
  }

  get currentTrackId$() {
    return this.spotifyPlayerService.currentTrackId$;
  }

  // Costruisce lo stato (9 elementi: 4 parametri + 5 audio features)
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

  public async playNextSongWithRL(): Promise<void> {
    this.isLoadingNewSong = true;

    // Verifica che lastState sia valido, altrimenti lo imposta di default (9 elementi: 4 di contesto + 5 features)
    if (!this.lastState || this.lastState.length !== 9) {
      console.warn('this.lastState non valido, imposto uno stato di default.');
      // Potresti voler usare un default più contestuale qui se possibile
      this.lastState = [ this.selectedEmotion ?? 0, this.selectedActivity ?? 0, this.selectedLocation ?? 0, Number(this.selectedEmotionLevel) || 0, 50, 50, 50, 50, 50 ];
    }

    // Se il training è completato, usa l'agente RL per predire le audio features
    // (Questa parte rimane come nel tuo codice)
    try { // Aggiunto try/catch qui per sicurezza determinazione features
      if (this.currentTrainingCount >= this.trainingLimit) {
        this.currentAudioFeatures = this.rlAgent.predictNextAudioFeatures(
          this.lastState
        );
        console.log('Audio features predette:', this.currentAudioFeatures);
      } else {
        // Potresti voler aggiungere la logica per prendere features da traccia corrente qui
        this.currentAudioFeatures = this.ensureAudioFeatures(
          this.currentAudioFeatures // O [50,50,50,50,50] se non ci sono features correnti
        );
      }
      this.currentAudioFeatures = this.ensureAudioFeatures(this.currentAudioFeatures);
    } catch (error) {
      console.error("Errore determinazione features:", error);
      this.currentAudioFeatures = this.ensureAudioFeatures([50, 50, 50, 50, 50]);
    }


    let candidates: { title: string; artist: string }[] = [];
    const currentEmotion = this.selectedEmotion;
    const currentCount = this.emotionTrainingCounts[currentEmotion] || 0;

    // Recupero candidati (Questa parte rimane come nel tuo codice, con i fallback Top/Liked)
    try { // Aggiunto try/catch per sicurezza chiamate API
      if (currentCount < this.trainingLimit) {
        console.log( 'Training in corso: uso top tracks -> liked tracks.' );
        candidates = await this.spotifyPlayerService.getUserTopTracks(50);
        if(candidates.length === 0){
          console.warn("Top tracks vuote (training), uso liked tracks.");
          candidates =  await this.spotifyPlayerService.getUserLikedTracks() ;
        }
      } else {
        console.log( 'Post-training: uso tags -> top tracks -> liked tracks.' );
        const predicted = this.tagClassifier.predictTag( this.currentAudioFeatures );
        const predictedTags = [ predicted.tempo, predicted.dance, predicted.instr, predicted.speech, predicted.loud, ].filter(t => t); // Filtra tag nulli/vuoti
        console.log('Predicted tags:', predictedTags);

        if (predictedTags.length > 0) {
          // ** NOTA: Manteniamo il tuo loop for...of per i tag per semplicità, ma attento agli errori **
          const currentTitle = this.spotifyPlayerService.getCurrentTrackTitle();
          const currentArtist = this.spotifyPlayerService.getCurrentArtist();
          const commonMemoryTags = await this.analyzeCommonMemoryTags( predictedTags, currentTitle, currentArtist );
          console.log('Common memory tags:', commonMemoryTags);
          for (const tag of commonMemoryTags) {
            try { // Aggiunto try/catch per errore singolo tag
              const candidate = await this.findTrackByTag(tag);
              if (candidate) candidates.push(candidate);
            } catch (tagError) {
              console.warn(`Errore ricerca per tag "${tag}":`, tagError);
            }
          }
        }

        if (candidates.length === 0) {
          console.warn( 'Nessun candidato trovato tramite tag. Uso top tracks Spotify.' );
          candidates = await this.spotifyPlayerService.getUserTopTracks(50);
          if(candidates.length === 0){
            console.warn("Top tracks vuote (post-training), uso liked tracks.");
            candidates =  await this.spotifyPlayerService.getUserLikedTracks() ;
          }
        }
      }
    } catch (apiError) {
      console.error("Errore critico durante recupero candidati:", apiError);
      candidates = []; // Assicura lista vuota
    }


    // Rimuove duplicati (Questa parte rimane come nel tuo codice)
    // ** NOTA: Usa una chiave più robusta per la deduplica **
    console.log(`Candidati prima deduplica: ${candidates.length}`);
    const initialUniqueMap = new Map<string, { title: string; artist: string }>();
    candidates.forEach(c => {
      const key = `${c.title.toLowerCase()}|${c.artist.split(',')[0].trim().toLowerCase()}`;
      if (!initialUniqueMap.has(key)) initialUniqueMap.set(key, c);
    });
    candidates = Array.from(initialUniqueMap.values()); // 'candidates' ora contiene unici
    console.log(`Candidati unici: ${candidates.length}`);


    // Filtro Recently Played (Questa parte rimane come nel tuo codice)
    let filteredCandidates = candidates.filter(
      candidate => !this.recentlyPlayed.includes(candidate.title.toLowerCase())
    );
    console.log(`Candidati dopo filtro recenti: ${filteredCandidates.length}`);


    // Fallback per poche tracce (Questa parte rimane come nel tuo codice, incluso il BUG originale!)
    // ** NOTA: Questo blocco nel tuo codice originale aveva un bug (non usava 'fallback'). Lo lascio così per ora.**
    const minRequiredTracks = 5;
    if (filteredCandidates.length > 0 && filteredCandidates.length < minRequiredTracks) {
      console.warn( `Fallback: solo ${filteredCandidates.length} tracce candidate fresche. Aggiungo ulteriori (logica originale con potenziale bug).` );
      try {
        let fallback = await this.spotifyPlayerService.getUserTopTracks(50);
        fallback = fallback.filter(
          candidate =>
            !this.recentlyPlayed.includes(candidate.title.toLowerCase()) &&
            !filteredCandidates.some(fc => fc.title.toLowerCase() === candidate.title.toLowerCase()) // Evita duplicati dalla lista filtrata
        );
        // !!! ATTENZIONE: NEL TUO CODICE ORIGINALE MANCAVA filteredCandidates = filteredCandidates.concat(fallback); !!!
        // Lascio così per essere fedele al tuo codice, ma questo blocco non fa nulla.
        if (fallback.length > 0) console.log(`  -> Trovate ${fallback.length} tracce fallback (non aggiunte).`);
      } catch (fallbackError) {
        console.error("Errore recupero tracce fallback:", fallbackError);
      }
    }

    // Se la lista filtrata è vuota, MA avevamo candidati *prima* del filtro...
    if (filteredCandidates.length === 0 && candidates.length > 0) {
      console.warn(
        '🚫 Tutti i candidati unici sono recenti. Uso lista originale per non bloccare.'
      );
      // Usa la lista originale (già deduplicata) invece di fermarsi
      filteredCandidates = candidates;
      // NON resettare recentlyPlayed qui.
    }

    // Controlla se, nonostante tutto, non abbiamo NESSUN candidato
    if (filteredCandidates.length === 0) {
      // Questo succede SOLO se candidates era vuoto fin dall'inizio
      console.error("🆘 ERRORE CRITICO: Nessun candidato disponibile da NESSUNA fonte. Impossibile procedere.");
      this.messageService.add({ severity: 'error', summary: 'Nessuna Canzone', detail: 'Impossibile trovare tracce da riprodurre.', life: 6000 });
      this.isLoadingNewSong = false;
      return; // Stop definitivo
    }


    const chosenCandidate = this.selectRandomCandidate(filteredCandidates); // Ora sappiamo che non è vuota
    console.log(`✅ Candidato scelto: "${chosenCandidate.title}"`);
    const searchArtist = chosenCandidate.artist.split(',')[0].trim();
    let trackId: string | null = null; // Inizializza a null

    try { // Try/catch per ricerca e play
      trackId = await lastValueFrom(
        this.spotifyPlayerService.searchTrack( chosenCandidate.title, searchArtist ).pipe(catchError(() => of(null)))
      );

      if (trackId) {
        this.updateRecentlyPlayed(chosenCandidate.title);
        await this.spotifyPlayerService.playTrack(trackId);
        console.log(`▶️ Riproduzione avviata (ID: ${trackId})`);

        // Aggiorna stato RL
        const safeEmotionLevel = Number(this.selectedEmotionLevel) || 0;
        const state = this.buildRLState( this.selectedEmotion, this.selectedActivity, this.selectedLocation, safeEmotionLevel, this.currentAudioFeatures );
        console.log('💾 Stato RL aggiornato:', state);
        this.lastState = state;

      } else {
        console.error(`❌ TrackId non trovato su Spotify per "${chosenCandidate.title}" - "${searchArtist}".`);
        this.messageService.add({ severity: 'warn', summary: 'Traccia Non Trovata', detail: `"${chosenCandidate.title}" non trovata.`, life: 4000 });
        // Ci fermiamo qui per questa traccia non trovata
        this.isLoadingNewSong = false;
        return;
      }
    } catch(error) {
      console.error("❌ Errore durante ricerca/riproduzione:", error);
      this.messageService.add({ severity: 'error', summary: 'Errore Player', detail: 'Impossibile avviare la traccia.', life: 4000 });
      this.isLoadingNewSong = false;
      return;
    }

    console.log('✅ Selezione e avvio traccia completati.');
    this.isLoadingNewSong = false;
  }


  private async analyzeCommonMemoryTags(
    predictedTags: string[],
    currentTitle: string,
    currentArtist: string,
    topN: number = 10,
    minRequired: number = 3
  ): Promise<string[]> {
    const memoryTracks = this.memoryModel.getAllTracks();
    const filteredTracks = memoryTracks.filter(track => {
      if (!track.tags || !Array.isArray(track.tags)) return false;
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

      const fullContext = this.buildRLState(
        this.selectedEmotion,
        this.selectedActivity,
        this.selectedLocation,
        safeEmotionLevel,
        this.currentAudioFeatures
      );
      const targetEmotion = [0, 0, 0, 0, 0];
      targetEmotion[Number(ratings.selectedEmotion)] = 1;

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

      let currentEmotionNum = Number(this.selectedEmotion);
      if (isNaN(currentEmotionNum)) {
        console.error(
          'selectedEmotion non è un numero valido. Imposto il default a 0.'
        );
        currentEmotionNum = 0;
      }
      this.emotionTrainingCounts[currentEmotionNum] =
        (this.emotionTrainingCounts[currentEmotionNum] || 0) + 1;
      console.log(
        `Training Count per emozione ${currentEmotionNum}: ${this.emotionTrainingCounts[currentEmotionNum]}`
      );

      if (this.emotionTrainingCounts[currentEmotionNum] >= this.trainingLimit) {
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
      console.log('Training Count persistente:', this.emotionTrainingCounts);

      setTimeout(() => {
        this.playNextSongWithRL();
      }, 2000);
    } catch (error) {
      console.error('Errore nel processo di rating:', error);
      this.isLoadingNewSong = false;
    }
  }

  private ensureAudioFeatures(features: number[]): number[] {
    if (!features || features.length !== 5) {
      console.warn(
        `ensureAudioFeatures: lunghezza non valida (${features ? features.length : 0}). Uso valori di default.`
      );
      return [50, 50, 50, 50, 50];
    }
    return features;
  }

  private selectRandomCandidate(
    candidates: { title: string; artist: string }[]
  ): { title: string; artist: string } {
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }

  get currentTrainingCount(): number {
    return this.emotionTrainingCounts[this.selectedEmotion] || 0;
  }

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
      const dataToStore = { list: this.recentlyPlayed, timestamp: Date.now() };
      await Preferences.set({
        key: this.recentlyPlayedKey,
        value: JSON.stringify(dataToStore),
      });
      console.log('✅ Lista recentlyPlayed salvata:', dataToStore);
    } catch (error) {
      console.error('🚨 Errore nel salvataggio di recentlyPlayed:', error);
    }
  }

  private async loadRecentlyPlayed(): Promise<void> {
    try {
      const result = await Preferences.get({ key: this.recentlyPlayedKey });
      if (result.value) {
        const storedData = JSON.parse(result.value);
        const { list, timestamp } = storedData;
        const now = Date.now();
        if (now - timestamp > this.RECENTLY_PLAYED_MAX_AGE) {
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
    const emotionKey = this.emotionLabels[this.selectedEmotion].toUpperCase();
    const levelIndex = Number(this.selectedEmotionLevel);
    const levels = EMOTION_CONFIGURATIONS[emotionKey];
    if (levels && levelIndex >= 0 && levelIndex < levels.length) {
      return levels[levelIndex].label;
    }
    return 'Sconosciuto';
  }

  private mapEmotionLevelFromConfig(
    emotionKey: string,
    levelLabel: string
  ): number {
    const normalizedKey = emotionKey.toUpperCase();
    const levels = EMOTION_CONFIGURATIONS[normalizedKey];
    if (!levels || levels.length === 0) {
      console.warn(
        `Nessuna configurazione trovata per l'emozione: ${normalizedKey}`
      );
      return 0;
    }
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
        const emotionKey = this.emotionLabels[this.selectedEmotion];
        const levelIndex = this.mapEmotionLevelFromConfig(
          emotionKey,
          emotionLevelResult.value
        );
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
