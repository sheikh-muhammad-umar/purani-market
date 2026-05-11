export interface NavItem {
  label: string;
  icon: string;
  path: string;
  children?: NavItem[];
}
