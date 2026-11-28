export type OfficeField = {
  key: string;
  en: string;
  ar: string;
  type?: string;
  options?: [string, string, string][];
  required?: boolean;
  min?: number;
  max?: number;
};
export const purposes: [string, string, string][] = [
  ['sale', 'Buy / sale', 'شراء / بيع'],
  ['rent', 'Monthly rent', 'إيجار شهري'],
  ['both', 'Both', 'الاثنان'],
];
export const furnishing: [string, string, string][] = [
  ['furnished', 'Furnished', 'مفروش'],
  ['semi', 'Semi-furnished', 'نصف مفروش'],
  ['unfurnished', 'Unfurnished', 'بدون فرش'],
];
export const listingTypes: [string, string, string][] = [
  ['sale_cash', 'Sale · cash', 'بيع كاش'],
  ['sale_installments', 'Sale · installments', 'بيع تقسيط'],
  ['rent', 'Rent', 'إيجار'],
  ['rent_furnished', 'Furnished rent', 'إيجار مفروش'],
];
export const propertyTypes: [string, string, string][] = [
  ['apartment', 'Apartment', 'شقة'],
  ['villa', 'Villa', 'فيلا'],
  ['studio', 'Studio', 'استوديو'],
  ['duplex', 'Duplex', 'دوبلكس'],
  ['office', 'Office', 'مكتب'],
  ['clinic', 'Clinic', 'عيادة'],
  ['retail', 'Retail', 'محل'],
  ['warehouse', 'Warehouse', 'مخزن'],
  ['land', 'Land', 'أرض'],
  ['other', 'Other', 'أخرى'],
];
export const clientStatuses: [string, string, string][] = [
  ['new', 'New', 'جديد'],
  ['contacted', 'Contacted', 'تم التواصل'],
  ['viewing', 'Viewing', 'معاينة'],
  ['negotiating', 'Negotiating', 'تفاوض'],
  ['closed', 'Deal closed', 'صفقة مقفولة'],
  ['lost', 'Lost', 'لم تتم'],
];
export const propertyStatuses: [string, string, string][] = [
  ['available', 'Available', 'متاح'],
  ['booked', 'Booked', 'محجوز'],
  ['rented', 'Rented', 'مؤجر'],
  ['sold', 'Sold', 'مباع'],
  ['withdrawn', 'Withdrawn', 'مسحوب'],
];
export const dealStatuses: [string, string, string][] = [
  ['booked', 'Open booking', 'حجز مفتوح'],
  ['cancelled', 'Cancelled', 'ملغي'],
  ['sold', 'Sale closed', 'بيع مكتمل'],
  ['rented', 'Rent closed', 'إيجار مكتمل'],
  ['ended', 'Lease ended', 'انتهى الإيجار'],
];
const num = (key: string, en: string, ar: string): OfficeField => ({
  key,
  en,
  ar,
  type: 'number',
  min: 0,
});
export const clientFields: OfficeField[] = [
  { key: 'name', en: 'Client name', ar: 'اسم العميل', required: true },
  { key: 'phone', en: 'Phone', ar: 'الهاتف', required: true },
  { key: 'email', en: 'Email', ar: 'البريد الإلكتروني', type: 'email' },
  { key: 'source', en: 'Source', ar: 'المصدر', required: true },
  { key: 'status', en: 'Stage', ar: 'المرحلة', options: clientStatuses },
  { key: 'purpose', en: 'Looking to', ar: 'الغرض', options: purposes, required: true },
  { key: 'projectIds', en: 'Projects', ar: 'المشاريع', type: 'projects' },
  {
    key: 'areas',
    en: 'Preferred areas (one per line)',
    ar: 'المناطق المطلوبة (كل منطقة في سطر)',
    type: 'textarea',
  },
  { key: 'type', en: 'Property type', ar: 'نوع العقار', options: propertyTypes },
  { key: 'furnishing', en: 'Furnishing', ar: 'الفرش', options: furnishing },
  { key: 'saleBudget', en: 'Purchase budget · EGP', ar: 'ميزانية الشراء · جنيه', type: 'money' },
  {
    key: 'rentBudget',
    en: 'Monthly rent budget · EGP',
    ar: 'ميزانية الإيجار الشهري · جنيه',
    type: 'money',
  },
  num('minBedrooms', 'Minimum bedrooms', 'أقل عدد غرف'),
  num('minBathrooms', 'Minimum bathrooms', 'أقل عدد حمامات'),
  num('minArea', 'Minimum area · m²', 'أقل مساحة · م²'),
  num('maxArea', 'Maximum area · m²', 'أكبر مساحة · م²'),
  { key: 'moveIn', en: 'Move-in date', ar: 'موعد السكن', type: 'date' },
  {
    key: 'followUpAt',
    en: 'Next follow-up · Cairo',
    ar: 'المتابعة القادمة · القاهرة',
    type: 'datetime-local',
  },
];
export const propertyFields: OfficeField[] = [
  { key: 'title', en: 'Property title', ar: 'اسم العقار', required: true },
  { key: 'ownerName', en: 'Owner name', ar: 'اسم المالك', required: true },
  {
    key: 'ownerPhone',
    en: 'Owner phone',
    ar: 'رقم المالك',
    type: 'egypt-phone',
    required: true,
  },
  { key: 'cityId', en: 'Project', ar: 'مشروع', required: true, options: [] },
  { key: 'areaName', en: 'Area / district', ar: 'المنطقة / الحي', required: true },
  { key: 'address', en: 'Full address', ar: 'العنوان الكامل', required: true },
  { key: 'groupName', en: 'Group / compound', ar: 'المجموعة / الكمبوند' },
  { key: 'buildingNumber', en: 'Building number', ar: 'رقم العمارة' },
  { key: 'unitNumber', en: 'Unit number', ar: 'رقم الوحدة' },
  { key: 'type', en: 'Property type', ar: 'نوع العقار', options: propertyTypes, required: true },
  {
    key: 'listingType',
    en: 'Listing type',
    ar: 'نوع العرض',
    options: listingTypes,
    required: true,
  },
  { key: 'furnishing', en: 'Furnishing', ar: 'الفرش', options: furnishing, required: true },
  num('bedrooms', 'Bedrooms', 'غرف النوم'),
  num('bathrooms', 'Bathrooms', 'الحمامات'),
  { ...num('area', 'Area · m²', 'المساحة · م²'), required: true, min: 0.01 },
  { ...num('floor', 'Floor', 'الدور'), min: -10 },
  { key: 'finish', en: 'Finishing', ar: 'التشطيب' },
  {
    key: 'deliveryYear',
    en: 'Delivery year',
    ar: 'سنة الاستلام',
    type: 'number',
    min: 1900,
    max: 2100,
  },
  {
    key: 'salePrice',
    en: 'Full sale price · EGP',
    ar: 'سعر البيع الكامل · جنيه',
    type: 'money',
    required: true,
  },
  {
    key: 'downPayment',
    en: 'Down payment · EGP',
    ar: 'المقدم · جنيه',
    type: 'money',
    required: true,
  },
  {
    key: 'rentPrice',
    en: 'Monthly rent · EGP',
    ar: 'الإيجار الشهري · جنيه',
    type: 'money',
    required: true,
  },
  { key: 'deposit', en: 'Security deposit · EGP', ar: 'التأمين · جنيه', type: 'money' },
  {
    ...num('minLeaseMonths', 'Minimum lease · months', 'أقل مدة إيجار · شهور'),
    min: 1,
    required: true,
  },
  { key: 'availableOn', en: 'Available from', ar: 'متاح من', type: 'date' },
  { key: 'verifiedOn', en: 'Last confirmed with owner', ar: 'آخر تأكيد مع المالك', type: 'date' },
  { key: 'negotiable', en: 'Negotiable', ar: 'قابل للتفاوض', type: 'checkbox' },
  {
    key: 'photos',
    en: 'Photo links · HTTPS, one per line',
    ar: 'روابط الصور · HTTPS، كل رابط في سطر',
    type: 'textarea',
  },
  { key: 'description', en: 'Description', ar: 'الوصف', type: 'textarea' },
  { key: 'additions', en: 'Property additions', ar: 'إضافات العقار', type: 'textarea' },
  {
    key: 'duplicateReason',
    en: 'Reason if this resembles an existing property',
    ar: 'سبب الإضافة إذا تشابه مع عقار موجود',
    type: 'textarea',
  },
];
export const commonFilters: OfficeField[] = [
  {
    key: 'q',
    en: 'Search name, phone, code or address',
    ar: 'بحث بالاسم أو الهاتف أو الكود أو العنوان',
  },
  { key: 'purpose', en: 'Purpose', ar: 'الغرض', options: purposes },
  { key: 'areaName', en: 'Area', ar: 'المنطقة' },
  { key: 'type', en: 'Property type', ar: 'نوع العقار', options: propertyTypes },
  { key: 'furnishing', en: 'Furnishing', ar: 'الفرش', options: furnishing },
  {
    key: 'minPrice',
    en: 'Minimum price / budget · EGP',
    ar: 'أقل سعر / ميزانية · جنيه',
    type: 'money',
  },
  {
    key: 'maxPrice',
    en: 'Maximum price / budget · EGP',
    ar: 'أعلى سعر / ميزانية · جنيه',
    type: 'money',
  },
  num('minBedrooms', 'Minimum bedrooms', 'أقل عدد غرف'),
  num('minBathrooms', 'Minimum bathrooms', 'أقل عدد حمامات'),
  num('minArea', 'Minimum area · m²', 'أقل مساحة · م²'),
  num('maxArea', 'Maximum area · m²', 'أكبر مساحة · م²'),
  { key: 'createdFrom', en: 'Added from', ar: 'أضيف من', type: 'date' },
  { key: 'createdTo', en: 'Added through', ar: 'أضيف حتى', type: 'date' },
];
