import { Component, input } from '@angular/core';

export interface Scene {
  gid: string;
  s1: string;
  s2: string;
  sun: string;
  far: string;
  near: string;
  sea: string;
  accent: string;
  grd: string;
  urb: number;
  cst: number;
  com: number;
  sx: number;
  tf: string;
}

/** Decorative illustrated placeholder used instead of project photos. */
@Component({
  selector: 'app-inv-scene',
  host: { style: 'display:contents' },
  styles: ['.scene{position:absolute;inset:0;width:100%;height:100%;display:block}'],
  template: `
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" class="scene">
      <defs>
        <linearGradient [attr.id]="sc().gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" [attr.stop-color]="sc().s1" />
          <stop offset="1" [attr.stop-color]="sc().s2" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" [attr.fill]="'url(#' + sc().gid + ')'" />
      <circle [attr.cx]="sc().sx" cy="66" r="24" [attr.fill]="sc().sun" />
      <path
        d="M0 172 Q70 118 150 150 T300 136 T400 146 V240 H0z"
        [attr.fill]="sc().far"
        opacity="0.85"
      />
      <rect y="166" width="400" height="40" [attr.fill]="sc().sea" [attr.opacity]="sc().cst" />
      <rect y="196" width="400" height="44" [attr.fill]="sc().grd" />
      <g [attr.transform]="sc().tf">
        <g
          [attr.opacity]="sc().urb"
          [attr.fill]="sc().near"
          stroke="rgba(17,17,19,0.12)"
          stroke-width="1"
        >
          <rect x="60" y="150" width="70" height="50" rx="3" />
          <path d="M54 152 L95 128 L136 152Z" />
          <rect x="150" y="128" width="90" height="72" rx="3" />
          <rect x="258" y="156" width="64" height="44" rx="3" />
          <path d="M252 158 L290 136 L328 158Z" />
          <g [attr.fill]="sc().sea" stroke="none" opacity="0.55">
            <rect x="72" y="166" width="14" height="14" rx="2" />
            <rect x="104" y="166" width="14" height="14" rx="2" />
            <rect x="162" y="142" width="16" height="14" rx="2" />
            <rect x="188" y="142" width="16" height="14" rx="2" />
            <rect x="214" y="142" width="16" height="14" rx="2" />
            <rect x="162" y="168" width="16" height="14" rx="2" />
            <rect x="214" y="168" width="16" height="14" rx="2" />
            <rect x="272" y="170" width="14" height="14" rx="2" />
            <rect x="296" y="170" width="14" height="14" rx="2" />
          </g>
          <rect x="188" y="172" width="16" height="28" [attr.fill]="sc().accent" stroke="none" />
        </g>
        <g
          [attr.opacity]="sc().com"
          [attr.fill]="sc().near"
          stroke="rgba(17,17,19,0.14)"
          stroke-width="1"
        >
          <rect x="70" y="96" width="56" height="104" rx="3" />
          <rect x="140" y="56" width="66" height="144" rx="3" />
          <rect x="220" y="84" width="58" height="116" rx="3" />
          <rect x="292" y="124" width="48" height="76" rx="3" />
          <g [attr.fill]="sc().s1" stroke="none" opacity="0.55">
            <rect x="150" y="68" width="46" height="5" />
            <rect x="150" y="84" width="46" height="5" />
            <rect x="150" y="100" width="46" height="5" />
            <rect x="150" y="116" width="46" height="5" />
            <rect x="150" y="132" width="46" height="5" />
            <rect x="150" y="148" width="46" height="5" />
            <rect x="80" y="108" width="36" height="5" />
            <rect x="80" y="124" width="36" height="5" />
            <rect x="80" y="140" width="36" height="5" />
            <rect x="230" y="96" width="38" height="5" />
            <rect x="230" y="112" width="38" height="5" />
            <rect x="230" y="128" width="38" height="5" />
            <rect x="230" y="144" width="38" height="5" />
          </g>
          <rect x="140" y="48" width="66" height="8" [attr.fill]="sc().accent" stroke="none" />
        </g>
        <g [attr.opacity]="sc().cst">
          <g [attr.fill]="sc().near" stroke="rgba(17,17,19,0.12)" stroke-width="1">
            <rect x="90" y="158" width="62" height="38" rx="4" />
            <rect x="168" y="146" width="82" height="50" rx="4" />
            <rect x="266" y="160" width="56" height="36" rx="4" />
          </g>
          <g [attr.fill]="sc().sea" opacity="0.6">
            <rect x="102" y="168" width="38" height="10" rx="2" />
            <rect x="180" y="158" width="58" height="12" rx="2" />
            <rect x="278" y="170" width="32" height="10" rx="2" />
          </g>
          <rect x="168" y="140" width="82" height="6" [attr.fill]="sc().accent" />
          <path d="M58 196 V150" stroke="#6B5A3A" stroke-width="3" />
          <path
            d="M58 150 q-18 -4 -26 8 M58 150 q18 -4 26 8 M58 150 q-8 -14 -22 -14 M58 150 q8 -14 22 -14"
            stroke="#5E8C3A"
            stroke-width="4"
            fill="none"
            stroke-linecap="round"
          />
        </g>
      </g>
    </svg>
  `,
})
export class InvScene {
  readonly sc = input.required<Scene>();
}
