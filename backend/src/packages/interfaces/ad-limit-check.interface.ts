export interface AdLimitCheck {
  canPost: boolean;
  activeAdCount: number;
  adLimit: number;
  message?: string;
}
