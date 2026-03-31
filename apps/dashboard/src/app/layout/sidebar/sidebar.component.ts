import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MOCK_SIDEBAR_SECTIONS } from '../../services/mock-data.constants';
import { SidebarSection, SidebarItem } from '../../models/sidebar.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgClass, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  public readonly sections: readonly SidebarSection[] = MOCK_SIDEBAR_SECTIONS;

  public trackByLabel(_index: number, item: SidebarItem): string {
    return item.label;
  }

  public trackByTitle(_index: number, section: SidebarSection): string {
    return section.title;
  }
}
