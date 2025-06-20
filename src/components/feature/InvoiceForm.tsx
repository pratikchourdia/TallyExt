
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Customer, Invoice, InvoiceItem, MOCK_UNITS, Company } from '@/types';
import { generateNewInvoice as apiGenerateNewInvoice } from '@/lib/tally-api';
import { Loader2, PlusCircle, Trash2, FileText, ArrowLeft, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

const invoiceItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  hsnSac: z.string().optional(),
  quantity: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(0.01, "Quantity must be positive")
  ),
  unit: z.string().min(1, "Unit is required"),
  rate: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().min(0, "Rate must be non-negative")
  ),
});

const invoiceSchema = z.object({
  invoiceDate: z.date({ required_error: "Invoice date is required." }),
  dueDate: z.date().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required."),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  customer: Customer;
  onSubmitSuccess: (invoice: Invoice) => void;
  onCancel: () => void;
  selectedCompany: Company; // Added selectedCompany prop
}

export function InvoiceForm({ customer, onSubmitSuccess, onCancel, selectedCompany }: InvoiceFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoiceDate: new Date(),
      items: [{ itemName: '', quantity: 1, unit: MOCK_UNITS[0].value, rate: 0 }],
    },
  });

  const { control, handleSubmit, watch, setValue, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watchedItems = watch("items");

  const calculateTotals = () => {
    let subTotal = 0;
    watchedItems.forEach(item => {
      subTotal += (item.quantity || 0) * (item.rate || 0);
    });
    return { subTotal };
  };

  const { subTotal } = calculateTotals();

  const processSubmit = async (data: InvoiceFormData) => {
    setIsLoading(true);
    if (!selectedCompany) {
      toast({
        title: "Error",
        description: "No company selected. Cannot generate invoice.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    try {
      const invoiceData = {
        invoiceDate: format(data.invoiceDate, "yyyy-MM-dd"),
        dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd") : undefined,
        items: data.items.map(item => ({
          itemName: item.itemName,
          hsnSac: item.hsnSac,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
        })),
      };
      // Pass selectedCompany.id to the API call
      const generatedInvoice = await apiGenerateNewInvoice(invoiceData, customer, selectedCompany.id);
      toast({
        title: "Invoice Generated",
        description: `Invoice ${generatedInvoice.invoiceNumber} created for ${customer.name} in ${selectedCompany.name}.`,
      });
      onSubmitSuccess(generatedInvoice);
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast({
        title: "Generation Error",
        description: "Could not generate invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-headline text-center">Create New Invoice</CardTitle>
        <CardDescription className="text-center">
          For customer: <span className="font-semibold">{customer.name}</span> ({customer.gstin || 'GSTIN Not Available'})
          <br/>
          In company: <span className="font-semibold">{selectedCompany.name}</span>
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(processSubmit)}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="invoiceDate">Invoice Date*</Label>
              <Controller
                name="invoiceDate"
                control={control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.invoiceDate && <p className="text-sm text-destructive mt-1">{errors.invoiceDate.message}</p>}
            </div>
            <div>
              <Label htmlFor="dueDate">Due Date</Label>
              <Controller
                name="dueDate"
                control={control}
                render={({ field }) => (
                   <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
          </div>

          <h3 className="text-lg font-medium pt-2 border-t mt-4">Invoice Items</h3>
          {errors.items && typeof errors.items === 'object' && !Array.isArray(errors.items) && (
             <p className="text-sm text-destructive mt-1">{errors.items.message}</p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Item Name*</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead className="w-[100px]">Qty*</TableHead>
                <TableHead className="w-[120px]">Unit*</TableHead>
                <TableHead className="w-[120px]">Rate*</TableHead>
                <TableHead className="text-right w-[120px]">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Controller
                      name={`items.${index}.itemName`}
                      control={control}
                      render={({ field: controllerField }) => <Input {...controllerField} placeholder="Item description" />}
                    />
                    {errors.items?.[index]?.itemName && <p className="text-xs text-destructive mt-1">{errors.items[index]?.itemName?.message}</p>}
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`items.${index}.hsnSac`}
                      control={control}
                      render={({ field: controllerField }) => <Input {...controllerField} placeholder="HSN/SAC" />}
                    />
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`items.${index}.quantity`}
                      control={control}
                      render={({ field: controllerField }) => <Input type="number" step="0.01" {...controllerField} placeholder="0.00" />}
                    />
                     {errors.items?.[index]?.quantity && <p className="text-xs text-destructive mt-1">{errors.items[index]?.quantity?.message}</p>}
                  </TableCell>
                   <TableCell>
                    <Controller
                      name={`items.${index}.unit`}
                      control={control}
                      render={({ field: controllerField }) => (
                        <Select onValueChange={controllerField.onChange} defaultValue={controllerField.value}>
                          <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                          <SelectContent>
                            {MOCK_UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.items?.[index]?.unit && <p className="text-xs text-destructive mt-1">{errors.items[index]?.unit?.message}</p>}
                  </TableCell>
                  <TableCell>
                    <Controller
                      name={`items.${index}.rate`}
                      control={control}
                      render={({ field: controllerField }) => <Input type="number" step="0.01" {...controllerField} placeholder="0.00" />}
                    />
                    {errors.items?.[index]?.rate && <p className="text-xs text-destructive mt-1">{errors.items[index]?.rate?.message}</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    {((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.rate || 0)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ itemName: '', quantity: 1, unit: MOCK_UNITS[0].value, rate: 0 })}
            className="mt-2"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Item
          </Button>

          <div className="flex justify-end mt-4">
            <div className="w-full md:w-1/3 space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Subtotal:</span>
                <span>₹{subTotal.toFixed(2)}</span>
              </div>
              {/* Basic Tax display - can be expanded */}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Grand Total:</span>
                <span>₹{subTotal.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground text-right"> (Taxes will be calculated upon generation based on GST rules)</p>
            </div>
          </div>

        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !selectedCompany}>
            {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            Generate Invoice
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
