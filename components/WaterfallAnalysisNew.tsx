'use client';

// Force rebuild - remove old cached files
import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, LineChart, Line } from "recharts";

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

interface WaterfallDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface ReturnDataPoint {
  name: string;
  value: number;
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

  const [waterfallData, setWaterfallData] = useState<WaterfallDataPoint[]>([]);
  const [returnData, setReturnData] = useState<ReturnDataPoint[]>([]);

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

  const deleteShareClass = (id: number): void => {
    setShareClasses(shareClasses.filter(sc => sc.id !== id));
    setTransactions(transactions.filter(tx => tx.shareClassId !== id));
  };

  const addTransaction = (): void => {
    const newId = Math.max(...transactions.map(tx => tx.id), 0) + 1;
    const defaultShareClassId = shareClasses[0]?.id || 0;
    
    setTransactions([...transactions, {
      id: newId,
      shareClassId: defaultShareClassId,
      shares: 0,
      investment: 0
    }]);
  };

  const updateShareClass = (id: number, field: keyof ShareClass, value: string | number | null): void => {
    setShareClasses(prevShareClasses => 
      prevShareClasses.map(sc => 
        sc.id === id ? { ...sc, [field]: value } : sc
      )
    );
  };

  const getShareClassColor = (id: number): string => {
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#ff0000'];
    return colors[id % colors.length];
  };

