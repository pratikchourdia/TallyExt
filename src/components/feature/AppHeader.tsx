import React from 'react';
import { FileSpreadsheet } from 'lucide-react'; // Tally-like icon

export function AppHeader() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet size={28} />
          <h1 className="text-xl md:text-2xl font-semibold font-headline">
            TallyPrime Auto Invoicer
          </h1>
        </div>
        {/* Placeholder for future elements like theme toggle or user profile */}
      </div>
    </header>
  );
}
