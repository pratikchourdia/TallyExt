
"use client";

import React, { useState, useEffect } from 'react';
import { AppHeader } from '@/components/feature/AppHeader';
import { CustomerSearch } from '@/components/feature/CustomerSearch';
import { CustomerForm } from '@/components/feature/CustomerForm';
import { InvoiceForm } from '@/components/feature/InvoiceForm';
import { InvoiceDisplay } from '@/components/feature/InvoiceDisplay';
import type { Customer, Invoice, Company } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Zap, Building, Loader2 } from 'lucide-react';
import { getTallyCompanies } from '@/lib/tally-api'; // Import the new function
import { useToast } from '@/hooks/use-toast';


type Step = 'SELECT_COMPANY' | 'SEARCH_CUSTOMER' | 'CREATE_CUSTOMER' | 'CREATE_INVOICE' | 'VIEW_INVOICE';

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<Step>('SELECT_COMPANY');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchCompanies() {
      setIsLoadingCompanies(true);
      try {
        const fetchedCompanies = await getTallyCompanies();
        setCompanies(fetchedCompanies);
        if (fetchedCompanies.length === 1) {
          // Auto-select if only one company
          // setSelectedCompany(fetchedCompanies[0]);
          // setCurrentStep('SEARCH_CUSTOMER'); 
        }
      } catch (error) {
        console.error("Error fetching companies:", error);
        toast({
          title: "Error",
          description: "Could not fetch Tally companies. Please ensure Tally is running and accessible.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingCompanies(false);
      }
    }
    fetchCompanies();
  }, [toast]);

  const handleCompanySelected = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      // Reset subsequent selections
      setSelectedCustomer(null);
      setCreatedInvoice(null);
      setCurrentStep('SEARCH_CUSTOMER');
    }
  };

  const handleCustomerFound = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCurrentStep('CREATE_INVOICE');
  };

  const handleCustomerNotFound = (searchTerm: string) => {
    setCustomerSearchTerm(searchTerm);
    setCurrentStep('CREATE_CUSTOMER');
  };

  const handleAddNewCustomer = () => {
    setCustomerSearchTerm('');
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
    setCurrentStep('SEARCH_CUSTOMER'); 
    setSelectedCustomer(null);
  };
  
  const handleCreateNewInvoice = () => {
    setSelectedCustomer(null);
    setCreatedInvoice(null);
    setCurrentStep('SELECT_COMPANY'); // Go back to company selection
    setSelectedCompany(null);
  };

  const handleBackToCompanySelect = () => {
    setCurrentStep('SELECT_COMPANY');
    setSelectedCompany(null);
    setSelectedCustomer(null);
    setCreatedInvoice(null);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'SELECT_COMPANY':
        return (
          <Card className="w-full max-w-md mx-auto shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-headline text-center flex items-center justify-center">
                <Building className="mr-2 h-6 w-6 text-primary" /> Select Tally Company
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {isLoadingCompanies ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-muted-foreground">Loading companies...</p>
                </div>
              ) : companies.length > 0 ? (
                <>
                  <Label htmlFor="company-select">Choose a company to work with:</Label>
                  <Select onValueChange={handleCompanySelected} defaultValue={selectedCompany?.id}>
                    <SelectTrigger id="company-select" aria-label="Select Tally Company">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <p className="text-center text-destructive">
                  No Tally companies found or unable to connect. Please ensure Tally is running and accessible.
                </p>
              )}
            </CardContent>
          </Card>
        );
      case 'SEARCH_CUSTOMER':
        if (!selectedCompany) {
            setCurrentStep('SELECT_COMPANY'); return null;
        }
        return (
          <>
            <Button variant="outline" onClick={handleBackToCompanySelect} className="mb-4">
              Change Company
            </Button>
            <CustomerSearch 
              onCustomerFound={handleCustomerFound} 
              onCustomerNotFound={handleCustomerNotFound}
              onAddNewCustomer={handleAddNewCustomer}
              selectedCompany={selectedCompany}
            />
          </>
        );
      case 'CREATE_CUSTOMER':
        if (!selectedCompany) {
            setCurrentStep('SELECT_COMPANY'); return null;
        }
        return (
          <CustomerForm 
            initialSearchTerm={customerSearchTerm}
            onSubmitSuccess={handleCustomerCreated} 
            onCancel={handleCancelCustomerCreation}
            selectedCompany={selectedCompany}
          />
        );
      case 'CREATE_INVOICE':
        if (!selectedCustomer || !selectedCompany) {
          setCurrentStep('SEARCH_CUSTOMER');
          return <p>Error: No customer or company selected. Redirecting...</p>;
        }
        return (
          <InvoiceForm 
            customer={selectedCustomer} 
            onSubmitSuccess={handleInvoiceGenerated}
            onCancel={handleCancelInvoiceCreation}
            selectedCompany={selectedCompany}
          />
        );
      case 'VIEW_INVOICE':
        if (!createdInvoice) {
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
        {currentStep === 'SELECT_COMPANY' && (
           <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 shadow-md">
            <CardContent className="p-6 flex items-center space-x-4">
              <Zap size={48} className="text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-primary font-headline">Welcome to Auto Invoicer!</h2>
                <p className="text-muted-foreground">
                  Please select your Tally Company to begin creating invoices.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {selectedCompany && currentStep !== 'SELECT_COMPANY' && (
          <div className="mb-6 p-3 bg-muted/50 rounded-md border text-sm text-muted-foreground">
            Working with Company: <span className="font-semibold text-primary">{selectedCompany.name}</span>
          </div>
        )}
        {renderStepContent()}
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} TallyPrime Auto Invoicer. For demonstration purposes.
      </footer>
    </div>
  );
}
