
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
        throw new Error('Failed to connect to Tally. Ensure Tally is running and accessible at ' + TALLY_API_BASE_URL);
    }
    throw error;
  }
}

// --- Tally API Functions ---

export async function getTallyCompanies(): Promise<Company[]> {
  // IMPORTANT: This XML is a common way to request a list of loaded companies.
  // You may need to adjust it based on your Tally version.
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
    // Tally usually returns company names in <COMPANYNAME> or similar tags.
    // The exact structure can vary. This is a common pattern.
    // It might be nested under <COMPANYONDISK> or directly.
    const companyNameElements = xmlDoc.querySelectorAll('COMPANYNAME, NAME'); // Try common tags
    
    if (companyNameElements.length === 0 && xmlDoc.querySelector('COMPANY')) {
        // Fallback for structures like <COMPANY><NAME>...</NAME></COMPANY>
        xmlDoc.querySelectorAll('COMPANY').forEach(companyNode => {
            const nameNode = companyNode.querySelector('NAME');
            const idNode = companyNode.querySelector('ID'); // Or a path, depends on Tally version
            if (nameNode) {
                 companies.push({
                    // ID might be complex (path, internal ID). For selection, name is often sufficient.
                    // Using name as ID for simplicity here if no clear ID is available.
                    id: idNode?.textContent?.trim() || nameNode.textContent!.trim(), 
                    name: nameNode.textContent!.trim(),
                });
            }
        });
    } else {
        companyNameElements.forEach((node, index) => {
            const name = node.textContent?.trim();
            if (name) {
            // Tally doesn't always provide a simple "ID" for companies in this list.
            // Using the name as the ID for selection purposes.
            // Or, if Tally provides a specific ID or path, use that.
            companies.push({ id: name, name });
            }
        });
    }


    if (companies.length === 0) {
        console.warn("No companies found in Tally response, or XML structure not recognized.", xmlDoc.documentElement.outerHTML);
        // It's possible Tally is open but no company is loaded.
        // throw new Error("No companies returned from Tally. Ensure a company is loaded in Tally.");
    }
    return companies;
  } catch (error) {
    console.error('Error fetching Tally companies:', error);
    throw error; // Re-throw for UI to handle
  }
}

