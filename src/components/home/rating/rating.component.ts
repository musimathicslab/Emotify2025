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
import { TooltipModule } from 'primeng/tooltip';
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
    TooltipModule,
  ],
})
export class RatingComponent implements OnInit {
  @Output() onSubmitRatings = new EventEmitter<any>();

  @ViewChild('emotionGrid', { static: false })
  emotionGrid!: ElementRef<HTMLDivElement>;

  formGroup!: FormGroup;
  parameters = [
    { label: 'Tempo', value: 50 },
    { label: 'Loudness', value: 50 },
    { label: 'Danceability', value: 50 },
    { label: 'Instrumentalness', value: 50 },
    { label: 'Speechiness', value: 50 },
  ];
  emotions: { code: number; name: string; img: string }[] = [];
  activeParameterIndex: number = 0;

  // Mappatura degli estremi con un unico sostantivo per ciascun parametro
  sliderLabels: { [key: string]: { low: string; high: string } } = {
    Tempo: { low: 'lento', high: 'veloce' },
    Danceability: { low: 'statico', high: 'dinamico' },
    Instrumentalness: { low: 'vocale', high: 'strumentale' },
    Speechiness: { low: 'cantato', high: 'parlato' },
    Loudness: { low: 'rilassante', high: 'potente' },
  };

  parameterTooltips = [
    'Velocità del brano (battiti per minuto).',
    'Volume medio della traccia.',
    'Quanto è ballabile la traccia.',
    'Quanto è strumentale (senza voce).',
    'Percentuale di parlato nel brano.',
  ];

  constructor(
    private fb: FormBuilder,
    private emotionService: EmotionsService
  ) {}

  ngOnInit() {
    this.formGroup = this.fb.group({
      selectedEmotion: [0],
      parameterControls: this.fb.array(
        this.parameters.map(param =>
          this.fb.group({
            label: new FormControl(param.label),
            value: new FormControl(param.value, Validators.required),
          })
        )
      ),
    });
    this.emotions = this.emotionService.getEmotionNamesWithImg();
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
    return this.parameterControls.at(index).get('label')?.value || '';
  }

  getSliderMinLabel(index: number): string {
    const label = this.getParameterLabel(index);
    return this.sliderLabels[label]?.low || 'Min';
  }

  getSliderMaxLabel(index: number): string {
    const label = this.getParameterLabel(index);
    return this.sliderLabels[label]?.high || 'Max';
  }

  getParameterTooltip(index: number): string {
    return this.parameterTooltips[index] || '';
  }

  getFormGroup(control: AbstractControl): FormGroup {
    return control as FormGroup;
  }

  shouldShowParameter(index: number): boolean {
    const instrumentalnessValue =
      this.parameterControls.at(3).get('value')?.value ?? 0;

    if (index != 4) {
      return true;
    }

    return instrumentalnessValue > 50;
  }

}
