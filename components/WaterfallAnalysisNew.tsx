'use client';

import React from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, LineChart, Line, ReferenceDot } from "recharts";
import { formatNumber } from "@/utils/formatNumber";
import { Plus } from "lucide-react";

interface ShareClass {
  id: number;
  name: string;
  seniority: number;
  liquidationPref: number;
  prefType: "non-participating" | "participating";
  cap: number | null;
}

interface Transaction {
  id: number;
  shareClassId: number;
  shares: number;
  investment: number;
}

interface Component {
  type: string;
  amount: number;
}

interface ReturnData {
  total: number;
  components: Component[];
}

interface Returns {
  [key: string]: ReturnData;
}

type SummaryData = {
  name: string;
  [key: string]: string | number;
};

interface WaterfallStepData {
  name: string;
  start: number;
  end: number;
  amount: number;
  type: string;
}

interface ReturnPoint {
  exitValue: number;
  [key: string]: number;
}

interface TransactionSelectProps {
  transaction: Transaction;
  currentShareClass: ShareClass | undefined;
  onShareClassChange: (shareClassId: number) => void;
}

function WaterfallAnalysisNew() {
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([
    { id: 1, name: "Series A", seniority: 1, liquidationPref: 1, prefType: "non-participating", cap: null },
    { id: 2, name: "Series B", seniority: 2, liquidationPref: 1.5, prefType: "participating", cap: 3 }
  ]);

  const [transactions, setTransactions] = React.useState<Transaction[]>([
    { id: 1, shareClassId: 1, shares: 1000000, investment: 1000000 },
    { id: 2, shareClassId: 2, shares: 500000, investment: 2000000 }
  ]);

  const [exitAmount, setExitAmount] = React.useState<number>(10000000);
  const [forceUpdateCounter, setForceUpdateCounter] = React.useState<number>(0);
  
  const getShareClassById = (id: number): ShareClass | undefined => 
    shareClasses.find((sc: ShareClass) => sc.id === id);

  const updateTransaction = (id: number, field: keyof Transaction, value: number): void => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id === id) {
        return {
          ...tx,
          [field]: value
        };
      }
      return tx;
    }));
  };

  const deleteTransaction = (id: number): void => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const handleShareClassChange = (index: number, field: keyof ShareClass, value: any): void => {
    const oldShareClass = shareClasses[index];
    const newShareClasses = [...shareClasses];
    
    newShareClasses[index] = {
      ...oldShareClass,
      [field]: field === 'prefType' ? value as "non-participating" | "participating" :
               field === 'cap' ? (value === null ? null : Number(value)) :
               field === 'name' ? value :
               Number(value) || 0
    };
    
    setShareClasses(newShareClasses);

    if (field === 'name') {
      setTransactions([...transactions]);
      setForceUpdateCounter(prev => prev + 1);
    }
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
            <h2 className="text-xl font-semibold">Share Classes</h2>
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

export default WaterfallAnalysisNew;
