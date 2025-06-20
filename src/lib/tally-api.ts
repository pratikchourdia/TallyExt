import type { Customer, Invoice, InvoiceItem } from '@/types';
import { numberToWords } from '@/types';

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
    phoneNumber: '9876543210'
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
    phoneNumber: '9123456789'
  },
];

let MOCK_INVOICES_DB: Invoice[] = [];
let customerIdCounter = MOCK_CUSTOMERS_DB.length + 1;
let invoiceIdCounter = 1;

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function findCustomerByName(name: string): Promise<Customer | null> {
  await simulateDelay(500);
  const searchTerm = name.toLowerCase();
  const found = MOCK_CUSTOMERS_DB.find(c => c.name.toLowerCase().includes(searchTerm));
  return found || null;
}

export async function createNewCustomer(
  data: Omit<Customer, 'id' | 'ledgerName' | 'group'> & { name: string }
): Promise<Customer> {
  await simulateDelay(1000);
  const newCustomer: Customer = {
    ...data,
    id: `cust_${String(customerIdCounter++).padStart(3, '0')}`,
    ledgerName: data.name, // In Tally, Ledger Name is often same as Customer Name
    group: 'Sundry Debtors',
  };
  MOCK_CUSTOMERS_DB.push(newCustomer);
  return newCustomer;
}

export async function generateNewInvoice(
  data: Omit<Invoice, 'id' | 'invoiceNumber' | 'customer' | 'voucherType' | 'totalAmount' | 'subTotal' | 'amountInWords'> & { items: Omit<InvoiceItem, 'id' | 'amount'>[] },
  customer: Customer
): Promise<Invoice> {
  await simulateDelay(1500);
  
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

  // Basic GST calculation (example: 9% CGST, 9% SGST if customer is in same state, else 18% IGST)
  // This is a simplified example. Real GST depends on item HSN, customer state, supplier state etc.
  // Assuming supplier is in 'MH' (Maharashtra) for this mock.
  const supplierState = 'MH'; 
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  const gstRate = 0.18; // Assuming a flat 18% GST for simplicity

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
  };
  MOCK_INVOICES_DB.push(newInvoice);
  return newInvoice;
}
