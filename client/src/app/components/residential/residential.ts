import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';

import {
  ResidentialService,
  ResidentialBuilding,
} from '../../services/residential';

@Component({
  selector: 'app-residential',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatExpansionModule,
    MatListModule,
  ],
  templateUrl: './residential.html',
  styleUrl: './residential.scss',
})
export class Residential implements OnInit {
  private residentialService = inject(ResidentialService);
  private cdr = inject(ChangeDetectorRef);

  buildings: ResidentialBuilding[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    this.loadStructure();
  }

  loadStructure(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges

    this.residentialService.getStructure().subscribe({
      next: (buildings) => {
        this.buildings = buildings;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load residential structure', err);
        this.error = 'Failed to load residential structure.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }
}
