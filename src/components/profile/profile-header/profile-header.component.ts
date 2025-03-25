import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-profile-header',
  imports: [NgIf],
  templateUrl: './profile-header.component.html',
  styleUrl: './profile-header.component.css',
  standalone: true,
})
export class ProfileHeaderComponent {
  @Input() user: any;
}
