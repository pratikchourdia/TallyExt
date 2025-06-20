"use client";

import React, { useState } from 'react';
import { AppHeader } from '@/components/feature/AppHeader';
import { CustomerSearch } from '@/components/feature/CustomerSearch';
import { CustomerForm } from '@/components/feature/CustomerForm';
import { InvoiceForm } from '@/components/feature/InvoiceForm';
import { InvoiceDisplay } from '@/components/feature/InvoiceDisplay';
import type { Customer, Invoice } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Zap } from 'lucide-react'; // Zap icon for a quick start feel

type Step = 'SEARCH_CUSTOMER' | 'CREATE_CUSTOMER' | 'CREATE_INVOICE' | 'VIEW_INVOICE';

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<Step>('SEARCH_CUSTOMER');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState<string>('');

  const handleCustomerFound = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCurrentStep('CREATE_INVOICE');
  };

  const handleCustomerNotFound = (searchTerm: string) => {
    setCustomerSearchTerm(searchTerm);
    setCurrentStep('CREATE_CUSTOMER');
  };

  const handleAddNewCustomer = () => {
    setCustomerSearchTerm(''); // Clear any previous search term
    setCurrentStep('CREATE_CUSTOMER');
  };
  
  const handleCustomerCreated = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCurrentStep('CREATE_INVOICE');
  };

  const handleCancelCustomerCreation = () => {
    setCurrentStep('SEARCH_CUSTOMER');
  };

  const handleInvoiceGenerated = (invoice: Invoice) => {
    setCreatedInvoice(invoice);
    setCurrentStep('VIEW_INVOICE');
  };

  const handleCancelInvoiceCreation = () => {
    // Option to go back to customer search or re-select customer if flow allows
    setCurrentStep('SEARCH_CUSTOMER'); 
    setSelectedCustomer(null); // Clear selected customer
  };
  
  const handleCreateNewInvoice = () => {
    setSelectedCustomer(null);
    setCreatedInvoice(null);
    setCurrentStep('SEARCH_CUSTOMER');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'SEARCH_CUSTOMER':
        return (
          <CustomerSearch 
            onCustomerFound={handleCustomerFound} 
            onCustomerNotFound={handleCustomerNotFound}
            onAddNewCustomer={handleAddNewCustomer}
          />
        );
      case 'CREATE_CUSTOMER':
        return (
          <CustomerForm 
            initialSearchTerm={customerSearchTerm}
            onSubmitSuccess={handleCustomerCreated} 
            onCancel={handleCancelCustomerCreation}
          />
        );
      case 'CREATE_INVOICE':
        if (!selectedCustomer) {
          // Should not happen if logic is correct, but as a fallback:
          setCurrentStep('SEARCH_CUSTOMER');
          return <p>Error: No customer selected. Redirecting to search...</p>;
        }
        return (
          <InvoiceForm 
            customer={selectedCustomer} 
            onSubmitSuccess={handleInvoiceGenerated}
            onCancel={handleCancelInvoiceCreation}
          />
        );
      case 'VIEW_INVOICE':
        if (!createdInvoice) {
           // Fallback
          setCurrentStep('SEARCH_CUSTOMER');
          return <p>Error: No invoice to display. Redirecting...</p>;
        }
        return (
          <InvoiceDisplay 
            invoice={createdInvoice} 
            onCreateNew={handleCreateNewInvoice}
          />
        );
      default:
        return <p>Unknown step</p>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8 md:px-8 md:py-12">
        {/* Welcome message on the first step */}
        {currentStep === 'SEARCH_CUSTOMER' && (
           <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 shadow-md">
            <CardContent className="p-6 flex items-center space-x-4">
              <Zap size={48} className="text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-primary font-headline">Welcome to Auto Invoicer!</h2>
                <p className="text-muted-foreground">
                  Quickly generate TallyPrime invoices. Start by searching for a customer or creating a new one.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {renderStepContent()}
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} TallyPrime Auto Invoicer. For demonstration purposes.
      </footer>
    </div>
  );
}
