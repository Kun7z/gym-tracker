import { Component, output, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-sheet',
  templateUrl: './sheet.html',
  styleUrl: './sheet.scss',
})
export class Sheet implements OnInit, OnDestroy {
  close = output<void>();

  private readonly prevOverflow = '';

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.prevOverflow;
  }

  onBackdrop(): void {
    this.close.emit();
  }
}
