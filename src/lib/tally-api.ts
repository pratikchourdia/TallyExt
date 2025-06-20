
import type { Customer, Invoice, InvoiceItem, Company } from '@/types';
import { numberToWords } from '@/types'; // Keep numberToWords and other UI helpers

// Tally API endpoint
const TALLY_API_BASE_URL = 'http://localhost:9000';

// Helper function to send XML requests to Tally and parse the XML response
async function sendTallyRequest(xmlPayload: string): Promise<XMLDocument> {
  try {
    const response = await fetch(TALLY_API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: xmlPayload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tally API request failed:', response.status, response.statusText, errorText);
      throw new Error(`Tally API request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const responseText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(responseText, 'application/xml');

    // Check for Tally errors within the XML response
    const errorNode = xmlDoc.querySelector('LINEERROR, ERROR');
    if (errorNode) {
      console.error('Tally returned an error:', errorNode.textContent);
      throw new Error(`Tally error: ${errorNode.textContent}`);
    }
    
    return xmlDoc;
  } catch (error) {
    console.error('Error in sendTallyRequest:', error);
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
        throw new Error(
`Failed to connect to Tally at ${TALLY_API_BASE_URL}.
Please check the following:
1. Ensure Tally application is running on your computer.
2. Ensure the correct company is loaded within Tally.
3. Verify Tally is configured to allow API access (e.g., on port 9000 via Tally.ini settings or enabling HTTP/ODBC services in Tally).
4. Potential CORS issue or Private Network Access (PNA) block:
   - If your browser console shows 'Blocked by Private Network Access checks' or similar CORS errors, your browser is preventing requests to 'localhost' or private IP addresses from this web application.
   - For development, you might temporarily disable this check in your browser (e.g., for Chrome, navigate to 'chrome://flags/#block-insecure-private-network-requests' and disable it). This is NOT a production solution.
   - For a long-term solution, Tally (or a proxy server you control) needs to handle CORS preflight requests and send appropriate 'Access-Control-Allow-Origin' and 'Access-Control-Allow-Private-Network: true' headers.
   - Consider using a backend proxy (e.g., a Next.js API route that forwards the request) to make requests to Tally if direct browser access is restricted by PNA.
Original error: ${error.message}`
        );
    }
    throw error;
  }
}

// --- Tally API Functions ---

export async function getTallyCompanies(): Promise<Company[]> {
  const requestXml = `
    <ENVELOPE>
      <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
      </HEADER>
      <BODY>
        <EXPORTDATA>
          <REQUESTDESC>
            <REPORTNAME>List of Companies</REPORTNAME>
            <STATICVARIABLES>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
          </REQUESTDESC>
        </EXPORTDATA>
      </BODY>
    </ENVELOPE>`;

  try {
    const xmlDoc = await sendTallyRequest(requestXml);
    const companies: Company[] = [];
    const companyNameElements = xmlDoc.querySelectorAll('COMPANYNAME, NAME'); 
    
    if (companyNameElements.length === 0 && xmlDoc.querySelector('COMPANY')) {
        xmlDoc.querySelectorAll('COMPANY').forEach(companyNode => {
            const nameNode = companyNode.querySelector('NAME');
            const idNode = companyNode.querySelector('ID'); 
            if (nameNode) {
                 companies.push({
                    id: idNode?.textContent?.trim() || nameNode.textContent!.trim(), 
                    name: nameNode.textContent!.trim(),
                });
            }
        });
    } else {
        companyNameElements.forEach((node) => {
            const name = node.textContent?.trim();
            if (name) {
            companies.push({ id: name, name });
            }
        });
    }

    if (companies.length === 0 && xmlDoc.documentElement.outerHTML.includes('<NOCONNECTION')) {
       throw new Error("Tally is not connected or no company is loaded. Please ensure Tally is running with a company open.");
    } else if (companies.length === 0) {
         console.warn("No companies found in Tally response, or XML structure not recognized.", xmlDoc.documentElement.outerHTML);
    }
    return companies;
  } catch (error) {
    console.error('Error fetching Tally companies:', error);
    throw error; 
  }
}

export async function findCustomerByName(name: string, companyName: string): Promise<Customer | null> {
  const requestXml = `
    <ENVELOPE>
      <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
      </HEADER>
      <BODY>
        <EXPORTDATA>
          <REQUESTDESC>
            <REPORTNAME>Ledger</REPORTNAME>
            <STATICVARIABLES>
              <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
              <MASTERTYPE>Ledger</MASTERTYPE>
              <FETCHLIST>NAME, ADDRESS, PINCODE, LEDGERPHONE, EMAIL, PARTYGSTIN, PARENT, STATENAME, LEDGERMOBILE</FETCHLIST>
            </STATICVARIABLES>
            <FILTER>
                <NAME>${name}</NAME>
            </FILTER>
          </REQUESTDESC>
        </EXPORTDATA>
      </BODY>
    </ENVELOPE>`;

  try {
    const xmlDoc = await sendTallyRequest(requestXml);
    const ledgerNode = xmlDoc.querySelector('LEDGER');

    if (!ledgerNode) return null;

    const getText = (selector: string, parentNode: Element | null = ledgerNode) => parentNode?.querySelector(selector)?.textContent?.trim() || '';
    
    const addressLines = (getText('ADDRESS', ledgerNode) || '').split('\n').map(line => line.trim()).filter(line => line);

    const customer: Customer = {
      id: getText('NAME'), 
      name: getText('NAME'),
      ledgerName: getText('NAME'),
      group: getText('PARENT') === 'Sundry Debtors' ? 'Sundry Debtors' : 'Sundry Debtors',
      addressLine1: addressLines[0] || '',
      addressLine2: addressLines[1] || '',
      city: addressLines[2] || '', 
      state: getText('STATENAME') || addressLines[3] || '', 
      pincode: getText('PINCODE'),
      email: getText('EMAIL'),
      phoneNumber: getText('LEDGERPHONE') || getText('LEDGERMOBILE'),
      gstin: getText('PARTYGSTIN'),
      creditAccount: '', 
      companyId: companyName,
    };
    
    return customer;
  } catch (error) {
    console.error(`Error finding customer "${name}" in Tally:`, error);
    throw error;
  }
}

export async function createNewCustomer(
  data: Omit<Customer, 'id' | 'ledgerName' | 'group'> & { name: string },
  companyName: string
): Promise<Customer> {
  const requestXml = `
    <ENVELOPE>
      <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
      </HEADER>
      <BODY>
        <IMPORTDATA>
          <REQUESTDESC>
            <REPORTNAME>All Masters</REPORTNAME>
            <STATICVARIABLES>
              <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
          </REQUESTDESC>
          <REQUESTDATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
              <LEDGER NAME="${data.name}" RESERVEDNAME="">
                <ADDRESS.LIST TYPE="String">
                  <ADDRESS>${data.addressLine1}</ADDRESS>
                  ${data.addressLine2 ? `<ADDRESS>${data.addressLine2}</ADDRESS>` : ''}
                  ${data.city ? `<ADDRESS>${data.city}</ADDRESS>` : ''}
                </ADDRESS.LIST>
                <MAILINGNAME>${data.name}</MAILINGNAME>
                <PARENT>Sundry Debtors</PARENT>
                <COUNTRYNAME>India</COUNTRYNAME>
                <PINCODE>${data.pincode || ''}</PINCODE>
                <STATENAME>${data.state || ''}</STATENAME>
                <LEDGERPHONE>${data.phoneNumber || ''}</LEDGERPHONE>
                <EMAIL>${data.email || ''}</EMAIL>
                <PARTYGSTIN>${data.gstin || ''}</PARTYGSTIN>
                <GSTREGISTRATIONTYPE>${data.gstin ? 'Regular' : 'Unregistered'}</GSTREGISTRATIONTYPE>
                <ISBILLWISEON>Yes</ISBILLWISEON>
                <OPENINGBALANCE>0</OPENINGBALANCE>
              </LEDGER>
            </TALLYMESSAGE>
          </REQUESTDATA>
        </IMPORTDATA>
      </BODY>
    </ENVELOPE>`;

  try {
    const xmlDoc = await sendTallyRequest(requestXml);
    const createdNode = xmlDoc.querySelector('CREATED, ALTERED');
    if (!createdNode || createdNode.textContent !== '1') {
      const errors = Array.from(xmlDoc.querySelectorAll('LINEERROR, ERROR')).map(e => e.textContent).join(', ');
      throw new Error('Tally failed to create customer. ' + (errors || 'No details provided. Check Tally.imp log for more info.'));
    }

    const newCustomer: Customer = {
      ...data,
      id: data.name, 
      ledgerName: data.name,
      group: 'Sundry Debtors',
      companyId: companyName,
    };
    return newCustomer;
  } catch (error) {
    console.error(`Error creating customer "${data.name}" in Tally:`, error);
    throw error;
  }
}


export async function generateNewInvoice(
  data: Omit<Invoice, 'id' | 'invoiceNumber' | 'customer' | 'voucherType' | 'totalAmount' | 'subTotal' | 'amountInWords' | 'companyId'> & { items: Omit<InvoiceItem, 'id' | 'amount'>[] },
  customer: Customer,
  companyName: string
): Promise<Invoice> {
  
  const salesLedgerName = customer.creditAccount || 'Sales'; 

  let subTotal = 0;
  const processedItems: InvoiceItem[] = data.items.map((item, index) => {
    const amount = item.quantity * item.rate;
    subTotal += amount;
    return { ...item, id: `item_${Date.now()}_${index}`, amount };
  });
  
  const today = new Date(data.invoiceDate);
  const formattedDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const voucherNumber = `API-${Date.now()}`; 

  let inventoryEntriesXml = '';
  processedItems.forEach(item => {
    inventoryEntriesXml += `
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${item.itemName}</STOCKITEMNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <RATE>${item.rate.toFixed(2)}/${item.unit}</RATE>
        <AMOUNT>${item.amount.toFixed(2)}</AMOUNT>
        <ACTUALQTY>${item.quantity} ${item.unit}</ACTUALQTY>
        <BILLEDQTY>${item.quantity} ${item.unit}</BILLEDQTY>
        <ACCOUNTINGALLOCATIONS.LIST>
          <LEDGERNAME>${salesLedgerName}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${item.amount.toFixed(2)}</AMOUNT>
        </ACCOUNTINGALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>`;
  });
  
  const finalTotalAmount = subTotal; 

  const requestXml = `
    <ENVELOPE>
      <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
      </HEADER>
      <BODY>
        <IMPORTDATA>
          <REQUESTDESC>
            <REPORTNAME>All Masters</REPORTNAME> 
            <STATICVARIABLES>
              <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
          </REQUESTDESC>
          <REQUESTDATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
              <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
                <DATE>${formattedDate}</DATE>
                <GUID>api-guid-${Date.now()}</GUID> 
                <NARRATION>Sales Invoice created via API for ${customer.name}</NARRATION>
                <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER> 
                <PARTYLEDGERNAME>${customer.name}</PARTYLEDGERNAME>
                <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
                <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
                <PLACEOFSUPPLY>${customer.state || ''}</PLACEOFSUPPLY> 
                <CONSIGNEEGSTIN>${customer.gstin || ''}</CONSIGNEEGSTIN>
                <CONSIGNEEMAILINGNAME>${customer.name}</CONSIGNEEMAILINGNAME>
                <CONSIGNEESTATE>${customer.state || ''}</CONSIGNEESTATE>
                <ALLLEDGERENTRIES.LIST>
                  <LEDGERNAME>${customer.name}</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                  <AMOUNT>-${finalTotalAmount.toFixed(2)}</AMOUNT> 
                </ALLLEDGERENTRIES.LIST>
                ${inventoryEntriesXml}
                <ISINVOICE>Yes</ISINVOICE>
              </VOUCHER>
            </TALLYMESSAGE>
          </REQUESTDATA>
        </IMPORTDATA>
      </BODY>
    </ENVELOPE>`;

  try {
    const xmlDoc = await sendTallyRequest(requestXml);
    const createdNode = xmlDoc.querySelector('CREATED, ALTERED'); 
    const newVchNoNode = xmlDoc.querySelector('VOUCHERNUMBER'); 

    if (!createdNode || createdNode.textContent !== '1') {
       const errors = Array.from(xmlDoc.querySelectorAll('LINEERROR, ERROR')).map(e => e.textContent).join(', ');
      throw new Error('Tally failed to generate invoice. ' + (errors || 'No details provided. Check Tally.imp log for more info.'));
    }
    
    const actualInvoiceNumber = newVchNoNode?.textContent?.trim() || voucherNumber;
    const invoiceFromTally = await fetchInvoiceDetails(actualInvoiceNumber, companyName);

    const newInvoice: Invoice = {
      ...data,
      id: `tally_inv_${actualInvoiceNumber}_${Date.now()}`, 
      invoiceNumber: actualInvoiceNumber,
      customer,
      items: processedItems, 
      subTotal: invoiceFromTally?.subTotal || subTotal,
      cgstRate: invoiceFromTally?.cgstRate,
      cgstAmount: invoiceFromTally?.cgstAmount,
      sgstRate: invoiceFromTally?.sgstRate,
      sgstAmount: invoiceFromTally?.sgstAmount,
      igstRate: invoiceFromTally?.igstRate,
      igstAmount: invoiceFromTally?.igstAmount,
      totalAmount: invoiceFromTally?.totalAmount || finalTotalAmount, 
      amountInWords: numberToWords(invoiceFromTally?.totalAmount || finalTotalAmount),
      voucherType: 'Sales',
      companyId: companyName,
    };
    return newInvoice;
  } catch (error) {
    console.error(`Error generating invoice in Tally for customer "${customer.name}":`, error);
    throw error;
  }
}

async function fetchInvoiceDetails(voucherNumber: string, companyName: string): Promise<Partial<Invoice> | null> {
  const requestXml = `
  <ENVELOPE>
    <HEADER>
      <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
    <BODY>
      <EXPORTDATA>
        <REQUESTDESC>
          <REPORTNAME>Voucher</REPORTNAME>
          <STATICVARIABLES>
            <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            <VCHKEY>;VoucherNumber;${voucherNumber}</VCHKEY> 
            <FETCHALLCOLLECTIONS>Yes</FETCHALLCOLLECTIONS>
            <FETCHCOMPUTEDCOLLECTIONS>Yes</FETCHCOMPUTEDCOLLECTIONS>
          </STATICVARIABLES>
        </REQUESTDESC>
      </EXPORTDATA>
    </BODY>
  </ENVELOPE>`;
  try {
    const xmlDoc = await sendTallyRequest(requestXml);
    const voucherNode = xmlDoc.querySelector('VOUCHER');
    if (!voucherNode) return null;

    let subTotal = 0;
    let totalAmount = 0;
    let cgstAmount: number | undefined = undefined;
    let sgstAmount: number | undefined = undefined;
    let igstAmount: number | undefined = undefined;
    let cgstRate: number | undefined = undefined;
    let sgstRate: number | undefined = undefined;
    let igstRate: number | undefined = undefined;

    const partyLedgerName = voucherNode.querySelector('PARTYLEDGERNAME')?.textContent;
    voucherNode.querySelectorAll('ALLLEDGERENTRIES\\.LIST').forEach(entry => {
        if (entry.querySelector('LEDGERNAME')?.textContent === partyLedgerName) {
            const amountText = entry.querySelector('AMOUNT')?.textContent;
            if (amountText) {
                totalAmount = Math.abs(parseFloat(amountText));
            }
        }
    });
    
    voucherNode.querySelectorAll('ALLINVENTORYENTRIES\\.LIST').forEach(itemNode => {
        const amountText = itemNode.querySelector('AMOUNT')?.textContent;
        if (amountText) {
            subTotal += parseFloat(amountText);
        }
    });

    voucherNode.querySelectorAll('LEDGERENTRIES\\.LIST').forEach(ledgerEntry => {
        const ledgerName = ledgerEntry.querySelector('LEDGERNAME')?.textContent?.toUpperCase();
        const amountText = ledgerEntry.querySelector('AMOUNT')?.textContent;
        const amount = amountText ? parseFloat(amountText) : 0;

        if (ledgerName?.includes('CGST')) {
            cgstAmount = (cgstAmount || 0) + amount;
            const rateText = ledgerEntry.querySelector('GSTCOMMONTAXDETAILS\\.LIST > GSTRATEDETAILS\\.LIST > GSTRATEVAL')?.textContent;
            if (rateText) cgstRate = parseFloat(rateText); else if (subTotal > 0 && amount > 0) cgstRate = parseFloat(((amount / subTotal) * 100).toFixed(2));
        } else if (ledgerName?.includes('SGST') || ledgerName?.includes('UTGST')) {
            sgstAmount = (sgstAmount || 0) + amount;
            const rateText = ledgerEntry.querySelector('GSTCOMMONTAXDETAILS\\.LIST > GSTRATEDETAILS\\.LIST > GSTRATEVAL')?.textContent;
            if (rateText) sgstRate = parseFloat(rateText); else if (subTotal > 0 && amount > 0) sgstRate = parseFloat(((amount / subTotal) * 100).toFixed(2));
        } else if (ledgerName?.includes('IGST')) {
            igstAmount = (igstAmount || 0) + amount;
            const rateText = ledgerEntry.querySelector('GSTCOMMONTAXDETAILS\\.LIST > GSTRATEDETAILS\\.LIST > GSTRATEVAL')?.textContent;
            if (rateText) igstRate = parseFloat(rateText); else if (subTotal > 0 && amount > 0) igstRate = parseFloat(((amount / subTotal) * 100).toFixed(2));
        }
    });
    
    if (totalAmount === 0 && subTotal > 0) { 
        totalAmount = subTotal + (cgstAmount || 0) + (sgstAmount || 0) + (igstAmount || 0);
    }
    if (subTotal === 0 && totalAmount > 0) {
        subTotal = totalAmount - (cgstAmount || 0) - (sgstAmount || 0) - (igstAmount || 0);
    }

    return {
        subTotal,
        totalAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        cgstRate,
        sgstRate,
        igstRate,
    };

  } catch (error) {
    console.error(`Error fetching invoice details for ${voucherNumber}:`, error);
    return null;
  }
}
