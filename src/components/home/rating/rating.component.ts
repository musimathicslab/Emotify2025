import {
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SliderModule } from 'primeng/slider';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { RatingModule } from 'primeng/rating';
import { Tooltip } from 'primeng/tooltip';
import { EmotionsService } from '../../../services/emotions.service';

@Component({
  selector: 'app-rating',
  standalone: true,
  templateUrl: './rating.component.html',
  styleUrls: ['./rating.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SliderModule,
    ButtonModule,
    RadioButtonModule,
    RatingModule,
    Tooltip,
  ],
})
export class RatingComponent implements OnInit {
  @Output() onSubmitRatings = new EventEmitter<any>();

  parameterList!: ElementRef<HTMLDivElement>;
  @ViewChild('emotionGrid', { static: false })
  emotionGrid!: ElementRef<HTMLDivElement>;

  formGroup!: FormGroup;
  parameters = [
    { label: 'Tempo', value: 50 },
    { label: 'Danceability', value: 50 },
    { label: 'Instrumentalness', value: 50 },
    { label: 'Speechiness', value: 50 },
    { label: 'Loudness', value: 50 },
  ];
  emotions: { code: number; name: string; img: string }[] = [];
  activeParameterIndex: number = 0;

  constructor(
    private fb: FormBuilder,
    private emotionService: EmotionsService
  ) {}

  ngOnInit() {
    // Il formGroup include 'songRating' (non 'rating')
    this.formGroup = this.fb.group({
      selectedEmotion: [0],
      songRating: [3],
      parameterControls: this.fb.array([]),
    });
    this.emotions = this.emotionService.getEmotionNamesWithImg();
    this.initializeFormControls();
  }

  initializeFormControls() {
    const parameterArray = this.formGroup.get('parameterControls') as FormArray;
    if (!parameterArray) return;
    parameterArray.clear();
    this.parameters.forEach(param => {
      parameterArray.push(
        this.fb.group({
          label: new FormControl(param.label),
          value: new FormControl(50, { validators: [Validators.required] }),
        })
      );
    });
  }

  // Mappatura degli estremi con un unico sostantivo per ciascun parametro
  sliderLabels: { [key: string]: { low: string; high: string } } = {
    Tempo: { low: 'lento', high: 'veloce' },
    Danceability: { low: 'statico', high: 'dinamico' },
    Instrumentalness: { low: 'vocale', high: 'strumentale' },
    Speechiness: { low: 'cantato', high: 'parlato' },
    Loudness: { low: 'rilassante', high: 'potente' },
  };

  // Metodo per ottenere l'etichetta minima
  getSliderMinLabel(index: number): string {
    const label = this.getParameterLabel(index);
    return this.sliderLabels[label]?.low || 'Min';
  }

  // Metodo per ottenere l'etichetta massima
  getSliderMaxLabel(index: number): string {
    const label = this.getParameterLabel(index);
    return this.sliderLabels[label]?.high || 'Max';
  }

  get parameterControls(): FormArray {
    return this.formGroup.get('parameterControls') as FormArray;
  }

  selectEmotion(emotionCode: number) {
    this.formGroup.get('selectedEmotion')?.setValue(emotionCode);
  }

  submitRatings() {
    console.log('⭐ Valutazioni inviate:', this.formGroup.value);
    this.onSubmitRatings.emit(this.formGroup.value);
  }

  getParameterLabel(index: number): string {
    return this.parameterControls.at(index).get('label')?.value;
  }

  parameterTooltips = [
    'Velocità del brano (battiti per minuto).',
    'Quanto è ballabile la traccia.',
    'Quanto è strumentale (senza voce).',
    'Percentuale di parlato nel brano.',
    'Volume medio della traccia.',
  ];

  getParameterTooltip(index: number): string {
    return this.parameterTooltips[index] || '';
  }

  // Navigazione per la versione mobile del carousel dei parametri
  goToParameter(index: number) {
    this.activeParameterIndex = index;
  }

  // Funzione per scroll (se volessi usare anche le frecce per la versione mobile, opzionale)
  scrollParam(direction: 'left' | 'right') {
    if (direction === 'left') {
      this.activeParameterIndex = Math.max(0, this.activeParameterIndex - 1);
    } else {
      this.activeParameterIndex = Math.min(
        this.parameterControls.length - 1,
        this.activeParameterIndex + 1
      );
    }
  }

  scrollEmotion(direction: 'left' | 'right') {
    if (!this.emotionGrid) return;

    const element = this.emotionGrid.nativeElement;
    const scrollAmount = element.clientWidth;

    // Calcolo la posizione di scroll target (nuova posizione)
    let newLeft =
      element.scrollLeft +
      (direction === 'left' ? -scrollAmount : scrollAmount);

    // Limito il valore tra 0 (inizio) e maxScrollLeft (fine)
    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    if (newLeft < 0) {
      newLeft = 0;
    } else if (newLeft > maxScrollLeft) {
      newLeft = maxScrollLeft;
    }
    element.scrollTo({ left: newLeft, behavior: 'smooth' });
  }

  getFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }
}
