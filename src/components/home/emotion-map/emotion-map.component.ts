import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { gsap } from 'gsap';
import { NgForOf, NgIf } from '@angular/common';

@Component({
  selector: 'app-emotion-map',
  templateUrl: './emotion-map.component.html',
  styleUrls: ['./emotion-map.component.css'],
  standalone: true,
  imports: [NgIf, NgForOf],
})
export class EmotionMapComponent implements OnInit, AfterViewInit {
  @ViewChild('svgContainer', { static: true }) svgContainer!: ElementRef;
  @Output() onEmotionClick = new EventEmitter<string>();

  // Verifica se è mobile
  isMobile = false;

  // Array di emozioni per desktop
  emotionsDesktop = [
    {
      x: 180,
      y: 260,
      baseRadius: 150,
      color: 'rgba(0, 180, 60, 0.6)',
      label: 'DISGUSTO',
    },
    {
      x: 450,
      y: 150,
      baseRadius: 150,
      color: 'rgba(175, 50, 200, 0.6)',
      label: 'PAURA',
    },
    {
      x: 400,
      y: 380,
      baseRadius: 150,
      color: 'rgba(250, 70, 20, 0.6)',
      label: 'RABBIA',
    },
    {
      x: 700,
      y: 260,
      baseRadius: 150,
      color: 'rgba(50, 150, 255, 0.6)',
      label: 'TRISTEZZA',
    },
    {
      x: 620,
      y: 430,
      baseRadius: 150,
      color: 'rgba(255, 200, 0, 0.6)',
      label: 'FELICITÀ',
    },
  ];
  emotionsMobile = [
    {
      x: 160,
      y: 150,
      baseRadius: 150,
      color: 'rgba(0, 180, 60, 0.6)',
      label: 'DISGUSTO',
    },
    {
      x: 400,
      y: 220,
      baseRadius: 150,
      color: 'rgba(175, 50, 200, 0.6)',
      label: 'PAURA',
    },
    {
      x: 200,
      y: 340,
      baseRadius: 150,
      color: 'rgba(250, 70, 20, 0.6)',
      label: 'RABBIA',
    },
    {
      x: 450,
      y: 460,
      baseRadius: 150,
      color: 'rgba(50, 150, 255, 0.6)',
      label: 'TRISTEZZA',
    },
    {
      x: 250,
      y: 580,
      baseRadius: 150,
      color: 'rgba(255, 200, 0, 0.6)',
      label: 'FELICITÀ',
    },
  ];

  emotions: Array<{
    x: number;
    y: number;
    baseRadius: number;
    color: string;
    label: string;
  }> = [];

  hoveredEmotion: {
    x: number;
    y: number;
    baseRadius: number;
    color: string;
    label: string;
  } | null = null;
  tooltipPosition = { x: 0, y: 0 };

  ngOnInit(): void {
    this.isMobile = window.innerWidth < 768;
    this.emotions = this.isMobile ? this.emotionsMobile : this.emotionsDesktop;
  }

  ngAfterViewInit(): void {
    this.animateEmotions();
  }

  animateEmotions(): void {
    const svgEl = this.svgContainer.nativeElement;
    this.emotions.forEach((emotion, index) => {
      const circles = svgEl.querySelectorAll(`#group-${index} circle`);
      const mainCircle = svgEl.querySelector(`#circle-${index}`);

      if (mainCircle) {
        gsap.to(mainCircle, {
          attr: { r: emotion.baseRadius + 12 },
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      circles.forEach((circle: SVGCircleElement, level: number) => {
        gsap.to(circle, {
          attr: { r: emotion.baseRadius - level * 12 },
          duration: 2.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });

      gsap.to(`#group-${index}`, {
        x: `+=${Math.random() * 15 - 7.5}`,
        y: `+=${Math.random() * 10 - 5}`,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });
  }

  // Gestione hover/touch tooltip
  onPointerEnter(event: PointerEvent, emotion: any): void {
    this.hoveredEmotion = emotion;
    this.updateTooltipPosition(event.clientX, event.clientY);
  }

  onPointerLeave(): void {
    this.hoveredEmotion = null;
  }

  onTouchStart(event: TouchEvent, emotion: any): void {
    // event.preventDefault(); // <--- RIMUOVI O COMMENTA QUESTA RIGA
    const touch = event.touches[0];
    this.hoveredEmotion = emotion;
    this.updateTooltipPosition(touch.clientX, touch.clientY);
  }

  onTouchEnd(): void {
    // Potresti non aver più bisogno di onTouchEnd se pointerleave gestisce già la cosa
    // Ma tienilo per ora per assicurarti che il tooltip si nasconda al rilascio del tocco
    this.hoveredEmotion = null;
  }

   updateTooltipPosition(x: number, y: number): void {
    this.tooltipPosition.x = x + 15;
    this.tooltipPosition.y = y + 15;
  }
}
