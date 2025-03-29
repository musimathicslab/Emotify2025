import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as d3 from 'd3';
import { Preferences } from '@capacitor/preferences';
import { NgIf } from '@angular/common';
import { Capacitor } from '@capacitor/core';

export const EMOTION_CONFIGURATIONS: { [key: string]: any[] } = {
  PAURA: [
    {
      label: 'APPRENSIONE',
      color: 'rgba(156,39,176,0.1)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 0, y: 0 },
        { x: 5, y: 10 },
        { x: 10, y: 15 },
        { x: 15, y: 10 },
        { x: 20, y: 0 },
      ],
    },
    {
      label: 'NERVOSISMO',
      color: 'rgba(156,39,176,0.2)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 12, y: 18 },
        { x: 18, y: 22 },
        { x: 24, y: 16 },
        { x: 30, y: 0 },
      ],
    },
    {
      label: 'ANSIA',
      color: 'rgba(156,39,176,0.3)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 10, y: 0 },
        { x: 15, y: 10 },
        { x: 25, y: 28 },
        { x: 35, y: 30 },
        { x: 45, y: 20 },
        { x: 50, y: 0 },
      ],
    },
    {
      label: 'TIMORE',
      color: 'rgba(156,39,176,0.4)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 25, y: 0 },
        { x: 30, y: 12 },
        { x: 40, y: 30 },
        { x: 50, y: 40 },
        { x: 60, y: 30 },
        { x: 65, y: 0 },
      ],
    },
    {
      label: 'DISPERAZIONE',
      color: 'rgba(156,39,176,0.5)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 40, y: 0 },
        { x: 45, y: 15 },
        { x: 55, y: 35 },
        { x: 65, y: 45 },
        { x: 75, y: 32 },
        { x: 80, y: 0 },
      ],
    },
    {
      label: 'ORRORE',
      color: 'rgba(156,39,176,0.6)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 50, y: 0 },
        { x: 55, y: 18 },
        { x: 65, y: 42 },
        { x: 70, y: 60 },
        { x: 80, y: 50 },
        { x: 85, y: 0 },
      ],
    },
    {
      label: 'PANICO',
      color: 'rgba(156,39,176,0.8)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 60, y: 0 },
        { x: 65, y: 20 },
        { x: 70, y: 50 },
        { x: 75, y: 70 },
        { x: 80, y: 60 },
        { x: 85, y: 0 },
      ],
    },
    {
      label: 'TERRORE',
      color: 'rgba(156,39,176,1)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 75, y: 0 },
        { x: 80, y: 22 },
        { x: 85, y: 55 },
        { x: 90, y: 80 },
        { x: 95, y: 68 },
        { x: 100, y: 0 },
      ],
    },
  ],
  RABBIA: [
    {
      label: 'FASTIDIO',
      color: 'rgba(255,0,0,0.3)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 40, y: 0 },
      ],
    },
    {
      label: 'FRUSTRAZIONE',
      color: 'rgba(255,0,0,0.35)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 20, y: 0 },
        { x: 40, y: 35 },
        { x: 60, y: 0 },
      ],
    },
    {
      label: 'ESASPERAZIONE',
      color: 'rgba(255,0,0,0.45)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 40, y: 0 },
        { x: 60, y: 45 },
        { x: 80, y: 0 },
      ],
    },
    {
      label: 'POLEMICITÀ',
      color: 'rgba(255,0,0,0.55)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 60, y: 0 },
        { x: 80, y: 55 },
        { x: 100, y: 0 },
      ],
    },
  ],
  DISGUSTO: [
    {
      label: 'DISPIACERE',
      color: 'rgba(0,150,136,0.2)',
      curve: d3.curveBumpY,
      topPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 15 },
        { x: 20, y: 30 },
        { x: 30, y: 20 },
        { x: 40, y: 35 },
        { x: 50, y: 0 },
      ],
    },
    {
      label: 'AVVERSIONE',
      color: 'rgba(0,150,136,0.3)',
      curve: d3.curveBumpY,
      topPoints: [
        { x: 20, y: 0 },
        { x: 30, y: 20 },
        { x: 40, y: 40 },
        { x: 50, y: 50 },
        { x: 60, y: 30 },
        { x: 70, y: 0 },
      ],
    },
    {
      label: 'SGRADEVOLEZZA',
      color: 'rgba(0,150,136,0.4)',
      curve: d3.curveBumpY,
      topPoints: [
        { x: 40, y: 0 },
        { x: 50, y: 25 },
        { x: 60, y: 50 },
        { x: 70, y: 45 },
        { x: 80, y: 20 },
        { x: 90, y: 0 },
      ],
    },
    {
      label: 'RIPUGNANZA',
      color: 'rgba(0,150,136,0.5)',
      curve: d3.curveBumpY,
      topPoints: [
        { x: 55, y: 0 },
        { x: 65, y: 30 },
        { x: 75, y: 70 },
        { x: 85, y: 40 },
        { x: 95, y: 20 },
        { x: 100, y: 0 },
      ],
    },
    {
      label: 'RIBREZZO',
      color: 'rgba(0,150,136,0.6)',
      curve: d3.curveBumpY,
      topPoints: [
        { x: 60, y: 0 },
        { x: 70, y: 35 },
        { x: 80, y: 80 },
        { x: 95, y: 30 },
        { x: 100, y: 0 },
      ],
    },
  ],
  TRISTEZZA: [
    {
      label: 'DELUSIONE', // Onda più piccola e più stretta
      color: 'rgba(33,150,243,0.2)',
      curve: d3.curveBasis,
      topPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 15 },
        { x: 20, y: 25 },
        { x: 30, y: 18 },
        { x: 40, y: 0 },
      ],
    },
    {
      label: 'SCORAGGIAMENTO', // Più stretto, altezza più contenuta
      color: 'rgba(33,150,243,0.3)',
      curve: d3.curveNatural,
      topPoints: [
        { x: 8, y: 0 },
        { x: 18, y: 22 },
        { x: 28, y: 35 },
        { x: 38, y: 25 },
        { x: 48, y: 0 },
      ],
    },
    {
      label: 'TURBAMENTO', // Forma appuntita, con base più corta
      color: 'rgba(33,150,243,0.4)',
      curve: d3.curveBasis,
      topPoints: [
        { x: 16, y: 0 },
        { x: 26, y: 28 },
        { x: 36, y: 45 },
        { x: 46, y: 30 },
        { x: 56, y: 0 },
      ],
    },
    {
      label: 'RASSEGNAZIONE', // Onda più ampia ma ancora contenuta
      color: 'rgba(33,150,243,0.5)',
      curve: d3.curveNatural,
      topPoints: [
        { x: 30, y: 0 },
        { x: 34, y: 32 },
        { x: 44, y: 50 },
        { x: 54, y: 35 },
        { x: 64, y: 0 },
      ],
    },
    {
      label: 'DISPERAZIONE', // Onda con massimo più evidente
      color: 'rgba(33,150,243,0.7)',
      curve: d3.curveNatural,
      topPoints: [
        { x: 40, y: 0 },
        { x: 48, y: 52 },
        { x: 54, y: 70 },
        { x: 60, y: 60 },
        { x: 70, y: 0 },
      ],
    },
    {
      label: 'ANGOSCIA', // Più ripida e ristretta
      color: 'rgba(33,150,243,0.8)',
      curve: d3.curveBasis,
      topPoints: [
        { x: 54, y: 0 },
        { x: 60, y: 58 },
        { x: 64, y: 65 },
        { x: 74, y: 80 },
        { x: 80, y: 0 },
      ],
    },
    {
      label: 'DOLORE', // Onda più appuntita con base più corta
      color: 'rgba(33,150,243,0.9)',
      curve: d3.curveNatural,
      topPoints: [
        { x: 70, y: 0 },
        { x: 75, y: 55 },
        { x: 80, y: 80 },
        { x: 90, y: 55 },
        { x: 100, y: 0 },
      ],
    },
  ],
  FELICITÀ: [
    {
      label: 'RALLEGRAMENTO',
      color: 'rgba(255,193,7,0.3)',
      curve: d3.curveCatmullRom,
      topPoints: [
        { x: 0, y: 0 },
        { x: 18, y: 38 },
        { x: 28, y: 18 },
        { x: 38, y: 0 },
      ],
    },
    {
      label: 'GIOIA',
      color: 'rgba(255,193,7,0.4)',
      curve: d3.curveMonotoneX,
      topPoints: [
        { x: 16, y: 0 },
        { x: 26, y: 55 },
        { x: 36, y: 22 },
        { x: 46, y: 0 },
      ],
    },
    {
      label: 'DIVERTIMENTO',
      color: 'rgba(255,193,7,0.45)',
      curve: d3.curveBasis,
      topPoints: [
        { x: 24, y: 0 },
        { x: 34, y: 58 },
        { x: 44, y: 30 },
        { x: 54, y: 0 },
      ],
    },
    {
      label: 'PACE',
      color: 'rgba(255,193,7,0.55)',
      curve: d3.curveBasis,
      topPoints: [
        { x: 36, y: 0 },
        { x: 48, y: 75 },
        { x: 60, y: 38 },
        { x: 72, y: 0 },
      ],
    },
    {
      label: 'SOLLIEVO',
      color: 'rgba(255,193,7,0.6)',
      curve: d3.curveCatmullRom,
      topPoints: [
        { x: 42, y: 0 },
        { x: 54, y: 85 },
        { x: 66, y: 42 },
        { x: 78, y: 0 },
      ],
    },
    {
      label: 'FIEREZZA',
      color: 'rgba(255,193,7,0.65)',
      curve: d3.curveMonotoneX,
      topPoints: [
        { x: 48, y: 0 },
        { x: 60, y: 92 },
        { x: 72, y: 50 },
        { x: 84, y: 0 },
      ],
    },
    {
      label: 'ORGOLIO',
      color: 'rgba(255,193,7,0.75)',
      curve: d3.curveLinear,
      topPoints: [
        { x: 54, y: 0 },
        { x: 66, y: 98 },
        { x: 78, y: 55 },
        { x: 90, y: 0 },
      ],
    },
    {
      label: 'ECCITAZIONE',
      color: 'rgba(255,193,7,0.9)',
      curve: d3.curveMonotoneX,
      topPoints: [
        { x: 68, y: 0 },
        { x: 80, y: 95 },
        { x: 92, y: 75 },
        { x: 100, y: 0 },
      ],
    },
  ],
};

