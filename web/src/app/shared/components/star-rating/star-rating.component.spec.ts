import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { StarRatingComponent } from './star-rating.component';

describe('StarRatingComponent', () => {
  let component: StarRatingComponent;
  let ref: ComponentRef<StarRatingComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StarRatingComponent] });
    const fixture = TestBed.createComponent(StarRatingComponent);
    component = fixture.componentInstance;
    ref = fixture.componentRef;
  });

  it('fully fills whole stars and empties the rest', () => {
    ref.setInput('rating', 3);
    expect(component.fills()).toEqual([100, 100, 100, 0, 0]);
  });

  it('renders a partial star for a fractional rating', () => {
    ref.setInput('rating', 4.5);
    expect(component.fills()).toEqual([100, 100, 100, 100, 50]);
  });

  it('clamps ratings outside 0–5', () => {
    ref.setInput('rating', 7);
    expect(component.fills()).toEqual([100, 100, 100, 100, 100]);
    ref.setInput('rating', -2);
    expect(component.fills()).toEqual([0, 0, 0, 0, 0]);
  });

  it('describes the rating and count for assistive tech', () => {
    ref.setInput('rating', 4.2);
    ref.setInput('count', 8);
    expect(component.ariaLabel()).toContain('4.2');
    expect(component.ariaLabel()).toContain('8');
  });

  it('reports no reviews when count is zero', () => {
    ref.setInput('rating', 0);
    ref.setInput('count', 0);
    expect(component.ariaLabel()).toBe('No reviews yet');
  });
});
