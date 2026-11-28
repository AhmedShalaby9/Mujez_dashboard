import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
/** Reusable "+20" boxed phone input: stores/emits the full "+20xxxxxxxxxx"
 * value via ControlValueAccessor, so callers just bind [(ngModel)] to the
 * full phone string, same as any other field. */
@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <span class="phone20" dir="ltr">
      <span aria-hidden="true">+20</span
      ><input
        type="tel"
        inputmode="numeric"
        autocomplete="tel-national"
        [ngModel]="local"
        (ngModelChange)="onLocalChange($event)"
        (blur)="onTouched()"
        [placeholder]="placeholder"
        [attr.aria-label]="ariaLabel || null"
        [disabled]="disabled"
        maxlength="10"
    /></span>
  `,
  styles: `
    :host {
      display: block;
    }
    .phone20 {
      display: flex;
      align-items: center;
      border: 1px solid var(--border-input);
      border-radius: var(--r-control);
      background: var(--surface);
      overflow: hidden;
    }
    .phone20:focus-within {
      outline: 2px solid var(--ink);
      outline-offset: 1px;
    }
    .phone20 > span {
      padding: 0 10px;
      font-weight: 600;
      color: var(--ink-muted);
      border-inline-end: 1px solid var(--border-card-alt);
    }
    .phone20 input {
      border: 0;
      border-radius: 0;
      min-width: 0;
      flex: 1;
      direction: ltr;
      text-align: left;
      min-height: 36px;
      padding: 0 10px;
      font: inherit;
    }
  `,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneInput), multi: true },
  ],
})
export class PhoneInput implements ControlValueAccessor {
  @Input() placeholder = 'xxx xxx xxxx';
  @Input() ariaLabel = '';
  local = '';
  disabled = false;
  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};
  writeValue(value: string | null): void {
    this.local = String(value ?? '').replace(/^\+20/, '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
  onLocalChange(value: string) {
    this.local = value;
    this.onChange(value ? '+20' + value : '');
  }
}