// Mappa colori per ogni emozione
const EMOTION_COLORS: { [key: string]: string } = {
  PAURA: 'rgba(175, 50, 200, 0.6)',
  RABBIA: 'rgba(255, 0, 0, 0.5)',
  DISGUSTO: 'rgba(0, 150, 136, 0.5)',
  TRISTEZZA: 'rgba(33, 150, 243, 0.5)',
  FELICITÀ: 'rgba(255, 193, 7, 0.5)',
};

const EMOTION_HIGHLIGHT_COLORS: { [key: string]: string } = {
  PAURA: 'rgba(175, 50, 200, 1)',
  RABBIA: 'rgba(255, 0, 0, 1)',
  DISGUSTO: 'rgba(0, 150, 136, 1)',
  TRISTEZZA: 'rgba(33, 150, 243, 1)',
  FELICITÀ: 'rgba(255, 193, 7, 1)',
};

@Component({
  selector: 'app-emotion-graph',
  template: `
    <!-- Grafico principale scrollabile -->
    <div #mainContainer class="graph-container"></div>

    <!-- Miniatura sempre presente (rimuoviamo *ngIf="isMobile") -->
    <div #overviewContainer class="overview-container"></div>
  `,
  styleUrls: ['./emotion-graph.component.css'],
  standalone: true,
  imports: [NgIf],
})
export class EmotionGraphComponent implements AfterViewInit, OnChanges {
  @ViewChild('mainContainer', { static: true })
  mainContainer!: ElementRef<HTMLElement>;

