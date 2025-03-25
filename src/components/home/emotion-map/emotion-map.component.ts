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

  // Questo array conterrà le emozioni correnti
  emotions: any[] = [];

  // Gestione tooltip
  hoveredEmotion: any = null;
  tooltipPosition = { x: 0, y: 0 };

  constructor() {}

  ngOnInit(): void {
    // Se la larghezza dello schermo è < 768, imposta la modalità mobile
    this.isMobile = window.innerWidth < 768;
    // Seleziona l'array di emozioni appropriato
    this.emotions = this.isMobile ? this.emotionsMobile : this.emotionsDesktop;
  }

  ngAfterViewInit(): void {
    this.animateEmotions();
  }

  animateEmotions(): void {
    const svg = this.svgContainer.nativeElement;

    this.emotions.forEach((emotion, index) => {
      const circles = svg.querySelectorAll(`#group-${index} circle`);
      const mainCircle = svg.querySelector(`#circle-${index}`);

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

  // Tooltip
  onMouseEnter(event: MouseEvent, emotion: any): void {
    this.hoveredEmotion = emotion;
    this.updateTooltipPosition(event);
  }

  onMouseLeave(): void {
    this.hoveredEmotion = null;
  }

  updateTooltipPosition(event: MouseEvent): void {
    this.tooltipPosition.x = event.clientX + 15;
    this.tooltipPosition.y = event.clientY + 15;
  }
}
