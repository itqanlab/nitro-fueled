export type SidebarItemType = 'project' | 'library' | 'management' | 'provider' | 'settings';

export interface SidebarSection {
  readonly title: string;
  readonly type: SidebarItemType;
  readonly items: readonly SidebarItem[];
  readonly showAddButton?: boolean;
}

export interface SidebarItem {
  readonly label: string;
  readonly icon?: string;
  readonly route?: string;
  readonly badge?: number;
  readonly dotStatus?: 'active' | 'inactive' | 'has-updates';
  readonly isActive?: boolean;
}
