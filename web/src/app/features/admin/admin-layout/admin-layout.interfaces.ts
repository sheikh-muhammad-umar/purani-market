export interface NavItem {
  label: string;
  icon: string;
  path: string;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
