'use client';

import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export interface ShareClass {
  id: number;
  name: string;
  seniority: number;
  liquidationPref: number;
  prefType: "non-participating" | "participating";
  cap: number | null;
}

export interface Transaction {
  id: number;
  shareClassId: number;
  shares: number;
  investment: number;
}

export default function WaterfallAnalysisNew() {
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([
    { id: 1, name: "Series A", seniority: 1, liquidationPref: 1, prefType: "non-participating", cap: null },
    { id: 2, name: "Series B", seniority: 2, liquidationPref: 1.5, prefType: "participating", cap: 3 }
  ]);

  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 1, shareClassId: 1, shares: 1000000, investment: 1000000 },
    { id: 2, shareClassId: 2, shares: 500000, investment: 2000000 }
  ]);

  const [exitAmount, setExitAmount] = useState<number>(10000000);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  const updateTransaction = (id: number, field: keyof Transaction, value: number | string): void => {
    setTransactions(prevTransactions => 
      prevTransactions.map(tx => 
        tx.id === id ? { ...tx, [field]: value } : tx
      )
    );
  };

  const deleteTransaction = (id: number): void => {
    setTransactions(prevTransactions => 
      prevTransactions.filter(tx => tx.id !== id)
    );
  };

  const addShareClass = (): void => {
    const newId = Math.max(...shareClasses.map(sc => sc.id)) + 1;
    setShareClasses([...shareClasses, {
      id: newId,
      name: `Series ${String.fromCharCode(65 + shareClasses.length)}`,
      seniority: shareClasses.length + 1,
      liquidationPref: 1,
      prefType: "non-participating",
      cap: null
    }]);
  };

  const renderTransactionsTable = () => (
    <table className="w-full min-w-[800px]">
      <thead>
        <tr className="bg-gray-50">
          <th className="text-left p-3 text-gray-600 font-medium w-[40%]">Share Class</th>
          <th className="text-left p-3 text-gray-600 font-medium w-[25%]">Shares</th>
          <th className="text-left p-3 text-gray-600 font-medium w-[25%]">Investment</th>
          <th className="text-left p-3 text-gray-600 font-medium w-[10%]">Actions</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.id}>
            <td className="p-3">
              <select
                value={tx.shareClassId}
                onChange={(e) => updateTransaction(tx.id, 'shareClassId', parseInt(e.target.value))}
                className="w-full"
              >
                {shareClasses.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </td>
            <td className="p-3">
              <Input
                type="text"
                value={formatNumber(tx.shares)}
                onChange={(e) => updateTransaction(tx.id, 'shares', parseFloat(e.target.value.replace(/[^0-9]/g, '')))}
              />
            </td>
            <td className="p-3">
              <Input
                type="text"
                value={formatNumber(tx.investment)}
                onChange={(e) => updateTransaction(tx.id, 'investment', parseFloat(e.target.value.replace(/[^0-9]/g, '')))}
              />
            </td>
            <td className="p-3">
              <Button variant="destructive" onClick={() => deleteTransaction(tx.id)}>Delete</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="p-4 space-y-6 max-w-[1920px] mx-auto">
      <h1 className="text-3xl font-bold">Waterfall Analysis</h1>
      
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Share Classes</h2>
              <Button onClick={addShareClass}>Add Share Class</Button>
            </div>
            <div className="overflow-x-auto">
              {renderTransactionsTable()}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Exit Amount</h2>
            <div className="flex items-center space-x-2">
              <Label htmlFor="exitAmount">Exit Amount ($)</Label>
              <Input
                id="exitAmount"
                type="text"
                value={formatNumber(exitAmount)}
                onChange={(e) => {
                  const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                  setExitAmount(isNaN(value) ? 0 : value);
                }}
                className="w-[200px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
