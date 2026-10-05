export const acquisitionCatalog = [
  {
    id: "FUNDING",
    label: "Rekening & Funding",
    products: [
      {
        id: "LIVIN_ACCOUNT_OPENING",
        label: "Pembukaan Rekening melalui Livin’",
      },
      { id: "MANDIRI_SAVINGS", label: "Mandiri Tabungan Rupiah" },
      { id: "MANDIRI_CURRENT_ACCOUNT", label: "Mandiri Giro" },
      { id: "MANDIRI_TIME_DEPOSIT", label: "Mandiri Deposito" },
      { id: "MANDIRI_PAYROLL_SAVINGS", label: "Mandiri Tabungan Payroll" },
      { id: "MANDIRI_BUSINESS_SAVINGS", label: "Mandiri Tabungan Bisnis" },
      { id: "MANDIRI_NOW_SAVINGS", label: "Mandiri Tabungan NOW" },
    ],
  },
  {
    id: "LIVIN_MERCHANT",
    label: "Livin’ Merchant",
    products: [
      { id: "MERCHANT_ACQUISITION", label: "Akuisisi Merchant" },
      {
        id: "LIVIN_MERCHANT_REGISTRATION",
        label: "Registrasi Livin’ Merchant",
      },
      { id: "LIVIN_MERCHANT_QRIS", label: "QRIS Livin’ Merchant" },
      { id: "LIVIN_MERCHANT_EDC", label: "EDC Mandiri" },
      { id: "MERCHANT_STATUS_MONITORING", label: "Monitoring Status Merchant" },
      { id: "MERCHANT_ONBOARDING", label: "Aktivasi / Onboarding Merchant" },
    ],
  },
  {
    id: "KOPRA",
    label: "Kopra by Mandiri",
    products: [
      { id: "KOPRA_ACQUISITION", label: "Akuisisi Nasabah Kopra" },
      { id: "KOPRA_REGISTRATION", label: "Registrasi Kopra" },
      { id: "KOPRA_CASH_MANAGEMENT", label: "Kopra Cash Management" },
      { id: "KOPRA_CASH_LITE", label: "Kopra Cash Lite" },
      { id: "KOPRA_VIRTUAL_ACCOUNT", label: "Virtual Account" },
      { id: "KOPRA_COLLECTION", label: "Collection" },
      { id: "KOPRA_PAYMENT", label: "Payment" },
      { id: "KOPRA_PAYROLL", label: "Payroll" },
      { id: "KOPRA_TRADE", label: "Kopra Trade / Mandiri Global Trade" },
      { id: "KOPRA_VALUE_CHAIN", label: "Kopra Value Chain" },
      { id: "KOPRA_SUPPLY_CHAIN_FINANCING", label: "Supply Chain Financing" },
    ],
  },
  {
    id: "LIVIN",
    label: "Livin’ by Mandiri",
    products: [
      { id: "LIVIN_REGISTRATION", label: "Registrasi / Aktivasi Livin’" },
      { id: "LIVIN_ACCOUNT_OPENING", label: "Pembukaan Rekening" },
      { id: "LIVIN_TRANSACTION_ACTIVATION", label: "Aktivasi Transaksi" },
      { id: "LIVIN_MAINTENANCE", label: "Upgrade / Maintenance Livin’" },
      { id: "LIVIN_PRODUCT_REFERRAL", label: "Referral Produk" },
    ],
  },
  {
    id: "CREDIT",
    label: "Kredit & Financing",
    products: [
      { id: "MANDIRI_KPR", label: "Mandiri KPR" },
      { id: "MANDIRI_KSM", label: "Kredit Serbaguna Mandiri (KSM)" },
      { id: "MANDIRI_KKB", label: "Mandiri KKB / Mandiri Auto" },
      { id: "MANDIRI_MICRO_LOAN", label: "Kredit Usaha Mikro" },
      { id: "MANDIRI_KUR", label: "Kredit Usaha Rakyat (KUR)" },
      { id: "MANDIRI_SME_LOAN", label: "SME / Business Loan" },
      { id: "CREDIT_REFERRAL", label: "Referral Kredit" },
    ],
  },
  {
    id: "CARDS",
    label: "Kartu",
    products: [
      { id: "MANDIRI_CREDIT_CARD", label: "Mandiri Kartu Kredit" },
      { id: "MANDIRI_DEBIT_CARD", label: "Mandiri Kartu Debit" },
      { id: "CARD_APPLICATION_REFERRAL", label: "Pengajuan / Referral Kartu" },
      { id: "CARD_ACTIVATION", label: "Aktivasi Kartu" },
    ],
  },
  {
    id: "TRANSACTION_BANKING",
    label: "Merchant & Transaction Banking",
    products: [
      { id: "TRANSACTION_QRIS", label: "QRIS" },
      { id: "TRANSACTION_EDC", label: "EDC" },
      { id: "PAYMENT_SOLUTION", label: "Payment Solution" },
      { id: "COLLECTION_SOLUTION", label: "Collection Solution" },
      { id: "CASH_MANAGEMENT", label: "Cash Management" },
      { id: "TRANSACTION_VIRTUAL_ACCOUNT", label: "Virtual Account" },
    ],
  },
  {
    id: "WEALTH",
    label: "Wealth & Investment",
    products: [
      { id: "MUTUAL_FUND", label: "Reksa Dana" },
      { id: "GOVERNMENT_BOND", label: "Obligasi / SBN" },
      { id: "BANCASSURANCE", label: "Bancassurance" },
      { id: "WEALTH_MANAGEMENT", label: "Wealth Management" },
      { id: "INVESTMENT_REFERRAL", label: "Referral Investment" },
    ],
  },
  {
    id: "OTHER",
    label: "Akuisisi Lainnya",
    products: [
      { id: "INDIVIDUAL_CUSTOMER", label: "Nasabah Individu" },
      { id: "PAYROLL_CUSTOMER", label: "Nasabah Payroll" },
      { id: "PRIORITY_CUSTOMER", label: "Nasabah Prioritas" },
      { id: "BUSINESS_CUSTOMER", label: "Nasabah Bisnis" },
      { id: "SME_CUSTOMER", label: "Nasabah SME" },
      { id: "CORPORATE_CUSTOMER", label: "Nasabah Corporate" },
      { id: "OTHER_PRODUCT_REFERRAL", label: "Referral Produk Lainnya" },
    ],
  },
] as const;

export type AcquisitionCategoryId = (typeof acquisitionCatalog)[number]["id"];

export const acquisitionCategoryIds = acquisitionCatalog.map(
  (category) => category.id,
) as [AcquisitionCategoryId, ...AcquisitionCategoryId[]];

export function getAcquisitionCategory(id: string | null | undefined) {
  return acquisitionCatalog.find((category) => category.id === id) ?? null;
}

export function getAcquisitionProduct(
  categoryId: string | null | undefined,
  productId: string | null | undefined,
) {
  return (
    getAcquisitionCategory(categoryId)?.products.find(
      (product) => product.id === productId,
    ) ?? null
  );
}

export function isAcquisitionProductInCategory(
  categoryId: string,
  productId: string,
) {
  return Boolean(getAcquisitionProduct(categoryId, productId));
}
