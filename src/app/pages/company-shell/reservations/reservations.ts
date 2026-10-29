import { Component, computed, inject, signal } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

type ResStatus = 'hold' | 'reserved' | 'converted' | 'expired' | 'canceled';

interface Reservation {
  id: string;
  unit: string;
  contact: string;
  contactAr: string;
  agent: string;
  agentAr: string;
  status: ResStatus;
  expiresIn: string;
  deposit: string | null;
}

const SEED: Reservation[] = [
  { id: 'RV-901', unit: 'HB-P2-B1-3A', contact: 'Rana Farouk', contactAr: 'رنا فاروق', agent: 'Dina El Sayed', agentAr: 'دينا السيد', status: 'converted', expiresIn: '—', deposit: 'EGP 500,000' },
  { id: 'RV-918', unit: 'HB-P1-A-4C', contact: 'Ahmed Samir', contactAr: 'أحمد سمير', agent: 'Youssef Mansour', agentAr: 'يوسف منصور', status: 'hold', expiresIn: '38 min', deposit: null },
  { id: 'RV-922', unit: 'MH-P3-401', contact: 'Laila Ibrahim', contactAr: 'ليلى إبراهيم', agent: 'Youssef Mansour', agentAr: 'يوسف منصور', status: 'reserved', expiresIn: '2 days', deposit: 'EGP 90,000' },
  { id: 'RV-925', unit: 'HB-P2-B1-1A', contact: 'Mostafa Saeed', contactAr: 'مصطفى سعيد', agent: 'Khaled Nabil', agentAr: 'خالد نبيل', status: 'hold', expiresIn: '6 hours', deposit: null },
  { id: 'RV-930', unit: 'RN-3301', contact: 'Yara Hossam', contactAr: 'يارا هشام', agent: 'Rana Farouk', agentAr: 'رنا فاروق', status: 'hold', expiresIn: '1 hour', deposit: null },
  { id: 'RV-888', unit: 'HB-P1-A-6B', contact: 'Hany Fathy', contactAr: 'هاني فتحي', agent: 'Rana Farouk', agentAr: 'رنا فاروق', status: 'expired', expiresIn: 'expired', deposit: null },
  { id: 'RV-879', unit: 'MH-P2-C-2D', contact: 'Tarek Hamdy', contactAr: 'طارق حمدي', agent: 'Dina El Sayed', agentAr: 'دينا السيد', status: 'canceled', expiresIn: '—', deposit: null },
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  statusAll: string;
  statusNames: Record<ResStatus, string>;
  thUnit: string;
  thContact: string;
  thAgent: string;
  thExpiry: string;
  thStatus: string;
  thActions: string;
  confirmBtn: string;
  extendBtn: string;
  cancelBtn: string;
  confirmTitle: string;
  depositLabel: string;
  extendTitle: string;
  durations: string[];
  reasonLabel: string;
  reasonPh: string;
  cancelTitle: string;
  cancelReasonPh: string;
  cancel: string;
  apply: string;
  emptyTitle: string;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Inventory',
    title: 'Reservations',
    sub: 'Active holds and reservations with expiry; extend, convert or release units.',
    statusAll: 'All',
    statusNames: { hold: 'Hold', reserved: 'Reserved', converted: 'Converted', expired: 'Expired', canceled: 'Canceled' },
    thUnit: 'Unit',
    thContact: 'Contact',
    thAgent: 'Agent',
    thExpiry: 'Expires in',
    thStatus: 'Status',
    thActions: 'Actions',
    confirmBtn: 'Confirm',
    extendBtn: 'Extend',
    cancelBtn: 'Cancel',
    confirmTitle: 'Confirm reservation',
    depositLabel: 'Deposit amount (EGP)',
    extendTitle: 'Extend hold (audited)',
    durations: ['24h', '48h', '72h'],
    reasonLabel: 'Reason',
    reasonPh: 'e.g. client traveling, awaiting bank approval',
    cancelTitle: 'Cancel reservation',
    cancelReasonPh: 'e.g. client withdrew, unit sold elsewhere',
    cancel: 'Dismiss',
    apply: 'Apply',
    emptyTitle: 'No reservations match this filter.',
  },
  ar: {
    eyebrow: 'المخزون',
    title: 'الحجوزات',
    sub: 'الحجوزات النشطة ومواعيد انتهائها؛ تمديد أو تحويل أو تحرير الوحدات.',
    statusAll: 'الكل',
    statusNames: { hold: 'معلّق', reserved: 'محجوز', converted: 'مكتمل', expired: 'منتهي', canceled: 'ملغى' },
    thUnit: 'الوحدة',
    thContact: 'العميل',
    thAgent: 'الوكيل',
    thExpiry: 'ينتهي بعد',
    thStatus: 'الحالة',
    thActions: 'إجراءات',
    confirmBtn: 'تأكيد',
    extendBtn: 'تمديد',
    cancelBtn: 'إلغاء',
    confirmTitle: 'تأكيد الحجز',
    depositLabel: 'مبلغ العربون (جنيه)',
    extendTitle: 'تمديد التعليق (مُدقّق)',
    durations: ['24 س', '48 س', '72 س'],
    reasonLabel: 'السبب',
    reasonPh: 'مثال: العميل مسافر، في انتظار موافقة البنك',
    cancelTitle: 'إلغاء الحجز',
    cancelReasonPh: 'مثال: انسحب العميل، بيعت الوحدة لجهة أخرى',
    cancel: 'إغلاق',
    apply: 'تطبيق',
    emptyTitle: 'لا توجد حجوزات مطابقة.',
  },
};