  const getBarColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      'investment': '#82ca9d',
      'liquidation': '#8884d8',
      'participation': '#ffc658',
      'remaining': '#ff7300'
    };
    return colors[type] || '#000000';
  };

  const calculateWaterfallData = (): WaterfallStepData[] => {
    const data: WaterfallStepData[] = [];
    let remainingAmount = exitAmount;
    let currentStep = 0;

    // Sort share classes by seniority
    const sortedShareClasses = [...shareClasses].sort((a, b) => a.seniority - b.seniority);

    // Calculate liquidation preferences
    for (const sc of sortedShareClasses) {
      const tx = transactions.find(t => t.shareClassId === sc.id);
      if (!tx) continue;

      const liquidationPref = tx.investment * sc.liquidationPref;
      if (remainingAmount >= liquidationPref) {
        data.push({
          name: `${sc.name} Liquidation`,
          start: currentStep,
          end: currentStep + liquidationPref,
          amount: liquidationPref,
          type: 'liquidation'
        });
        remainingAmount -= liquidationPref;
        currentStep += liquidationPref;
      } else {
        data.push({
          name: `${sc.name} Liquidation`,
          start: currentStep,
          end: currentStep + remainingAmount,
          amount: remainingAmount,
          type: 'liquidation'
        });
        remainingAmount = 0;
        break;
      }
    }

    // Calculate participation
    if (remainingAmount > 0) {
      const participatingClasses = sortedShareClasses.filter(sc => 
        sc.prefType === "participating" || 
        (sc.prefType === "non-participating" && sc.cap !== null)
      );

      const totalShares = transactions.reduce((sum, tx) => {
        const sc = shareClasses.find(s => s.id === tx.shareClassId);
        return sc?.prefType === "participating" ? sum + tx.shares : sum;
      }, 0);

      for (const sc of participatingClasses) {
        const tx = transactions.find(t => t.shareClassId === sc.id);
        if (!tx) continue;

        const participation = (tx.shares / totalShares) * remainingAmount;
        const maxParticipation = sc.cap ? tx.investment * (sc.cap - 1) : participation;
        const actualParticipation = Math.min(participation, maxParticipation);

        if (actualParticipation > 0) {
          data.push({
            name: `${sc.name} Participation`,
            start: currentStep,
            end: currentStep + actualParticipation,
            amount: actualParticipation,
            type: 'participation'
          });
          remainingAmount -= actualParticipation;
          currentStep += actualParticipation;
        }
      }
    }

    // Add remaining amount if any
    if (remainingAmount > 0) {
      data.push({
        name: 'Remaining',
        start: currentStep,
        end: currentStep + remainingAmount,
        amount: remainingAmount,
        type: 'remaining'
      });
    }

    return data;
  };

  const calculateReturnsData = (): ReturnPoint[] => {
    const exitValues = Array.from({ length: 20 }, (_, i) => exitAmount * (i + 1) / 10);
    return exitValues.map(value => {
      const returns: ReturnPoint = { exitValue: value };
      
      let remainingAmount = value;
      const sortedShareClasses = [...shareClasses].sort((a, b) => a.seniority - b.seniority);

      // Calculate liquidation preferences
      for (const sc of sortedShareClasses) {
        const tx = transactions.find(t => t.shareClassId === sc.id);
        if (!tx) continue;

        const liquidationPref = tx.investment * sc.liquidationPref;
        returns[sc.name] = Math.min(remainingAmount, liquidationPref);
        remainingAmount -= returns[sc.name];
      }

      // Calculate participation
      if (remainingAmount > 0) {
        const totalShares = transactions.reduce((sum, tx) => sum + tx.shares, 0);
        
        for (const sc of sortedShareClasses) {
          const tx = transactions.find(t => t.shareClassId === sc.id);
          if (!tx) continue;

          if (sc.prefType === "participating" || (sc.prefType === "non-participating" && sc.cap !== null)) {
            const participation = (tx.shares / totalShares) * remainingAmount;
            const maxParticipation = sc.cap ? tx.investment * (sc.cap - 1) : participation;
            returns[sc.name] += Math.min(participation, maxParticipation);
          }
        }
      }

      return returns;
    });
  };

  const renderShareClassesTable = () => (
    <table className="w-full min-w-[800px] border-collapse">
      <thead>
        <tr>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Name</th>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Seniority</th>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Liquidation Preference</th>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Type</th>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Cap</th>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Actions</th>
        </tr>
      </thead>
      <tbody>
        {shareClasses.map((sc) => (
          <tr key={sc.id} className="border-b last:border-b-0 hover:bg-gray-50">
            <td className="p-4">
              <Input
                type="text"
                value={sc.name}
                onChange={(e) => updateShareClass(sc.id, 'name', e.target.value)}
                className="w-full"
              />
            </td>
            <td className="p-4">
              <Input
                type="number"
                value={sc.seniority}
                onChange={(e) => updateShareClass(sc.id, 'seniority', parseInt(e.target.value))}
                className="w-full"
              />
            </td>
            <td className="p-4">
              <Input
                type="number"
                value={sc.liquidationPref}
                onChange={(e) => updateShareClass(sc.id, 'liquidationPref', parseFloat(e.target.value))}
                className="w-full"
              />
            </td>
            <td className="p-4">
              <select
                value={sc.prefType}
                onChange={(e) => updateShareClass(sc.id, 'prefType', e.target.value as "non-participating" | "participating")}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="non-participating">Non-Participating</option>
                <option value="participating">Participating</option>
              </select>
            </td>
            <td className="p-4">
              <Input
                type="number"
                value={sc.cap === null ? '' : sc.cap}
                onChange={(e) => updateShareClass(sc.id, 'cap', e.target.value === '' ? null : parseFloat(e.target.value))}
                className="w-full"
              />
            </td>
            <td className="p-4">
              <Button variant="destructive" size="sm" onClick={() => deleteShareClass(sc.id)}>Delete</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderTransactionsTable = () => (
    <table className="w-full min-w-[800px] border-collapse">
      <thead>
        <tr>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b w-[40%]">Share Class</th>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b w-[25%]">Shares</th>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b w-[25%]">Investment</th>
          <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b w-[10%]">Actions</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr key={tx.id} className="border-b last:border-b-0 hover:bg-gray-50">
            <td className="p-4">
              <select
                value={tx.shareClassId}
                onChange={(e) => updateTransaction(tx.id, 'shareClassId', parseInt(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {shareClasses.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </td>
            <td className="p-4">
              <Input
                type="text"
                value={formatNumber(tx.shares)}
                onChange={(e) => updateTransaction(tx.id, 'shares', parseFloat(e.target.value.replace(/[^0-9]/g, '')))}
                className="w-full"
              />
            </td>
            <td className="p-4">
              <Input
                type="text"
                value={formatNumber(tx.investment)}
                onChange={(e) => updateTransaction(tx.id, 'investment', parseFloat(e.target.value.replace(/[^0-9]/g, '')))}
                className="w-full"
              />
            </td>
            <td className="p-4">
              <Button variant="destructive" size="sm" onClick={() => deleteTransaction(tx.id)}>Delete</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1920px] mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-gray-900">Waterfall Analysis</h1>
        </div>
      
        <div className="flex flex-col gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-6">Share Classes</h2>
            <div className="overflow-x-auto">
              {renderShareClassesTable()}
            </div>
            <div className="mt-4">
              <Button onClick={addShareClass} className="bg-blue-600 hover:bg-blue-700">
                Add Share Class
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-6">Transactions</h2>
            <div className="overflow-x-auto">
              {renderTransactionsTable()}
            </div>
            <div className="mt-4">
              <Button onClick={addTransaction} className="bg-blue-600 hover:bg-blue-700">
                Add Transaction
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-6">Exit Value</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  value={formatNumber(exitAmount)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                    setExitAmount(isNaN(value) ? 0 : value);
                  }}
                  className="w-full text-lg"
                  placeholder="Enter exit value..."
                />
              </div>
              <Button onClick={calculateWaterfallData} className="bg-green-600 hover:bg-green-700">
                Calculate
              </Button>
            </div>
          </div>

          {waterfallData.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-6">Waterfall Analysis</h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value: number) => `$${formatNumber(value)}`} />
                    <Tooltip formatter={(value: number) => `$${formatNumber(value)}`} />
                    <Bar dataKey="value" fill="#4F46E5">
                      {waterfallData.map((entry: WaterfallDataPoint, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color || '#4F46E5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {returnData.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-6">Returns Analysis</h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value: number) => `${value.toFixed(1)}x`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)}x`} />
                    <Bar dataKey="value" fill="#4F46E5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
