import { Directive, HostListener, inject, ElementRef } from '@angular/core';
import { NgControl } from '@angular/forms';
import { compactAmountInput, parseCompactAmount } from './compact-numbers';
@Directive({ selector: 'input[compactAmount]', host: { inputmode: 'text' } })
export class CompactAmountDirective {
  private readonly control = inject(NgControl, { self: true, optional: true });
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  @HostListener('blur') compact() {
    const value = this.control?.value ?? this.element.nativeElement.value;
    if (value === null || value === undefined || String(value).trim() === '') return;
    try {
      const formatted = compactAmountInput(parseCompactAmount(String(value)));
      if (this.control?.control) this.control.control.setValue(formatted);
      else {
        this.element.nativeElement.value = formatted;
        this.element.nativeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch {
      /* Leave invalid input intact so the form can explain the validation error. */
    }
  }
}
