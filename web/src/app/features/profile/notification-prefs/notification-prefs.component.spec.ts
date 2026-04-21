import { NotificationPreferences } from '../../../core/models/user.model';

describe('NotificationPrefsComponent logic', () => {
  const defaultPrefs: NotificationPreferences = {
    messages: true,
    offers: true,
    productUpdates: true,
    promotions: true,
    packageAlerts: true,
  };

  function isEnabled(
    prefs: NotificationPreferences | undefined,
    key: keyof NotificationPreferences,
  ): boolean {
    if (!prefs) return true;
    return prefs[key] ?? true;
  }

  function togglePref(
    prefs: NotificationPreferences,
    key: keyof NotificationPreferences,
  ): NotificationPreferences {
    return { ...prefs, [key]: !prefs[key] };
  }

  it('should default all preferences to true', () => {
    expect(isEnabled(defaultPrefs, 'messages')).toBe(true);
    expect(isEnabled(defaultPrefs, 'offers')).toBe(true);
    expect(isEnabled(defaultPrefs, 'productUpdates')).toBe(true);
    expect(isEnabled(defaultPrefs, 'promotions')).toBe(true);
    expect(isEnabled(defaultPrefs, 'packageAlerts')).toBe(true);
  });

  it('should default to true when preferences are undefined', () => {
    expect(isEnabled(undefined, 'messages')).toBe(true);
    expect(isEnabled(undefined, 'offers')).toBe(true);
  });

  it('should toggle messages off', () => {
    const updated = togglePref(defaultPrefs, 'messages');
    expect(updated.messages).toBe(false);
    expect(updated.offers).toBe(true);
  });

  it('should toggle offers off', () => {
    const updated = togglePref(defaultPrefs, 'offers');
    expect(updated.offers).toBe(false);
    expect(updated.messages).toBe(true);
  });

  it('should toggle productUpdates off', () => {
    const updated = togglePref(defaultPrefs, 'productUpdates');
    expect(updated.productUpdates).toBe(false);
  });

  it('should toggle promotions off', () => {
    const updated = togglePref(defaultPrefs, 'promotions');
    expect(updated.promotions).toBe(false);
  });

  it('should toggle packageAlerts off', () => {
    const updated = togglePref(defaultPrefs, 'packageAlerts');
    expect(updated.packageAlerts).toBe(false);
  });

  it('should toggle back on after toggling off', () => {
    const off = togglePref(defaultPrefs, 'messages');
    expect(off.messages).toBe(false);
    const on = togglePref(off, 'messages');
    expect(on.messages).toBe(true);
  });

  it('should not affect other preferences when toggling one', () => {
    const updated = togglePref(defaultPrefs, 'promotions');
    expect(updated.messages).toBe(true);
    expect(updated.offers).toBe(true);
    expect(updated.productUpdates).toBe(true);
    expect(updated.packageAlerts).toBe(true);
    expect(updated.promotions).toBe(false);
  });
});
