
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import type { Invoice, Customer, Company } from '@/types'; // Added Customer, Company
import { Printer, FilePlus2, Users } from 'lucide-react'; // Users for Start Over
import { format } from 'date-fns';

interface InvoiceDisplayProps {
  invoice: Invoice;
  customer: Customer; // Pass customer for display
  company: Company; // Pass company for context
  onCreateNewForSameCustomer: () => void; // New prop
  onStartOver: () => void; // New prop
}

export function InvoiceDisplay({ 
  invoice, 
  customer, 
  company, 
  onCreateNewForSameCustomer, 
  onStartOver 
}: InvoiceDisplayProps) {
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg print:shadow-none">
      <CardHeader className="bg-muted/50 p-4 rounded-t-lg print:bg-transparent">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-headline">Invoice</CardTitle>
            <CardDescription>
              Invoice No: <span className="font-semibold">{invoice.invoiceNumber}</span>
              <br className="print:hidden"/>
              <span className="text-xs text-muted-foreground print:hidden">
                For Company: {company.name}
              </span>
            </CardDescription>
          </div>
          <div className="text-right">
            <p>Date: {format(new Date(invoice.invoiceDate), "dd MMM, yyyy")}</p>
            {invoice.dueDate && <p>Due Date: {format(new Date(invoice.dueDate), "dd MMM, yyyy")}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Seller and Buyer Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-primary mb-1">From:</h3>
            <p className="font-bold">{company.name}</p>
            {/* Add more company details if available and needed */}
            <p>Local Tally Instance</p> 
            {/* <p>GSTIN: YOUR_COMPANY_GSTIN_HERE</p> */}
          </div>
          <div>
            <h3 className="font-semibold text-primary mb-1">To (Billed To):</h3>
            <p className="font-bold">{customer.name}</p>
            <p>{customer.addressLine1}</p>
            {customer.addressLine2 && <p>{customer.addressLine2}</p>}
            <p>{customer.city}{customer.city && customer.state && ", "}{customer.state}{customer.pincode && ` - ${customer.pincode}`}</p>
            {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
            {customer.email && <p>Email: {customer.email}</p>}
            {customer.phoneNumber && <p>Phone: {customer.phoneNumber}</p>}
          </div>
        </div>

        <Separator />

        {/* Invoice Items Table */}
        <div>
          <h3 className="text-lg font-semibold mb-2">Items:</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell>{item.hsnSac || '-'}</TableCell>
                  <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">₹{item.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{item.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Separator />

        {/* Totals Section */}
        <div className="flex justify-end">
          <div className="w-full md:w-2/5 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{invoice.subTotal.toFixed(2)}</span>
            </div>
            {invoice.cgstAmount !== undefined && invoice.sgstAmount !== undefined && (
              <>
                <div className="flex justify-between">
                  <span>CGST @ {invoice.cgstRate?.toFixed(2) || 'N/A'}%:</span>
                  <span>₹{invoice.cgstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST @ {invoice.sgstRate?.toFixed(2) || 'N/A'}%:</span>
                  <span>₹{invoice.sgstAmount.toFixed(2)}</span>
                </div>
              </>
            )}
            {invoice.igstAmount !== undefined && (
              <div className="flex justify-between">
                <span>IGST @ {invoice.igstRate?.toFixed(2) || 'N/A'}%:</span>
                <span>₹{invoice.igstAmount.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total Amount:</span>
              <span>₹{invoice.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <Separator />

        {/* Amount in Words */}
        <div>
          <p className="text-sm"><span className="font-semibold">Amount in Words:</span> {invoice.amountInWords}</p>
        </div>

        <Separator className="print:hidden" />
        
        {/* Terms and Conditions / Notes */}
        <div className="print:hidden">
          <h4 className="font-semibold mb-1">Terms & Conditions:</h4>
          <ul className="list-disc list-inside text-xs text-muted-foreground">
            <li>Payment due within 30 days.</li>
            <li>Interest @18% p.a. will be charged on overdue bills.</li>
            <li>Goods once sold will not be taken back.</li>
          </ul>
        </div>

      </CardContent>
      <CardFooter className="p-4 border-t flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 print:hidden">
        <Button variant="outline" onClick={onStartOver}>
          <Users className="mr-2 h-4 w-4" /> Start Over (New Customer/Company)
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={onCreateNewForSameCustomer}>
            <FilePlus2 className="mr-2 h-4 w-4" /> New Invoice (Same Customer)
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print Invoice
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

