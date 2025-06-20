
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
4. Potential CORS issue: Tally might need to be configured to allow requests from this web application's origin, or a proxy might be needed.
Original error: ${error.message}`
        );
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


    if (companies.length === 0 && xmlDoc.documentElement.outerHTML.includes('<NOCONNECTION')) {
       throw new Error("Tally is not connected or no company is loaded. Please ensure Tally is running with a company open.");
    } else if (companies.length === 0) {
         console.warn("No companies found in Tally response, or XML structure not recognized.", xmlDoc.documentElement.outerHTML);
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
      group: getText('PARENT') === 'Sundry Debtors' ? 'Sundry Debtors' : 'Sundry Debtors', // Default or check parent
      addressLine1: addressLines[0] || '',
      addressLine2: addressLines[1] || '',
      city: addressLines[2] || '', // Assuming city is 3rd line, adjust if needed
      state: getText('STATENAME') || addressLines[3] || '', // Prefer STATENAME, fallback to address line
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
                  ${data.city ? `<ADDRESS>${data.city}</ADDRESS>` : ''}
                </ADDRESS.LIST>
                <MAILINGNAME>${data.name}</MAILINGNAME>
                <PARENT>Sundry Debtors</PARENT> {/* Ensure this group exists */}
                <COUNTRYNAME>India</COUNTRYNAME> {/* Or make dynamic */}
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

  // This GST calculation is a placeholder. Tally will typically calculate taxes based on its own rules
  // when items and ledgers are properly configured with tax classifications.
  // For robust integration, ensure your Stock Items, Sales Ledgers, and GST Ledgers are correctly set up in Tally.
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
  let cgstRatePercent = 0, sgstRatePercent = 0, igstRatePercent = 0;
  const totalAmount = subTotal; // Tally will add taxes
  
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
  
  // Remove manual tax ledger entries XML. Tally should calculate this.
  // Ensure Sales Ledger (salesLedgerName), CGST, SGST, IGST ledgers are correctly configured in Tally
  // with appropriate tax rates for automatic calculation.
  
  // Example of how you might include common tax ledgers if NOT relying on auto-calculation (less ideal):
  // This section is highly dependent on Tally setup and whether you want manual tax posting or automatic.
  // For automatic, ensure item masters and sales/purchase ledgers are configured for GST.
  /*
  let taxLedgerEntriesXml = '';
  if (customer.state.toLowerCase() === "maharashtra") { // Example: Intra-state
      taxLedgerEntriesXml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>CGST</LEDGERNAME> 
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(subTotal * 0.09).toFixed(2)}</AMOUNT> 
      </ALLLEDGERENTRIES.LIST>
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>SGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(subTotal * 0.09).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
      cgstAmount = subTotal * 0.09; sgstAmount = subTotal * 0.09;
      cgstRatePercent = 9; sgstRatePercent = 9;
  } else { // Example: Inter-state
       taxLedgerEntriesXml += `
      <ALLLEDGERENTRIES.LIST>
        <LEDGERNAME>IGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>${(subTotal * 0.18).toFixed(2)}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>`;
      igstAmount = subTotal * 0.18;
      igstRatePercent = 18;
  }
  const finalTotalAmount = subTotal + cgstAmount + sgstAmount + igstAmount;
  */
  // For relying on Tally's auto-calculation (preferred):
  const finalTotalAmount = subTotal; // Tally will add taxes if configured. The response will have final amount.


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
                  <AMOUNT>-${finalTotalAmount.toFixed(2)}</AMOUNT> {/* Party ledger is Dr. Amount will be updated by Tally with taxes */}
                </ALLLEDGERENTRIES.LIST>
                ${inventoryEntriesXml}
                {/* Tax ledgers (CGST, SGST, IGST) should be automatically applied by Tally if item/ledger masters are configured correctly.
                    If you need to explicitly add them, include their ALLLEDGERENTRIES.LIST here. 
                    However, it's best practice to let Tally calculate taxes. */}
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

    // Fetch the created voucher to get actual tax amounts and total if needed
    // This is an extra step but ensures data accuracy. For simplicity, we'll use calculated subtotal for now.
    // In a real scenario, you might want to query the voucher details back from Tally.
    const invoiceFromTally = await fetchInvoiceDetails(actualInvoiceNumber, companyName);


    const newInvoice: Invoice = {
      ...data,
      id: `tally_inv_${actualInvoiceNumber}_${Date.now()}`, 
      invoiceNumber: actualInvoiceNumber,
      customer,
      items: processedItems, // These are without tax breakdown per item from Tally
      subTotal: invoiceFromTally?.subTotal || subTotal,
      cgstRate: invoiceFromTally?.cgstRate,
      cgstAmount: invoiceFromTally?.cgstAmount,
      sgstRate: invoiceFromTally?.sgstRate,
      sgstAmount: invoiceFromTally?.sgstAmount,
      igstRate: invoiceFromTally?.igstRate,
      igstAmount: invoiceFromTally?.igstAmount,
      totalAmount: invoiceFromTally?.totalAmount || finalTotalAmount, // Use finalTotalAmount from Tally if fetched
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


// Helper function to fetch invoice details (e.g., after creation)
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

    const partyLedgerAmountText = voucherNode.querySelector('PARTYLEDGERNAME ~ AMOUNT, ALLLEDGERENTRIES\\.LIST LEDGERNAME:contains("' + voucherNode.querySelector('PARTYLEDGERNAME')?.textContent + '") ~ AMOUNT')?.textContent;
    if (partyLedgerAmountText) {
        totalAmount = Math.abs(parseFloat(partyLedgerAmountText));
    }
    
    // Calculate subTotal from inventory entries (sum of item amounts before tax)
    voucherNode.querySelectorAll('ALLINVENTORYENTRIES\\.LIST').forEach(itemNode => {
        const amountText = itemNode.querySelector('AMOUNT')?.textContent;
        if (amountText) {
            subTotal += parseFloat(amountText);
        }
    });


    // Extract tax details
    voucherNode.querySelectorAll('LEDGERENTRIES\\.LIST').forEach(ledgerEntry => {
        const ledgerName = ledgerEntry.querySelector('LEDGERNAME')?.textContent?.toUpperCase();
        const amountText = ledgerEntry.querySelector('AMOUNT')?.textContent;
        const amount = amountText ? parseFloat(amountText) : 0;

        if (ledgerName?.includes('CGST')) {
            cgstAmount = (cgstAmount || 0) + amount;
            // Attempt to get rate if available (might need UDFs or specific tax ledger setup in Tally)
            const rateText = ledgerEntry.querySelector('RATEOFGST')?.textContent; // Hypothetical tag
            if (rateText) cgstRate = parseFloat(rateText);
        } else if (ledgerName?.includes('SGST') || ledgerName?.includes('UTGST')) {
            sgstAmount = (sgstAmount || 0) + amount;
            const rateText = ledgerEntry.querySelector('RATEOFGST')?.textContent;
            if (rateText) sgstRate = parseFloat(rateText);
        } else if (ledgerName?.includes('IGST')) {
            igstAmount = (igstAmount || 0) + amount;
            const rateText = ledgerEntry.querySelector('RATEOFGST')?.textContent;
            if (rateText) igstRate = parseFloat(rateText);
        }
    });
    
    // If totalAmount wasn't directly on party ledger, sum from all ledgers or use computed value
    if (totalAmount === 0) { // Fallback if party ledger amount wasn't negative or parsed
        let calculatedTotal = 0;
         voucherNode.querySelectorAll('ALLLEDGERENTRIES\\.LIST AMOUNT, LEDGERENTRIES\\.LIST AMOUNT').forEach(amountNode => {
            const amountVal = parseFloat(amountNode.textContent || '0');
            // Heuristic: sum amounts that are not the main sales ledger amounts (which are negative)
            // This part is tricky without knowing the exact XML structure of debits/credits
            // A safer bet is to rely on Tally providing a grand total.
            // For now, we'll use what we have.
            if(amountVal > 0 && !voucherNode.querySelector('PARTYLEDGERNAME')?.textContent?.includes(amountNode.previousElementSibling?.textContent || '###')) {
                 calculatedTotal += amountVal;
            } else if (amountVal < 0 && voucherNode.querySelector('PARTYLEDGERNAME')?.textContent?.includes(amountNode.previousElementSibling?.textContent || '###')) {
                 calculatedTotal -= amountVal; // add the absolute value of party ledger
            }
        });
         totalAmount = calculatedTotal;
    }
     // If subTotal wasn't calculated from items (e.g., service invoice), it might be total - taxes
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
