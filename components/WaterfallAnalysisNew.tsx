'use client';

// Force rebuild - remove old cached files
import React, { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, LineChart, Line, ReferenceDot } from "recharts";
import { Plus } from "lucide-react";

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
    <table className="w-full min-w-[800px]">
      <thead>
        <tr className="bg-gray-50">
          <th className="text-left p-3 text-gray-600 font-medium">Name</th>
          <th className="text-left p-3 text-gray-600 font-medium">Seniority</th>
          <th className="text-left p-3 text-gray-600 font-medium">Liquidation Preference</th>
          <th className="text-left p-3 text-gray-600 font-medium">Type</th>
          <th className="text-left p-3 text-gray-600 font-medium">Cap</th>
          <th className="text-left p-3 text-gray-600 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {shareClasses.map((sc) => (
          <tr key={sc.id}>
            <td className="p-3">
              <Input
                type="text"
                value={sc.name}
                onChange={(e) => updateShareClass(sc.id, 'name', e.target.value)}
              />
            </td>
            <td className="p-3">
              <Input
                type="number"
                value={sc.seniority}
                onChange={(e) => updateShareClass(sc.id, 'seniority', parseInt(e.target.value))}
              />
            </td>
            <td className="p-3">
              <Input
                type="number"
                value={sc.liquidationPref}
                onChange={(e) => updateShareClass(sc.id, 'liquidationPref', parseFloat(e.target.value))}
              />
            </td>
            <td className="p-3">
              <select
                value={sc.prefType}
                onChange={(e) => updateShareClass(sc.id, 'prefType', e.target.value as "non-participating" | "participating")}
                className="w-full"
              >
                <option value="non-participating">Non-Participating</option>
                <option value="participating">Participating</option>
              </select>
            </td>
            <td className="p-3">
              <Input
                type="number"
                value={sc.cap === null ? '' : sc.cap}
                onChange={(e) => updateShareClass(sc.id, 'cap', e.target.value === '' ? null : parseFloat(e.target.value))}
              />
            </td>
            <td className="p-3">
              <Button variant="destructive" onClick={() => deleteShareClass(sc.id)}>Delete</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

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
              {renderShareClassesTable()}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Transactions</h2>
              <Button onClick={addTransaction}>Add Transaction</Button>
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

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Waterfall Chart</h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={calculateWaterfallData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatNumber(value as number)} />
                  <Legend />
                  <Bar dataKey="amount" fill="#8884d8">
                    {calculateWaterfallData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.type)} />
                    ))}
                  </Bar>
                  <ReferenceLine y={0} stroke="#000" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Returns Chart</h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={calculateReturnsData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="exitValue" 
                    type="number"
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => formatNumber(value as number)}
                    labelFormatter={(value) => `Exit Value: $${formatNumber(value as number)}`}
                  />
                  <Legend />
                  {shareClasses.map((sc) => (
                    <Line
                      key={sc.id}
                      type="monotone"
                      dataKey={sc.name}
                      stroke={getShareClassColor(sc.id)}
                      dot={false}
                    />
                  ))}
                  <ReferenceLine
                    x={exitAmount}
                    stroke="red"
                    label="Current Exit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
