import type { Customer, Invoice, InvoiceItem, Company } from '@/types';
import { numberToWords, MOCK_COMPANIES } from '@/types';

// Placeholder for your Tally API endpoint configuration
// In a real scenario, this would be configurable, possibly via environment variables.
const TALLY_API_BASE_URL = 'http://localhost:9000'; // Default Tally port is 9000

let MOCK_CUSTOMERS_DB: Customer[] = [
  { 
    id: 'cust_001', 
    name: 'Acme Corp Ltd.', 
    ledgerName: 'Acme Corp Ltd.', 
    group: 'Sundry Debtors', 
    gstin: '27ABCDE1234F1Z5', 
    creditAccount: 'sales_domestic',
    addressLine1: '123 Innovation Drive',
    city: 'Mumbai',
    state: 'MH',
    pincode: '400001',
    email: 'contact@acmecorp.com',
    phoneNumber: '9876543210',
    companyId: MOCK_COMPANIES[0].id, // Associated with the first mock company
  },
  { 
    id: 'cust_002', 
    name: 'Beta Solutions Inc.', 
    ledgerName: 'Beta Solutions Inc.', 
    group: 'Sundry Debtors', 
    gstin: '29PQRST5678G2Z4', 
    creditAccount: 'service_income',
    addressLine1: '456 Tech Park',
    city: 'Bengaluru',
    state: 'KA',
    pincode: '560001',
    email: 'info@betasolutions.com',
    phoneNumber: '9123456789',
    companyId: MOCK_COMPANIES[0].id, // Associated with the first mock company
  },
];

let MOCK_INVOICES_DB: Invoice[] = [];
let customerIdCounter = MOCK_CUSTOMERS_DB.length + 1;
let invoiceIdCounter = 1;

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Real Tally API calls would go below, replacing mock functions ---
// Example:
// async function sendTallyRequest(xmlPayload: string): Promise<string> {
//   const response = await fetch(TALLY_API_BASE_URL, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/xml' },
//     body: xmlPayload,
//   });
//   if (!response.ok) throw new Error(`Tally API request failed: ${response.statusText}`);
//   return response.text(); // XML response from Tally
// }
// --- End of example ---


export async function getTallyCompanies(): Promise<Company[]> {
  await simulateDelay(300);
  // In a real scenario, this would fetch companies from Tally.
  // For example, by sending an XML request to TALLY_API_BASE_URL.
  console.log(`Mock API: Fetching companies. Real endpoint would be ${TALLY_API_BASE_URL}`);
  return MOCK_COMPANIES;
}

export async function findCustomerByName(name: string, companyId: string): Promise<Customer | null> {
  await simulateDelay(500);
  console.log(`Mock API: Searching for customer "${name}" in company "${companyId}". Real endpoint would be ${TALLY_API_BASE_URL}`);
  const searchTerm = name.toLowerCase();
  // In a real scenario, filter by companyId as well if your Tally structure requires it
  const found = MOCK_CUSTOMERS_DB.find(c => c.companyId === companyId && c.name.toLowerCase().includes(searchTerm));
  return found || null;
}

export async function createNewCustomer(
  data: Omit<Customer, 'id' | 'ledgerName' | 'group'> & { name: string },
  companyId: string
): Promise<Customer> {
  await simulateDelay(1000);
  console.log(`Mock API: Creating customer "${data.name}" in company "${companyId}". Real endpoint would be ${TALLY_API_BASE_URL}`);
  const newCustomer: Customer = {
    ...data,
    id: `cust_${String(customerIdCounter++).padStart(3, '0')}`,
    ledgerName: data.name, 
    group: 'Sundry Debtors',
    companyId: companyId,
  };
  MOCK_CUSTOMERS_DB.push(newCustomer);
  return newCustomer;
}

export async function generateNewInvoice(
  data: Omit<Invoice, 'id' | 'invoiceNumber' | 'customer' | 'voucherType' | 'totalAmount' | 'subTotal' | 'amountInWords'> & { items: Omit<InvoiceItem, 'id' | 'amount'>[] },
  customer: Customer,
  companyId: string
): Promise<Invoice> {
  await simulateDelay(1500);
  console.log(`Mock API: Generating invoice for "${customer.name}" in company "${companyId}". Real endpoint would be ${TALLY_API_BASE_URL}`);
  
  let subTotal = 0;
  const processedItems: InvoiceItem[] = data.items.map((item, index) => {
    const amount = item.quantity * item.rate;
    subTotal += amount;
    return {
      ...item,
      id: `item_${Date.now()}_${index}`,
      amount,
    };
  });

  const supplierState = 'MH'; 
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  const gstRate = 0.18; 

  if (customer.state === supplierState) {
    cgstAmount = subTotal * (gstRate / 2);
    sgstAmount = subTotal * (gstRate / 2);
  } else {
    igstAmount = subTotal * gstRate;
  }
  
  const totalAmount = subTotal + cgstAmount + sgstAmount + igstAmount;

  const newInvoice: Invoice = {
    ...data,
    id: `inv_${String(invoiceIdCounter).padStart(4, '0')}`,
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoiceIdCounter++).padStart(4, '0')}`,
    customer,
    items: processedItems,
    subTotal,
    cgstRate: customer.state === supplierState ? gstRate / 2 * 100 : undefined,
    cgstAmount: customer.state === supplierState ? cgstAmount : undefined,
    sgstRate: customer.state === supplierState ? gstRate / 2 * 100 : undefined,
    sgstAmount: customer.state === supplierState ? sgstAmount : undefined,
    igstRate: customer.state !== supplierState ? gstRate * 100 : undefined,
    igstAmount: customer.state !== supplierState ? igstAmount : undefined,
    totalAmount,
    amountInWords: numberToWords(totalAmount),
    voucherType: 'Sales',
    companyId: companyId,
  };
  MOCK_INVOICES_DB.push(newInvoice);
  return newInvoice;
}
