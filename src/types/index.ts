
export interface Company {
  id: string; // In Tally, this might be the company name or a file path/GUID
  name: string;
}

export interface Customer {
  id: string; // For app reference, in Tally often the Ledger Name
  name: string;
  contactPerson?: string;
  phoneNumber?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string; // May need to be parsed from Address or be a UDF in Tally
  state: string; // May need to be parsed or use PlaceOfSupply
  pincode: string;
  gstin?: string;
  ledgerName: string; // Actual Tally Ledger Name
  group: 'Sundry Debtors'; // Tally group
  creditAccount: string; // This is an app-level concept, maps to a Sales Ledger in Tally
  companyId?: string; // Name of the Tally company this customer belongs to
}

export interface InvoiceItem {
  id: string; // App-level ID
  itemName: string; // Tally Stock Item Name
  hsnSac?: string;
  quantity: number;
  rate: number;
  unit: string; // e.g. PCS, KGS, NOS - Must match Tally unit symbols
  amount: number;
}

export interface Invoice {
  id: string; // App-level ID
  invoiceNumber: string; // Actual Tally Voucher Number
  invoiceDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
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
  voucherType: 'Sales'; // Tally Voucher Type
  companyId?: string; // Name of the Tally company this invoice belongs to
}

// These MOCK_CREDIT_ACCOUNTS should be updated by the user
// to reflect actual Sales Ledger names in their Tally company.
export const MOCK_CREDIT_ACCOUNTS = [
  { value: 'Sales', label: 'Sales Account' },
  { value: 'Sales - Domestic', label: 'Sales - Domestic' },
  { value: 'Sales - Export', label: 'Sales - Export' },
  { value: 'Service Income', label: 'Service Income' },
  // Add more or modify these to match your Tally ledger names
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

// These MOCK_UNITS should also ideally match unit symbols defined in Tally.
export const MOCK_UNITS = [
  { value: 'NOS', label: 'Numbers (NOS)' },
  { value: 'PCS', label: 'Pieces (PCS)' },
  { value: 'KGS', label: 'Kilograms (KGS)' },
  { value: 'LTR', label: 'Litres (LTR)' },
  { value: 'MTR', label: 'Meters (MTR)' },
  { value: 'BOX', label: 'Box (BOX)' },
  { value: 'SET', label: 'Sets (SET)' },
  // Add more units as per your Tally setup
];

// MOCK_COMPANIES is removed as companies are now fetched from Tally.

// Basic number to words converter (Simplified for brevity)
export function numberToWords(num: number): string {
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  
  const inWords = (n: number): string => {
    if (n < 0) return "minus " + inWords(Math.abs(n));
    if (n < 20) return a[n];
    let digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? '-' + a[digit] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 === 0 ? '' : ' and ' + inWords(n % 100));
    if (n < 100000) return inWords(Math.floor(n/1000)) + ' thousand' + (n % 1000 === 0 ? '' : ' ' + inWords(n % 1000));
    if (n < 10000000) return inWords(Math.floor(n/100000)) + ' lakh' + (n % 100000 === 0 ? '' : ' ' + inWords(n % 100000));
    // Add more for crores if needed
    return 'Number too large to convert for this simple function';
  }

  if (num === 0) return 'Zero';
  const result = inWords(Math.floor(num));
  const decimalPart = Math.round((num % 1) * 100); // Convert paisa to integer
  
  let words = result.charAt(0).toUpperCase() + result.slice(1);
  if (decimalPart > 0) {
    words += ' and ' + inWords(decimalPart) + ' Paise';
  }
  return words + ' Only';
}