  @ViewChild('overviewContainer', { static: true })
  overviewContainer!: ElementRef<HTMLElement>;

  @Input() emotion: string = '';
  @Output() onEmotionClick = new EventEmitter<{
    name: string;
    level: string;
  }>();

  // SVG "principale" e "overview"
  private mainSvg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private overviewSvg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;

  // Dimensioni del grafico principale
  private mainWidth = 1200;
  private mainHeight = 400;

  // Dimensioni della miniatura
  private overviewWidth = 300;
  private overviewHeight = 80;

  // Scale
  private xScaleMain!: d3.ScaleLinear<number, number>;
  private yScaleMain!: d3.ScaleLinear<number, number>;
  private xScaleOverview!: d3.ScaleLinear<number, number>;
  private yScaleOverview!: d3.ScaleLinear<number, number>;

  async ngAfterViewInit(): Promise<void> {
    // Per test, forziamo isMobile a true (oppure puoi eliminarlo se non serve)
    // this.isMobile = Capacitor.isNativePlatform?.() || false;
    // In questo esempio, non usiamo più isMobile per mostrare/nascondere la miniatura.

    // Se non viene passato un @Input, carica l'emozione dalle Preferences
    if (!this.emotion) {
      const pref = await Preferences.get({ key: 'selectedEmotion' });
      this.emotion = pref.value ? pref.value.trim().toUpperCase() : 'PAURA';
    }

    this.createMainGraph();
    this.createOverviewGraph(); // Crea sempre la miniatura
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['emotion'] && !changes['emotion'].firstChange) {
      const pref = await Preferences.get({ key: 'selectedEmotion' });
      this.emotion = pref.value
        ? pref.value.trim().toUpperCase()
        : this.emotion;

      this.createMainGraph();
      this.createOverviewGraph();
    }
  }

  private createMainGraph(): void {
    if (!this.mainContainer?.nativeElement) return;

    d3.select(this.mainContainer.nativeElement).selectAll('*').remove();

    this.mainSvg = d3
      .select<HTMLElement, unknown>(this.mainContainer.nativeElement)
      .append<SVGSVGElement>('svg')
      .attr('width', this.mainWidth)
      .attr('height', this.mainHeight);

    this.xScaleMain = d3
      .scaleLinear()
      .domain([0, 100])
      .range([50, this.mainWidth - 50]);

    this.yScaleMain = d3
      .scaleLinear()
      .domain([0, 100])
      .range([this.mainHeight - 50, 50]);

    this.drawAxes(
      this.mainSvg,
      this.xScaleMain,
      this.yScaleMain,
      this.mainWidth,
      this.mainHeight,
      true
    );

    const levels = EMOTION_CONFIGURATIONS[this.emotion] || [];
    levels.forEach(level => {
      this.drawLevel(
        this.mainSvg,
        level,
        this.xScaleMain,
        this.yScaleMain,
        true
      );
    });
  }

  private createOverviewGraph(): void {
    if (!this.overviewContainer?.nativeElement) return;

    d3.select(this.overviewContainer.nativeElement).selectAll('*').remove();

    this.overviewSvg = d3
      .select<HTMLElement, unknown>(this.overviewContainer.nativeElement)
      .append<SVGSVGElement>('svg')
      .attr('width', this.overviewWidth)
      .attr('height', this.overviewHeight)
      .style('background', '#f9f9f9');

    this.xScaleOverview = d3
      .scaleLinear()
      .domain([0, 100])
      .range([0, this.overviewWidth]);

    this.yScaleOverview = d3
      .scaleLinear()
      .domain([0, 100])
      .range([this.overviewHeight, 0]);

    const levels = EMOTION_CONFIGURATIONS[this.emotion] || [];
    levels.forEach(level => {
      this.drawLevel(
        this.overviewSvg,
        level,
        this.xScaleOverview,
        this.yScaleOverview,
        false
      );
    });
  }

  private drawAxes(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    height: number,
    showLabels: boolean
  ): void {
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickSize(10)
      .tickPadding(10)
      .tickFormat(() => '');
    svg
      .append('g')
      .attr('transform', `translate(0, ${height - 40})`)
      .call(xAxis);

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickSize(0)
      .tickPadding(10)
      .tickFormat(() => '');
    svg.append('g').attr('transform', `translate(50, 0)`).call(yAxis);

    if (showLabels) {
      svg
        .append('text')
        .attr('x', 50)
        .attr('y', height - 10)
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text('Meno intenso');

      svg
        .append('text')
        .attr('x', width - 50)
        .attr('y', height - 10)
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .attr('text-anchor', 'end')
        .text('Più intenso');

      svg
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', 20)
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .attr('text-anchor', 'middle')
        .text("Profondità dell'emozione");
    }
  }

  private drawLevel(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    level: any,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    showTooltip: boolean
  ): void {
    const dataPoints = level.topPoints.map((pt: { x: number; y: number }) => ({
      x: xScale(pt.x),
      y: yScale(pt.y),
    }));

    const areaGenerator = d3
      .area<{ x: number; y: number }>()
      .x(d => d.x)
      .y0(yScale(0))
      .y1(d => d.y)
      .curve(level.curve);

    const baseFill = EMOTION_COLORS[this.emotion] || 'rgba(0,0,255,0.5)';
    const highlightFill =
      EMOTION_HIGHLIGHT_COLORS[this.emotion] || 'rgba(0,0,255,1)';

    const path = svg
      .append<SVGPathElement>('path')
      .datum(dataPoints)
      .attr('fill', baseFill)
      .attr('d', areaGenerator(dataPoints) ?? '');

    if (!showTooltip) {
      path.on('click', () => {
        this.onEmotionClick.emit({ name: this.emotion, level: level.label });
      });
      return;
    }

    const maxPoint = dataPoints.reduce(
      (prev: { x: number; y: number }, curr: { x: number; y: number }) =>
        curr.y < prev.y ? curr : prev
    );


    const textElement = svg
      .append<SVGTextElement>('text')
      .attr('x', maxPoint.x)
      .attr('y', maxPoint.y - 5)
      .style('font-size', '12px')
      .style('opacity', 0)
      .attr('text-anchor', 'middle')
      .text(level.label);

    const container = d3.select(this.mainContainer.nativeElement);
    const tooltip = container
      .append('div')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.75)')
      .style('color', '#fff')
      .style('padding', '6px 10px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', '0')
      .style('transition', 'opacity 0.3s ease-in-out, transform 0.2s ease-out');

    path
      .attr('cursor', 'pointer')
      .on('mouseover', () => {
        path.raise().attr('fill', highlightFill);
        textElement.transition().duration(200).style('opacity', 1);
      })
      .on('mouseout', () => {
        path.attr('fill', baseFill);
        textElement.transition().duration(200).style('opacity', 0);
      })
      .on('click', (event: MouseEvent) => {
        const [x, y] = d3.pointer(event, svg.node() as SVGSVGElement);
        tooltip
          .html(`<strong>${level.label}</strong>`)
          .style('left', `${x + 15}px`)
          .style('top', `${y - 25}px`)
          .style('opacity', '1')
          .style('transform', 'translateY(-5px)');

        setTimeout(() => tooltip.style('opacity', '0'), 2000);

        this.onEmotionClick.emit({ name: this.emotion, level: level.label });
      });
  }
}
