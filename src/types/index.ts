export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  phoneNumber?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  gstin?: string;
  ledgerName: string; 
  group: 'Sundry Debtors';
  creditAccount: string; 
}

export interface InvoiceItem {
  id: string;
  itemName: string;
  hsnSac?: string;
  quantity: number;
  rate: number;
  unit: string; // e.g. PCS, KGS, NOS
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  customer: Customer;
  items: InvoiceItem[];
  subTotal: number;
  sgstRate?: number;
  sgstAmount?: number;
  cgstRate?: number;
  cgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalAmount: number;
  amountInWords: string;
  voucherType: 'Sales';
}

export const MOCK_CREDIT_ACCOUNTS = [
  { value: 'sales_domestic', label: 'Sales - Domestic' },
  { value: 'sales_export', label: 'Sales - Export' },
  { value: 'service_income', label: 'Service Income' },
  { value: 'other_income_indirect', label: 'Other Indirect Income' },
];

export const MOCK_STATES = [
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'CT', label: 'Chhattisgarh' },
  { value: 'DN', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'DL', label: 'Delhi' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OR', label: 'Odisha' },
  { value: 'PY', label: 'Puducherry' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UT', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' }
];

export const MOCK_UNITS = [
  { value: 'NOS', label: 'Numbers (NOS)' },
  { value: 'PCS', label: 'Pieces (PCS)' },
  { value: 'KGS', label: 'Kilograms (KGS)' },
  { value: 'LTR', label: 'Litres (LTR)' },
  { value: 'MTR', label: 'Meters (MTR)' },
  { value: 'BOX', label: 'Box (BOX)' },
  { value: 'SET', label: 'Sets (SET)' },
];

// Basic number to words converter (Simplified for brevity)
export function numberToWords(num: number): string {
  // This is a very simplified version. 
  // For a production app, use a robust library.
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    let digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? '-' + a[digit] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 === 0 ? '' : ' and ' + inWords(n % 100));
    if (n < 100000) return inWords(Math.floor(n/1000)) + ' thousand' + (n % 1000 === 0 ? '' : ' ' + inWords(n % 1000));
    // Add more for lakhs, crores if needed
    return 'Number too large to convert';
  }

  if (num === 0) return 'zero';
  const result = inWords(Math.floor(num));
  const decimalPart = Math.round((num % 1) * 100);
  return result.toUpperCase() + (decimalPart > 0 ? ' AND ' + inWords(decimalPart).toUpperCase() + ' PAISE' : '') + ' ONLY';
}
