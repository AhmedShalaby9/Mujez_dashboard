import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compactNumber,
  compactMoney,
  compactAmountInput,
  parseCompactAmount,
  compactMoneyText,
} from './compact-numbers';
import { CompactAmountDirective } from './compact-amount.directive';
import { toMinor } from './billing-api.service';
@Component({
  imports: [FormsModule, CompactAmountDirective],
  template: `<input compactAmount [(ngModel)]="amount" /><input
      compactAmount
      [value]="other()"
      (input)="other.set($any($event.target).value)"
    />`,
})
class FormFixture {
  amount = '';
  other = signal('');
}
describe('Compact amounts', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('uses lowercase suffixes consistently, retaining exact monetary cents', () => {
    expect(compactMoney('1000000000')).toBe('EGP 10m');
    expect(compactMoney('25000000')).toBe('EGP 250k');
    expect(compactMoney('150000000000')).toBe('EGP 1.5b');
    expect(compactMoney('893700000')).toBe('EGP 8.937m');
    expect(compactMoney('-123456789')).toBe('EGP -1.23456789m');
    expect(compactMoney('50')).toBe('EGP 0.5');
    expect(compactMoney(null)).toBe('—');
    expect(compactNumber(12500)).toBe('12.5k');
    expect(compactNumber(999999)).toBe('1m');
  });
  it('parses case-insensitive shorthand, grouped and Arabic digits exactly', () => {
    for (const [input, minor] of [
      ['10m', '1000000000'],
      ['1.5 M', '150000000'],
      ['250K', '25000000'],
      ['1b', '100000000000'],
      ['1,250.50', '125050'],
      ['١٠٫٥m', '1050000000'],
      ['۱٬۲۵۰٫۵۰', '125050'],
      ['1.00000001m', '100000001'],
    ])
      expect(parseCompactAmount(input)).toBe(minor);
    expect(toMinor('10m')).toBe('1000000000');
  });
  it('round trips edit amounts beyond the safe integer range without rounding', () => {
    for (const minor of [
      '0',
      '1',
      '105',
      '125050',
      '893700000',
      '1000000001',
      '900719925474099399',
      '999999999999999999',
    ])
      expect(parseCompactAmount(compactAmountInput(minor))).toBe(minor);
  });
  it('rejects malformed, negative, fractional-cent and out-of-range values and preserves billing limits', () => {
    for (const v of [
      '',
      '1,23',
      '-1m',
      '1e6',
      '0.001',
      '1.000000001m',
      '2mm',
      '10m garbage',
      '10000000000000000',
    ])
      expect(() => parseCompactAmount(v)).toThrow();
    expect(() => toMinor('0')).toThrow();
    expect(() => toMinor('11b')).toThrow();
    expect(compactMoneyText('Above budget by EGP 500,000.00 (5.00%).')).toBe(
      'Above budget by EGP 500k (5.00%).',
    );
  });
  it('formats two-way model and signal inputs on blur without losing cents or clearing invalid input', async () => {
    await TestBed.configureTestingModule({ imports: [FormFixture] }).compileComponents();
    const f = TestBed.createComponent(FormFixture);
    f.detectChanges();
    await f.whenStable();
    const inputs = f.nativeElement.querySelectorAll('input');
    inputs[0].value = '10000000.25';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[0].dispatchEvent(new Event('blur'));
    await f.whenStable();
    expect(f.componentInstance.amount).toBe('10.00000025m');
    inputs[1].value = '250000';
    inputs[1].dispatchEvent(new Event('input'));
    inputs[1].dispatchEvent(new Event('blur'));
    expect(f.componentInstance.other()).toBe('250k');
    inputs[1].value = 'invalid';
    inputs[1].dispatchEvent(new Event('input'));
    inputs[1].dispatchEvent(new Event('blur'));
    expect(f.componentInstance.other()).toBe('invalid');
  });
});
