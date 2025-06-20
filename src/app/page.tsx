
"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Zap, Building, Loader2, AlertTriangle, RotateCw } from 'lucide-react';
import { getTallyCompanies } from '@/lib/tally-api';
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
  const [companyLoadError, setCompanyLoadError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCompaniesCallback = useCallback(async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) {
      setIsLoadingCompanies(true);
    }
    setCompanyLoadError(null);
    try {
      const fetchedCompanies = await getTallyCompanies();
      setCompanies(fetchedCompanies);
      if (fetchedCompanies.length === 0 && !companyLoadError) { // Only set error if not already set by a connection failure
        setCompanyLoadError("No companies found. Ensure Tally is running with a company loaded, or check Tally API configuration and XML response structure in tally-api.ts.");
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
      let errorMessage = "Could not fetch Tally companies.";
      if (error instanceof Error) {
          errorMessage = error.message; 
      }
      setCompanyLoadError(errorMessage);
      toast({
        title: "Error Fetching Companies",
        description: "Failed to connect or retrieve companies from Tally. See details below.",
        variant: "destructive",
      });
    } finally {
      if (showLoadingIndicator) {
        setIsLoadingCompanies(false);
      }
    }
  }, [toast, companyLoadError]);

  useEffect(() => {
    fetchCompaniesCallback();
  }, [fetchCompaniesCallback]);

  const handleCompanySelected = (companyId: string) => { 
    const company = companies.find(c => c.id === companyId); 
    if (company) {
      setSelectedCompany(company);
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
  };
  
  const handleCreateNewInvoiceForSameCustomer = () => {
    setCreatedInvoice(null); 
    setCurrentStep('CREATE_INVOICE'); 
  };

  const handleRetryConnection = () => {
    fetchCompaniesCallback(true); // Retry with loading indicator
  };

  const handleStartOver = () => {
    setSelectedCustomer(null);
    setCreatedInvoice(null);
    setSelectedCompany(null);
    setCompanyLoadError(null);
    setCurrentStep('SELECT_COMPANY'); 
    fetchCompaniesCallback(); // Re-fetch companies
  };


  const handleBackToCompanySelect = () => {
    setCurrentStep('SELECT_COMPANY');
    setSelectedCompany(null);
    setSelectedCustomer(null);
    setCreatedInvoice(null);
    setCompanyLoadError(null);
    fetchCompaniesCallback(); // Re-fetch companies as list might've changed or to retry connection
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
                  <p className="text-muted-foreground">Loading companies from Tally...</p>
                </div>
              ) : companyLoadError ? (
                 <div className="text-center text-destructive space-y-3 p-3 border border-destructive/50 rounded-md bg-destructive/10">
                    <div className="flex items-center justify-center text-destructive">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        <p className="font-semibold">Connection Error</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{companyLoadError}</p>
                    <Button onClick={handleRetryConnection} variant="destructive" size="sm">
                        <RotateCw className="mr-2 h-4 w-4" /> Retry Connection
                    </Button>
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
                <div className="text-center text-muted-foreground space-y-3 p-3 border rounded-md">
                  <p>
                    No Tally companies found or returned.
                  </p>
                  <ul className="text-xs list-disc list-inside text-left">
                    <li>Ensure Tally is running and a company is loaded.</li>
                    <li>Verify Tally's API/ODBC port is open (e.g., 9000) and accessible.</li>
                    <li>Check Tally.ini or Tally's configuration for remote access settings.</li>
                    <li>The XML structure for fetching companies in `tally-api.ts` might need adjustment for your Tally version.</li>
                  </ul>
                   <Button onClick={handleRetryConnection} variant="outline" size="sm">
                     <RotateCw className="mr-2 h-4 w-4" /> Refresh Company List
                    </Button>
                </div>
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
            <Button variant="link" onClick={handleBackToCompanySelect} className="mb-4 text-sm p-0 h-auto">
              &larr; Change Company
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
        if (!createdInvoice || !selectedCompany) { 
          setCurrentStep('SEARCH_CUSTOMER');
          return <p>Error: No invoice or company context. Redirecting...</p>;
        }
        return (
          <InvoiceDisplay 
            invoice={createdInvoice} 
            customer={selectedCustomer!} 
            company={selectedCompany}
            onCreateNewForSameCustomer={handleCreateNewInvoiceForSameCustomer}
            onStartOver={handleStartOver}
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
        {currentStep === 'SELECT_COMPANY' && !selectedCompany && !companyLoadError && (
           <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30 shadow-md">
            <CardContent className="p-6 flex items-center space-x-4">
              <Zap size={48} className="text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-primary font-headline">Welcome to TallyPrime Auto Invoicer!</h2>
                <p className="text-muted-foreground">
                  Connect to Tally: Select your Tally Company to begin creating invoices.
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
        © {new Date().getFullYear()} TallyPrime Auto Invoicer. Ensure Tally is running and accessible on port 9000.
      </footer>
    </div>
  );
}
