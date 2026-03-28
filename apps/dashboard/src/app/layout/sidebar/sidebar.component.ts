import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MockDataService } from '../../services/mock-data.service';
import { SidebarSection, SidebarItem } from '../../models/sidebar.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgClass, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly mockData = inject(MockDataService);
  public readonly sections: readonly SidebarSection[] = this.mockData.getSidebarSections();

  public trackByLabel(_index: number, item: SidebarItem): string {
    return item.label;
  }

  public trackByTitle(_index: number, section: SidebarSection): string {
    return section.title;
  }
}
