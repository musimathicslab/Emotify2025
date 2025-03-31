import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';

@Injectable({
  providedIn: 'root',
})
export class StepService {
  private currentStepSubject = new BehaviorSubject<number>(0);
  public currentStep = this.currentStepSubject.asObservable();

  constructor() {
    this.loadStep();
  }

  async loadStep(): Promise<void> {
    const result = await Preferences.get({ key: 'currentStep' });
    const savedStep = result.value ? parseInt(result.value, 10) : 0;
    this.currentStepSubject.next(savedStep);
  }

  async setStep(step: number): Promise<void> {
    // Salva lo step
    await Preferences.set({ key: 'currentStep', value: step.toString() });
    // Salva anche il timestamp corrente
    await Preferences.set({
      key: 'currentStepTimestamp',
      value: Date.now().toString(),
    });
    // Notifica i subscriber (ad es. se usi un BehaviorSubject)
    this.currentStepSubject.next(step);
  }
}