export async function findCustomerByName(name: string, companyName: string): Promise<Customer | null> {
  // IMPORTANT: Adjust XML and parsing based on your Tally version.
  // This fetches a Ledger.
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
              <FETCHLIST>NAME, ADDRESS, PINCODE, LEDGERPHONE, EMAIL, PARTYGSTIN, PARENT</FETCHLIST>
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

    const getName = (selector: string) => ledgerNode.querySelector(selector)?.textContent?.trim() || '';
    const getAddressPart = (partIndex: number) => {
        const addressNode = ledgerNode.querySelector(`ADDRESS //LINE[${partIndex}]`); // Simplified XPath-like
        return addressNode?.textContent?.trim() || '';
    };


    const customer: Customer = {
      id: getName('NAME'), // Using ledger name as ID
      name: getName('NAME'),
      ledgerName: getName('NAME'),
      group: 'Sundry Debtors', // Assuming, check PARENT if needed
      addressLine1: getName('ADDRESS')?.split('\\n')[0] || getName('ADDRESS'), // Tally often uses \n or multiple ADDRESS tags
      addressLine2: getName('ADDRESS')?.split('\\n')[1] || '',
      city: '', // Tally address format varies, might need more complex parsing
      state: '', // Often part of address or PlaceOfSupply
      pincode: getName('PINCODE'),
      email: getName('EMAIL'),
      phoneNumber: getName('LEDGERPHONE'),
      gstin: getName('PARTYGSTIN'),
      // 'creditAccount' is an app-level concept, map to Tally's sales ledger if needed during invoice.
      // For customer details, it's not directly stored on the customer ledger usually.
      creditAccount: '', // This field may not directly map from Tally ledger details
      companyId: companyName,
    };
    // More robust address parsing might be needed based on Tally output
    const addressLines = (ledgerNode.querySelector('ADDRESS')?.textContent?.trim() || '').split('\n');
    customer.addressLine1 = addressLines[0] || customer.name; // Default to name if no address
    if (addressLines.length > 1) customer.addressLine2 = addressLines[1];
    // City, State might need to be extracted from later lines or via UDFs/specific Tally config.


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
  // IMPORTANT: This XML is for creating a Ledger. Adjust tags as per your Tally.
  // Ensure the PARENT group 'Sundry Debtors' exists in your Tally.
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
                </ADDRESS.LIST>
                <MAILINGNAME>${data.name}</MAILINGNAME>
                <PARENT>Sundry Debtors</PARENT> {/* Ensure this group exists */}
                <COUNTRYNAME>India</COUNTRYNAME> {/* Or make dynamic */}
                <PINCODE>${data.pincode}</PINCODE>
                <LEDGERPHONE>${data.phoneNumber || ''}</LEDGERPHONE>
                <EMAIL>${data.email || ''}</EMAIL>
                <PARTYGSTIN>${data.gstin || ''}</PARTYGSTIN>
                <GSTREGISTRATIONTYPE>${data.gstin ? 'Regular' : 'Unregistered'}</GSTREGISTRATIONTYPE>
                <ISBILLWISEON>Yes</ISBILLWISEON>
                <OPENINGBALANCE>0</OPENINGBALANCE>
                <!-- Add other fields like Contact Person if supported directly or via UDF -->
              </LEDGER>
            </TALLYMESSAGE>
          </REQUESTDATA>
        </IMPORTDATA>
      </BODY>
    </ENVELOPE>`;

  try {
    const xmlDoc = await sendTallyRequest(requestXml);
    // Check Tally's response for success, usually like <CREATED>1</CREATED> or <ALTERED>1</ALTERED>
    const createdNode = xmlDoc.querySelector('CREATED, ALTERED');
    if (!createdNode || createdNode.textContent !== '1') {
      const errors = Array.from(xmlDoc.querySelectorAll('LINEERROR, ERROR')).map(e => e.textContent).join(', ');
      throw new Error('Tally failed to create customer. ' + (errors || 'No details provided.'));
    }

    // Tally usually doesn't return the full created object here.
    // We return the object we attempted to create, assuming success.
    // Tally assigns its own internal ID (GUID). For simplicity, we use the name as ID here.
    const newCustomer: Customer = {
      ...data,
      id: data.name, // Tally's internal ID is different, this is for app reference
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
  // IMPORTANT: This is a complex XML for a Sales Voucher. It WILL require adjustments.
  // Ensure tax ledgers (CGST, SGST, IGST) and sales/income ledgers exist in your Tally.
  // The 'creditAccount' from CustomerForm maps to the Sales Ledger here.
  
  const salesLedgerName = customer.creditAccount || 'Sales'; // Default if not set, ensure 'Sales' ledger exists

  let subTotal = 0;
  const processedItems: InvoiceItem[] = data.items.map((item, index) => {
    const amount = item.quantity * item.rate;
    subTotal += amount;
    return { ...item, id: `item_${Date.now()}_${index}`, amount };
  });

  // Simplified GST calculation logic (assumes fixed rates, adapt as needed)
  // This logic needs to align with your Tally's tax setup.
  const supplierState = "MH"; // Assume supplier state, make this dynamic if needed
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
  const gstRate = 0.18; // Example 18% GST
  let cgstRatePercent = 0, sgstRatePercent = 0, igstRatePercent = 0;

  const isInterState = customer.state && customer.state.toUpperCase() !== supplierState.toUpperCase();

  if (isInterState) {
    igstRatePercent = gstRate * 100;
    igstAmount = subTotal * gstRate;
  } else {
    cgstRatePercent = (gstRate / 2) * 100;
    sgstRatePercent = (gstRate / 2) * 100;
    cgstAmount = subTotal * (gstRate / 2);
    sgstAmount = subTotal * (gstRate / 2);
  }
  const totalAmount = subTotal + cgstAmount + sgstAmount + igstAmount;
  const today = new Date(data.invoiceDate);
  const formattedDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;


  // Placeholder for voucher number - Tally will assign this if auto-numbering is on.
  // If you use manual numbering, you'd provide it.
  const voucherNumber = `API-${Date.now()}`; 

  let inventoryEntriesXml = '';
  processedItems.forEach(item => {
    inventoryEntriesXml += `
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${item.itemName}</STOCKITEMNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
        <ISAUTONEGATE>No</ISAUTONEGATE>
        <ISCUSTOMSCLEARANCE>No</ISCUSTOMSCLEARANCE>
        <ISCOSTTRACKING>No</ISCOSTTRACKING>
        <ISBATCHWISEON>No</ISBATCHWISEON> <!-- Adjust if using batches -->
        <ISORDERLINESTATUS>No</ISORDERLINESTATUS>
        <ISSCRAP>No</ISSCRAP>
        <RATE>${item.rate.toFixed(2)}/${item.unit}</RATE>
        <AMOUNT>${item.amount.toFixed(2)}</AMOUNT>
        <ACTUALQTY>${item.quantity} ${item.unit}</ACTUALQTY>
        <BILLEDQTY>${item.quantity} ${item.unit}</BILLEDQTY>
        <ACCOUNTINGALLOCATIONS.LIST>
          <LEDGERNAME>${salesLedgerName}</LEDGERNAME> <!-- Sales Ledger -->
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${item.amount.toFixed(2)}</AMOUNT>
        </ACCOUNTINGALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>`;
  });
  
  let taxLedgerEntriesXml = '';
  if (cgstAmount > 0) {
    taxLedgerEntriesXml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>CGST</LEDGERNAME> {/* Ensure 'CGST' ledger exists and is configured */}
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${cgstAmount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
  }
  if (sgstAmount > 0) {
    taxLedgerEntriesXml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>SGST</LEDGERNAME> {/* Ensure 'SGST' ledger exists */}
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${sgstAmount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
  }
  if (igstAmount > 0) {
    taxLedgerEntriesXml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>IGST</LEDGERNAME> {/* Ensure 'IGST' ledger exists */}
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${igstAmount.toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
  }


  const requestXml = `
    <ENVELOPE>
      <HEADER>
        <TALLYREQUEST>Import Data</TALLYREQUEST>
      </HEADER>
      <BODY>
        <IMPORTDATA>
          <REQUESTDESC>
            <REPORTNAME>All Masters</REPORTNAME> {/* Vouchers are also often imported via 'All Masters' or 'Vouchers' */}
            <STATICVARIABLES>
              <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
            </STATICVARIABLES>
          </REQUESTDESC>
          <REQUESTDATA>
            <TALLYMESSAGE xmlns:UDF="TallyUDF">
              <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
                <DATE>${formattedDate}</DATE>
                <GUID>api-guid-${Date.now()}</GUID> {/* Tally will generate its own GUID */}
                <NARRATION>Sales Invoice created via API for ${customer.name}</NARRATION>
                <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER> {/* Tally might override if auto numbering */}
                <PARTYLEDGERNAME>${customer.name}</PARTYLEDGERNAME>
                <CSTFORMISSUETYPE/>
                <CSTFORMRECVTYPE/>
                <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
                <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
                <PLACEOFSUPPLY>${customer.state}</PLACEOFSUPPLY> {/* Important for GST */}
                <CONSIGNEEGSTIN>${customer.gstin || ''}</CONSIGNEEGSTIN>
                <CONSIGNEEMAILINGNAME>${customer.name}</CONSIGNEEMAILINGNAME>
                <CONSIGNEESTATE>${customer.state}</CONSIGNEESTATE>
                <ALLLEDGERENTRIES.LIST>
                  <LEDGERNAME>${customer.name}</LEDGERNAME>
                  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                  <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT> {/* Party ledger is Dr. */}
                </ALLLEDGERENTRIES.LIST>
                ${inventoryEntriesXml}
                ${taxLedgerEntriesXml}
                <VCHLEDTOTALTREE.LIST></VCHLEDTOTALTREE.LIST>
                <PAYROLLMODIFIED>No</PAYROLLMODIFIED>
                <AUDITED>No</AUDITED>
                <FORJOBCOSTING>No</FORJOBCOSTING>
                <ISOPTIONAL>No</ISOPTIONAL>
                <EFFECTIVEDATE>${formattedDate}</EFFECTIVEDATE>
                <USEFORINTEREST>No</USEFORINTEREST>
                <USEFORGAINLOSS>No</USEFORGAINLOSS>
                <USEFORGODOWNTRANSFER>No</USEFORGODOWNTRANSFER>
                <USEFORCOMPOUND>No</USEFORCOMPOUND>
                <ALTERID>api-alterid-${Date.now()}</ALTERID>
                <ISCANCELLED>No</ISCANCELLED>
                <HASCASHFLOW>No</HASCASHFLOW>
                <ISPOSTDATED>No</ISPOSTDATED>
                <ISINVOICE>Yes</ISINVOICE>
                <ISDELETED>No</ISDELETED>
                <ASORIGINAL>Yes</ASORIGINAL>
              </VOUCHER>
            </TALLYMESSAGE>
          </REQUESTDATA>
        </IMPORTDATA>
      </BODY>
    </ENVELOPE}`;

  try {
    const xmlDoc = await sendTallyRequest(requestXml);
    const createdNode = xmlDoc.querySelector('CREATED, ALTERED'); // Tally might also use VOUCHERNUMBER in response
    const newVchNoNode = xmlDoc.querySelector('VOUCHERNUMBER'); // Check if Tally returns the actual number

    if (!createdNode || createdNode.textContent !== '1') {
       const errors = Array.from(xmlDoc.querySelectorAll('LINEERROR, ERROR')).map(e => e.textContent).join(', ');
      throw new Error('Tally failed to generate invoice. ' + (errors || 'No details provided.'));
    }
    
    const actualInvoiceNumber = newVchNoNode?.textContent?.trim() || voucherNumber;

    const newInvoice: Invoice = {
      ...data,
      id: `tally_inv_${actualInvoiceNumber}_${Date.now()}`, // App-level ID
      invoiceNumber: actualInvoiceNumber,
      customer,
      items: processedItems,
      subTotal,
      cgstRate: isInterState ? undefined : cgstRatePercent,
      cgstAmount: isInterState ? undefined : cgstAmount,
      sgstRate: isInterState ? undefined : sgstRatePercent,
      sgstAmount: isInterState ? undefined : sgstAmount,
      igstRate: isInterState ? igstRatePercent : undefined,
      igstAmount: isInterState ? igstAmount : undefined,
      totalAmount,
      amountInWords: numberToWords(totalAmount),
      voucherType: 'Sales',
      companyId: companyName,
    };
    return newInvoice;
  } catch (error) {
    console.error(`Error generating invoice in Tally for customer "${customer.name}":`, error);
    throw error;
  }
}

