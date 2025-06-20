"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import type { Customer } from '@/types';
import { findCustomerByName } from '@/lib/tally-api';
import { useToast } from '@/hooks/use-toast';

interface CustomerSearchProps {
  onCustomerFound: (customer: Customer) => void;
  onCustomerNotFound: (searchTerm: string) => void;
  onAddNewCustomer: () => void;
}

export function CustomerSearch({ onCustomerFound, onCustomerNotFound, onAddNewCustomer }: CustomerSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Search Term Required",
        description: "Please enter a customer name to search.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      const customer = await findCustomerByName(searchTerm);
      if (customer) {
        onCustomerFound(customer);
      } else {
        onCustomerNotFound(searchTerm);
      }
    } catch (error) {
      console.error("Error searching customer:", error);
      toast({
        title: "Search Error",
        description: "Could not perform customer search. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-center">Find or Create Customer</CardTitle>
        <CardDescription className="text-center">
          Search for an existing customer or create a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Enter Customer Name or ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-grow"
            aria-label="Customer Name or ID"
          />
          <Button onClick={handleSearch} disabled={isLoading} aria-label="Search Customer">
            {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4">
         <p className="text-sm text-muted-foreground">Or</p>
        <Button variant="outline" onClick={onAddNewCustomer} disabled={isLoading} className="w-full sm:w-auto">
          <UserPlus className="mr-2 h-4 w-4" /> Create New Customer
        </Button>
      </CardFooter>
    </Card>
  );
}