@Component({
  selector: 'app-reservations',
  templateUrl: './reservations.html',
  styleUrl: './reservations.scss',
})
export class Reservations {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly reservations = signal<Reservation[]>(SEED);
  readonly statusFilter = signal<ResStatus | 'all'>('all');
  readonly statuses: ResStatus[] = ['hold', 'reserved', 'converted', 'expired', 'canceled'];

  readonly filtered = computed(() =>
    this.reservations().filter((r) => this.statusFilter() === 'all' || r.status === this.statusFilter()),
  );

  contact(r: Reservation): string {
    return this.ar() ? r.contactAr : r.contact;
  }
  agent(r: Reservation): string {
    return this.ar() ? r.agentAr : r.agent;
  }

  readonly confirmTarget = signal<Reservation | null>(null);
  readonly depositInput = signal('');
  readonly extendTarget = signal<Reservation | null>(null);
  readonly extendDuration = signal('48h');
  readonly extendReason = signal('');
  readonly cancelTarget = signal<Reservation | null>(null);
  readonly cancelReason = signal('');
  readonly toast = signal<string | null>(null);

  private showToast(msg: string): void {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(null), 2800);
  }

  openConfirm(r: Reservation): void {
    this.confirmTarget.set(r);
    this.depositInput.set('');
  }
  applyConfirm(): void {
    const r = this.confirmTarget();
    if (!r || !this.depositInput().trim()) return;
    this.reservations.update((list) =>
      list.map((x) => (x.id === r.id ? { ...x, status: 'reserved', deposit: 'EGP ' + this.depositInput(), expiresIn: '2 days' } : x)),
    );
    this.confirmTarget.set(null);
    this.showToast('Reservation confirmed.');
  }

  openExtend(r: Reservation): void {
    this.extendTarget.set(r);
    this.extendDuration.set('48h');
    this.extendReason.set('');
  }
  applyExtend(): void {
    const r = this.extendTarget();
    if (!r || this.extendReason().trim().length < 5) return;
    this.reservations.update((list) =>
      list.map((x) => (x.id === r.id ? { ...x, expiresIn: this.extendDuration() } : x)),
    );
    this.extendTarget.set(null);
    this.showToast('Hold extended — logged to audit log.');
  }

  openCancel(r: Reservation): void {
    this.cancelTarget.set(r);
    this.cancelReason.set('');
  }
  applyCancel(): void {
    const r = this.cancelTarget();
    if (!r || this.cancelReason().trim().length < 5) return;
    this.reservations.update((list) =>
      list.map((x) => (x.id === r.id ? { ...x, status: 'canceled', expiresIn: '—' } : x)),
    );
    this.cancelTarget.set(null);
    this.showToast('Reservation canceled; unit released.');
  }

  closeAll(): void {
    this.confirmTarget.set(null);
    this.extendTarget.set(null);
    this.cancelTarget.set(null);
  }
}
