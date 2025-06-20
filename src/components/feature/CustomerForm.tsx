"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { MOCK_CREDIT_ACCOUNTS, MOCK_STATES, type Customer } from '@/types';
import { Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const customerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  contactPerson: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  addressLine1: z.string().min(3, { message: "Address Line 1 is required." }),
  addressLine2: z.string().optional(),
  city: z.string().min(2, { message: "City is required." }),
  state: z.string().min(1, { message: "State is required." }),
  pincode: z.string().regex(/^\d{6}$/, { message: "Pincode must be 6 digits." }),
  gstin: z.string().optional().refine(val => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(val), { message: "Invalid GSTIN format." }),
  creditAccount: z.string().min(1, { message: "Credit Account is required." }),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  initialSearchTerm?: string;
  onSubmitSuccess: (customer: Customer) => void;
  onCancel: () => void;
}

// Mock function, replace with actual API call
import { createNewCustomer as apiCreateNewCustomer } from '@/lib/tally-api';

export function CustomerForm({ initialSearchTerm = '', onSubmitSuccess, onCancel }: CustomerFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: initialSearchTerm,
      contactPerson: '',
      phoneNumber: '',
      email: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pincode: '',
      gstin: '',
      creditAccount: '',
    },
  });

  const { control, handleSubmit, formState: { errors } } = form;

  const processSubmit = async (data: CustomerFormData) => {
    setIsLoading(true);
    try {
      const newCustomerData = {
        name: data.name,
        contactPerson: data.contactPerson,
        phoneNumber: data.phoneNumber,
        email: data.email,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        gstin: data.gstin,
        creditAccount: data.creditAccount,
      };
      // Explicitly typecast data to satisfy Omit<Customer, 'id' | 'ledgerName' | 'group'>
      const createdCustomer = await apiCreateNewCustomer(newCustomerData as Omit<Customer, 'id' | 'ledgerName' | 'group'> & {name: string});
      toast({
        title: "Customer Created",
        description: `${createdCustomer.name} has been successfully created.`,
      });
      onSubmitSuccess(createdCustomer);
    } catch (error) {
      console.error("Error creating customer:", error);
      toast({
        title: "Creation Error",
        description: "Could not create customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-center">Create New Customer</CardTitle>
        <CardDescription className="text-center">
          Fill in the details for the new customer. Fields marked with * are required.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(processSubmit)}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Customer Name*</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => <Input id="name" {...field} aria-invalid={!!errors.name} />}
              />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="creditAccount">Credit Account* (Ledger)</Label>
              <Controller
                name="creditAccount"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value} aria-invalid={!!errors.creditAccount}>
                    <SelectTrigger id="creditAccount">
                      <SelectValue placeholder="Select Credit Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_CREDIT_ACCOUNTS.map(acc => (
                        <SelectItem key={acc.value} value={acc.value}>{acc.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.creditAccount && <p className="text-sm text-destructive mt-1">{errors.creditAccount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Controller
                name="contactPerson"
                control={control}
                render={({ field }) => <Input id="contactPerson" {...field} />}
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Controller
                name="phoneNumber"
                control={control}
                render={({ field }) => <Input id="phoneNumber" {...field} />}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Controller
                name="email"
                control={control}
                render={({ field }) => <Input id="email" type="email" {...field} aria-invalid={!!errors.email} />}
              />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
          </div>

          <h3 className="text-lg font-medium pt-2 border-t mt-4">Mailing Address</h3>
          <div>
            <Label htmlFor="addressLine1">Address Line 1*</Label>
            <Controller
              name="addressLine1"
              control={control}
              render={({ field }) => <Input id="addressLine1" {...field} aria-invalid={!!errors.addressLine1} />}
            />
            {errors.addressLine1 && <p className="text-sm text-destructive mt-1">{errors.addressLine1.message}</p>}
          </div>
          <div>
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Controller
              name="addressLine2"
              control={control}
              render={({ field }) => <Input id="addressLine2" {...field} />}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City*</Label>
              <Controller
                name="city"
                control={control}
                render={({ field }) => <Input id="city" {...field} aria-invalid={!!errors.city} />}
              />
              {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <Label htmlFor="state">State*</Label>
               <Controller
                name="state"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value} aria-invalid={!!errors.state}>
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_STATES.map(st => (
                        <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.state && <p className="text-sm text-destructive mt-1">{errors.state.message}</p>}
            </div>
            <div>
              <Label htmlFor="pincode">Pincode*</Label>
              <Controller
                name="pincode"
                control={control}
                render={({ field }) => <Input id="pincode" {...field} aria-invalid={!!errors.pincode} />}
              />
              {errors.pincode && <p className="text-sm text-destructive mt-1">{errors.pincode.message}</p>}
            </div>
          </div>
          
          <div>
            <Label htmlFor="gstin">GSTIN</Label>
            <Controller
              name="gstin"
              control={control}
              render={({ field }) => <Input id="gstin" {...field} placeholder="e.g., 27ABCDE1234F1Z5" aria-invalid={!!errors.gstin} />}
            />
            {errors.gstin && <p className="text-sm text-destructive mt-1">{errors.gstin.message}</p>}
          </div>
          
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Create Customer
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
