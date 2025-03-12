"use client";

import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  Label,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label as UILabel } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

interface ShareClass {
  id: number;
  name: string;
  seniority: number;
  liquidationPref: number;
  prefType: 'participating' | 'non-participating';
  cap: number | null;
  investment: number;
  shares: number;
}

interface Transaction {
  id: number;
  shareClassId: number;
  shares: number;
  investment: number;
}

interface WaterfallDataPoint {
  name: string;
  liquidation: number;
  participation: number;
}

interface ReturnDataPoint {
  name: string;
  liquidationReturn: number;
  participationReturn: number;
}

interface SensitivityDataPoint {
  exitValue: number;
  [key: string]: number;
}

export default function WaterfallAnalysis() {
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([
    {
      id: 1,
      name: "Series A",
      seniority: 1,
      liquidationPref: 1,
      prefType: "non-participating",
      cap: null,
      investment: 1000000,
      shares: 1000000
    },
    {
      id: 2,
      name: "Series B",
      seniority: 2,
      liquidationPref: 1.5,
      prefType: "participating",
      cap: 3,
      investment: 2000000,
      shares: 500000
    }
  ]);

  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 1,
      shareClassId: 1,
      shares: 1000000,
      investment: 1000000
    },
    {
      id: 2,
      shareClassId: 2,
      shares: 500000,
      investment: 2000000
    }
  ]);

  const [exitAmount, setExitAmount] = useState<number>(10000000);
  const [waterfallData, setWaterfallData] = useState<WaterfallDataPoint[]>([]);
  const [returnData, setReturnData] = useState<ReturnDataPoint[]>([]);
  const [sensitivityData, setSensitivityData] = useState<SensitivityDataPoint[]>([]);
  const { toast } = useToast();

  const addShareClass = () => {
    const newId = shareClasses.length + 1;
    const newShareClass: ShareClass = {
      id: newId,
      name: `Series ${String.fromCharCode(64 + newId)}`,
      seniority: newId,
      liquidationPref: 1,
      prefType: 'non-participating',
      cap: null,
      investment: 1000000,
      shares: 1000000
    };
    setShareClasses([...shareClasses, newShareClass]);
    
    // Add corresponding transaction
    const newTransaction: Transaction = {
      id: newId,
      shareClassId: newId,
      shares: 1000000,
      investment: 1000000,
    };
    setTransactions([...transactions, newTransaction]);

    toast({
      title: 'Share Class Added',
      description: `Added ${newShareClass.name} with default values`,
    });
  };

  const updateShareClass = (id: number, updates: Partial<ShareClass>) => {
    setShareClasses(shareClasses.map(sc => {
      if (sc.id === id) {
        const updatedShareClass = { ...sc, ...updates };
        if (updates.prefType === 'non-participating') {
          updatedShareClass.cap = null;
        }
        return updatedShareClass;
      }
      return sc;
    }));
  };

  const updateTransaction = (id: number, field: keyof Transaction, value: string | number) => {
    setTransactions(transactions.map(t => {
      if (t.id === id) {
        return {
          ...t,
          [field]: typeof value === 'string' ? parseFloat(value) || 0 : value
        };
      }
      return t;
    }));
  };

  useEffect(() => {
    if (shareClasses.length === 0 || transactions.length === 0) return;

    // Sort share classes by seniority
    const sortedShareClasses = [...shareClasses].sort((a, b) => a.seniority - b.seniority);

    // Calculate total investment and exit value
    const totalInvestment = sortedShareClasses.reduce((sum, sc) => sum + sc.investment, 0);
    const exitValue = transactions.reduce((sum, t) => sum + t.investment, 0);

    let remainingAmount = exitValue;
    const waterfallResults: WaterfallDataPoint[] = [];
    const returns: { [key: string]: number } = {};

    // Calculate liquidation preferences
    for (const shareClass of sortedShareClasses) {
      if (shareClass.prefType === 'participating') {
        const liquidationPref = shareClass.investment * shareClass.liquidationPref;
        const distribution = Math.min(remainingAmount, liquidationPref);
        
        if (distribution > 0) {
          waterfallResults.push({
            name: `${shareClass.name} Liquidation Preference`,
            liquidation: distribution,
            participation: 0,
          });
          returns[shareClass.name] = distribution;
          remainingAmount -= distribution;
        }
      }
    }

    // Calculate participation
    if (remainingAmount > 0) {
      const participatingClasses = sortedShareClasses.filter(
        sc => sc.prefType === 'participating'
      );
      const commonClasses = sortedShareClasses.filter(sc => sc.prefType === 'non-participating');
      const totalParticipatingShares =
        participatingClasses.reduce((sum, sc) => sum + sc.investment, 0) +
        commonClasses.reduce((sum, sc) => sum + sc.investment, 0);

      for (const shareClass of [...participatingClasses, ...commonClasses]) {
        const ownership = shareClass.investment / totalParticipatingShares;
        const participation = remainingAmount * ownership;
        
        // Check participation cap for preferred shares
        if (shareClass.prefType === 'participating' && shareClass.cap) {
          const totalReturn = (returns[shareClass.name] || 0) + participation;
          const maxReturn = shareClass.investment * shareClass.cap;
          
          if (totalReturn > maxReturn) {
            const adjustedParticipation = maxReturn - (returns[shareClass.name] || 0);
            waterfallResults.push({
              name: `${shareClass.name} Participation`,
              liquidation: 0,
              participation: adjustedParticipation,
            });
            returns[shareClass.name] = (returns[shareClass.name] || 0) + adjustedParticipation;
            continue;
          }
        }
        
        waterfallResults.push({
          name: `${shareClass.name} Participation`,
          liquidation: 0,
          participation: participation,
        });
        returns[shareClass.name] = (returns[shareClass.name] || 0) + participation;
      }
    }

    // Calculate sensitivity data
    const sensitivityPoints: SensitivityDataPoint[] = [];
    const exitValues = Array.from({ length: 11 }, (_, i) => totalInvestment * (0.5 + i * 0.5));
    
    for (const testExitValue of exitValues) {
      let remaining = testExitValue;
      const testReturns: { [key: string]: number } = {};
      
      // Calculate liquidation preferences
      for (const shareClass of sortedShareClasses) {
        if (shareClass.prefType === 'participating') {
          const liquidationPref = shareClass.investment * shareClass.liquidationPref;
          const distribution = Math.min(remaining, liquidationPref);
          testReturns[shareClass.name] = distribution;
          remaining -= distribution;
        }
      }
      
      // Calculate participation
      if (remaining > 0) {
        const participatingClasses = sortedShareClasses.filter(
          sc => sc.prefType === 'participating'
        );
        const commonClasses = sortedShareClasses.filter(sc => sc.prefType === 'non-participating');
        const totalParticipatingShares =
          participatingClasses.reduce((sum, sc) => sum + sc.investment, 0) +
          commonClasses.reduce((sum, sc) => sum + sc.investment, 0);
          
        for (const shareClass of [...participatingClasses, ...commonClasses]) {
          const ownership = shareClass.investment / totalParticipatingShares;
          const participation = remaining * ownership;
          
          if (shareClass.prefType === 'participating' && shareClass.cap) {
            const totalReturn = (testReturns[shareClass.name] || 0) + participation;
            const maxReturn = shareClass.investment * shareClass.cap;
            
            if (totalReturn > maxReturn) {
              testReturns[shareClass.name] = maxReturn;
              continue;
            }
          }
          
          testReturns[shareClass.name] = (testReturns[shareClass.name] || 0) + participation;
        }
      }
      
      sensitivityPoints.push({
        exitValue: testExitValue,
        ...testReturns,
      });
    }

    setWaterfallData(waterfallResults);
    setReturnData(
      Object.entries(returns).map(([name, returns]) => ({
        name,
        liquidationReturn: returns,
        participationReturn: 0,
      }))
    );
    setSensitivityData(sensitivityPoints);
  }, [shareClasses, transactions]);

  const addTransaction = () => {
    setTransactions([
      ...transactions,
      {
        id: transactions.length + 1,
        shareClassId: shareClasses.length + 1,
        shares: 1000000,
        investment: 1000000,
      },
    ]);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Share Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {shareClasses.map((shareClass, index) => (
                <div key={index} className="space-y-4 p-4 border rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <UILabel htmlFor={`name-${index}`}>Name</UILabel>
                      <input
                        id={`name-${index}`}
                        type="text"
                        value={shareClass.name}
                        onChange={(e) => updateShareClass(index, { name: e.target.value })}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <UILabel htmlFor={`prefType-${index}`}>Type</UILabel>
                      <Select
                        value={shareClass.prefType}
                        onValueChange={(value) => updateShareClass(index, { prefType: value as 'participating' | 'non-participating' })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="participating">Participating</SelectItem>
                          <SelectItem value="non-participating">Non-Participating</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <UILabel htmlFor={`seniority-${index}`}>Seniority</UILabel>
                      <input
                        id={`seniority-${index}`}
                        type="number"
                        value={shareClass.seniority}
                        onChange={(e) => updateShareClass(index, { seniority: Number(e.target.value) })}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <UILabel htmlFor={`investment-${index}`}>Investment</UILabel>
                      <input
                        id={`investment-${index}`}
                        type="number"
                        value={shareClass.investment}
                        onChange={(e) => updateShareClass(index, { investment: Number(e.target.value) })}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    {shareClass.prefType === 'participating' && (
                      <>
                        <div className="space-y-2">
                          <UILabel htmlFor={`liquidationPref-${index}`}>
                            Liquidation Preference
                          </UILabel>
                          <input
                            id={`liquidationPref-${index}`}
                            type="number"
                            value={shareClass.liquidationPref}
                            onChange={(e) =>
                              updateShareClass(index, { liquidationPref: Number(e.target.value) })
                            }
                            className="w-full p-2 border rounded"
                          />
                        </div>
                        {shareClass.prefType === 'participating' && (
                          <div className="space-y-2">
                            <UILabel htmlFor={`cap-${index}`}>Cap (x)</UILabel>
                            <input
                              id={`cap-${index}`}
                              type="number"
                              value={shareClass.cap || ''}
                              onChange={(e) =>
                                updateShareClass(index, { cap: e.target.value ? Number(e.target.value) : null })
                              }
                              className="w-full p-2 border rounded"
                              placeholder="No cap"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={addShareClass}
                className="w-full p-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Add Share Class
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.map((transaction, index) => (
                <div key={index} className="space-y-4 p-4 border rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <UILabel htmlFor={`transactionName-${index}`}>Name</UILabel>
                      <input
                        id={`transactionName-${index}`}
                        type="text"
                        value={`${shareClasses.find(sc => sc.id === transaction.shareClassId)?.name} Transaction`}
                        onChange={(e) => updateTransaction(index, 'shares', Number(e.target.value))}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <UILabel htmlFor={`amount-${index}`}>Amount</UILabel>
                      <input
                        id={`amount-${index}`}
                        type="number"
                        value={transaction.investment}
                        onChange={(e) => updateTransaction(index, 'investment', Number(e.target.value))}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addTransaction}
                className="w-full p-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Add Transaction
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {waterfallData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Waterfall Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis>
                      <Label value="Amount ($)" angle={-90} position="insideLeft" />
                    </YAxis>
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="liquidation" fill="#8884d8" />
                    <Bar dataKey="participation" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Returns Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis>
                      <Label value="Returns ($)" angle={-90} position="insideLeft" />
                    </YAxis>
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="liquidationReturn" fill="#82ca9d" />
                    <Bar dataKey="participationReturn" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>Sensitivity Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sensitivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="exitValue"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                    >
                      <Label value="Exit Value ($)" position="bottom" />
                    </XAxis>
                    <YAxis
                      tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                    >
                      <Label value="Returns ($)" angle={-90} position="insideLeft" />
                    </YAxis>
                    <Tooltip
                      formatter={(value: number) => `$${(value / 1000000).toFixed(2)}M`}
                      labelFormatter={(value: number) => `Exit Value: $${(value / 1000000).toFixed(2)}M`}
                    />
                    <Legend />
                    {shareClasses.map((shareClass, index) => (
                      <Line
                        key={shareClass.name}
                        type="monotone"
                        dataKey={`returns.${shareClass.name}`}
                        name={shareClass.name}
                        stroke={`hsl(${(index * 360) / shareClasses.length}, 70%, 50%)`}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 