import { Component, computed, inject } from '@angular/core';
import { CompanyUiState, type Lang } from '../company-ui-state';

interface Campaign {
  name: string;
  nameAr: string;
  source: string;
  sourceAr: string;
  project: string;
  projectAr: string;
  spend: number;
  leads: number;
  deals: number;
  revenue: number;
  status: 'active' | 'ended';
}

const SEED: Campaign[] = [
  { name: 'Hillside Bay — launch push', nameAr: 'هيلسايد باي — دفعة الإطلاق', source: 'Facebook', sourceAr: 'فيسبوك', project: 'Hillside Bay', projectAr: 'هيلسايد باي', spend: 185_000, leads: 420, deals: 11, revenue: 128_000_000, status: 'active' },
  { name: 'Marina Heights — office leasing', nameAr: 'مارينا هايتس — تأجير مكاتب', source: 'Google Ads', sourceAr: 'جوجل', project: 'Marina Heights', projectAr: 'مارينا هايتس', spend: 92_000, leads: 180, deals: 6, revenue: 27_000_000, status: 'active' },
  { name: 'North Coast — summer chalets', nameAr: 'الساحل الشمالي — شاليهات الصيف', source: 'Instagram', sourceAr: 'انستجرام', project: 'North Coast', projectAr: 'الساحل الشمالي', spend: 64_000, leads: 260, deals: 4, revenue: 21_600_000, status: 'ended' },
  { name: 'Referral bonus Q3', nameAr: 'مكافأة التوصية — الربع الثالث', source: 'Referral', sourceAr: 'توصية', project: 'All projects', projectAr: 'كل المشروعات', spend: 30_000, leads: 95, deals: 9, revenue: 61_200_000, status: 'ended' },
  { name: 'Property Finder listings boost', nameAr: 'تعزيز إعلانات بروبرتي فايندر', source: 'Property Finder', sourceAr: 'بروبرتي فايندر', project: 'All projects', projectAr: 'كل المشروعات', spend: 48_000, leads: 310, deals: 7, revenue: 54_800_000, status: 'active' },
];

interface Copy {
  eyebrow: string;
  title: string;
  sub: string;
  kpis: { spend: string; leads: string; cpl: string; deals: string; revenue: string };
  thCampaign: string;
  thSource: string;
  thSpend: string;
  thLeads: string;
  thCpl: string;
  thDeals: string;
  thRevenue: string;
  statusNames: Record<'active' | 'ended', string>;
}

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: 'Growth',
    title: 'Marketing',
    sub: 'Spend, leads, cost per lead and closed deals by campaign and source.',
    kpis: { spend: 'Total spend', leads: 'Leads', cpl: 'Blended CPL', deals: 'Deals closed', revenue: 'Revenue attributed' },
    thCampaign: 'Campaign',
    thSource: 'Source',
    thSpend: 'Spend',
    thLeads: 'Leads',
    thCpl: 'CPL',
    thDeals: 'Deals',
    thRevenue: 'Revenue',
    statusNames: { active: 'Active', ended: 'Ended' },
  },
  ar: {
    eyebrow: 'النمو',
    title: 'التسويق',
    sub: 'الإنفاق والعملاء وتكلفة العميل والصفقات المغلقة لكل حملة ومصدر.',
    kpis: { spend: 'إجمالي الإنفاق', leads: 'العملاء', cpl: 'تكلفة العميل', deals: 'الصفقات المغلقة', revenue: 'الإيرادات المنسوبة' },
    thCampaign: 'الحملة',
    thSource: 'المصدر',
    thSpend: 'الإنفاق',
    thLeads: 'العملاء',
    thCpl: 'تكلفة العميل',
    thDeals: 'الصفقات',
    thRevenue: 'الإيرادات',
    statusNames: { active: 'نشطة', ended: 'منتهية' },
  },
};

@Component({
  selector: 'app-marketing',
  templateUrl: './marketing.html',
  styleUrl: './marketing.scss',
})
export class Marketing {
  private readonly ui = inject(CompanyUiState);
  readonly lang = computed<Lang>(() => this.ui.lang());
  readonly L = computed(() => COPY[this.lang()]);
  readonly ar = computed(() => this.lang() === 'ar');

  readonly campaigns = SEED;

  name(c: Campaign): string {
    return this.ar() ? c.nameAr : c.name;
  }
  source(c: Campaign): string {
    return this.ar() ? c.sourceAr : c.source;
  }
  project(c: Campaign): string {
    return this.ar() ? c.projectAr : c.project;
  }
  cpl(c: Campaign): number {
    return Math.round(c.spend / c.leads);
  }

  readonly totals = computed(() => {
    const spend = this.campaigns.reduce((s, c) => s + c.spend, 0);
    const leads = this.campaigns.reduce((s, c) => s + c.leads, 0);
    const deals = this.campaigns.reduce((s, c) => s + c.deals, 0);
    const revenue = this.campaigns.reduce((s, c) => s + c.revenue, 0);
    return { spend, leads, deals, revenue, cpl: Math.round(spend / leads) };
  });

  money(n: number): string {
    if (n >= 1_000_000) return 'EGP ' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    return 'EGP ' + n.toLocaleString('en-US');
  }
}
