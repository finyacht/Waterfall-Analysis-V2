'use client';

// Force rebuild - remove old cached files
import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import type {
  BarChart as BarChartType,
  Bar as BarType,
  XAxis as XAxisType,
  YAxis as YAxisType,
  CartesianGrid as CartesianGridType,
  Tooltip as TooltipType,
  ResponsiveContainer as ResponsiveContainerType,
  Cell as CellType,
  LineChart as LineChartType,
  Line as LineType,
  ReferenceLine as ReferenceLineType
} from "recharts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from "recharts";

export interface ShareClass {
  id: number;
  name: string;
  type: 'common' | 'preferred';
  seniority: number;
  liquidationPref: number;
  prefType: 'participating' | 'non-participating';
  cap: number | null;
}

export interface Transaction {
  id: number;
  shareClassId: number;
  investment: number;
  shares: number;
}

interface WaterfallStepData {
  name: string;
  start: number;
  end: number;
  amount: number;
  type: 'liquidation' | 'participation' | 'common';
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

interface SensitivityDataPoint {
  exitValue: number;
  [key: string]: number;
}

export default function WaterfallAnalysisNew() {
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exitAmount, setExitAmount] = useState<number>(10000000);
  const [waterfallData, setWaterfallData] = useState<WaterfallDataPoint[]>([]);
  const [returnData, setReturnData] = useState<ReturnDataPoint[]>([]);
  const [sensitivityData, setSensitivityData] = useState<SensitivityDataPoint[]>([]);

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const addShareClass = () => {
    const newId = shareClasses.length > 0 ? Math.max(...shareClasses.map(sc => sc.id)) + 1 : 1;
    setShareClasses([...shareClasses, {
      id: newId,
      name: `Series ${String.fromCharCode(65 + shareClasses.length)}`,
      type: 'preferred',
      seniority: shareClasses.length + 1,
      liquidationPref: 1,
      prefType: "non-participating",
      cap: null
    }]);
  };

  const addTransaction = () => {
    if (shareClasses.length === 0) {
      alert("Please add at least one share class first");
      return;
    }
    const newId = transactions.length > 0 ? Math.max(...transactions.map(tx => tx.id)) + 1 : 1;
    setTransactions([...transactions, {
      id: newId,
      shareClassId: shareClasses[0].id,
      shares: 1000000,
      investment: 1000000
    }]);
  };

  const updateShareClass = (id: number, field: keyof ShareClass, value: ShareClass[keyof ShareClass]) => {
    setShareClasses(shareClasses.map(sc => {
      if (sc.id === id) {
        if (field === 'prefType' && value === 'non-participating') {
          return { ...sc, [field]: value, cap: null };
        }
        return { ...sc, [field]: value };
      }
      return sc;
    }));
  };

  const updateTransaction = (id: number, field: keyof Transaction, value: Transaction[keyof Transaction]) => {
    setTransactions(transactions.map(tx => {
      if (tx.id === id) {
        return { ...tx, [field]: value };
      }
      return tx;
    }));
  };

  const deleteShareClass = (id: number) => {
    setShareClasses(shareClasses.filter(sc => sc.id !== id));
    setTransactions(transactions.filter(tx => tx.shareClassId !== id));
  };

  const deleteTransaction = (id: number) => {
    setTransactions(transactions.filter(tx => tx.id !== id));
  };

  useEffect(() => {
    if (shareClasses.length === 0 || transactions.length === 0) return;

    const calculateWaterfallData = (
      shareClasses: ShareClass[],
      transactions: Transaction[],
      exitAmount: number
    ): WaterfallStepData[] => {
      const data: WaterfallStepData[] = [];
      let remainingAmount = exitAmount;
      let currentStep = 0;

      // Sort share classes by seniority (common shares always last)
      const sortedShareClasses = [...shareClasses].sort((a, b) => {
        if (a.type === 'common' && b.type === 'preferred') return 1;
        if (a.type === 'preferred' && b.type === 'common') return -1;
        return a.seniority - b.seniority;
      });

      // Calculate liquidation preferences for preferred shares only
      for (const sc of sortedShareClasses) {
        if (sc.type !== 'preferred') continue;
        
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
        } else if (remainingAmount > 0) {
          data.push({
            name: `${sc.name} Liquidation`,
            start: currentStep,
            end: currentStep + remainingAmount,
            amount: remainingAmount,
            type: 'liquidation'
          });
          remainingAmount = 0;
          currentStep += remainingAmount;
        }
      }

      // Calculate participation and remaining distribution
      if (remainingAmount > 0) {
        const totalShares = transactions.reduce((sum, tx) => {
          const sc = shareClasses.find(s => s.id === tx.shareClassId);
          // Only count shares that participate in this round
          if (sc && (sc.type === 'common' || 
              (sc.type === 'preferred' && sc.prefType === 'participating'))) {
            return sum + tx.shares;
          }
          return sum;
        }, 0);
        
        // First, calculate how much each share class would get in pro-rata distribution
        const proRataAmounts = new Map<number, number>();
        let availableForProRata = remainingAmount;

        // Handle participating preferred shares first
        for (const sc of sortedShareClasses) {
          if (sc.type !== 'preferred' || sc.prefType !== 'participating') continue;
          
          const tx = transactions.find(t => t.shareClassId === sc.id);
          if (!tx) continue;

          const shareRatio = tx.shares / totalShares;
          const proRataAmount = shareRatio * remainingAmount;

          // Check if this would exceed the cap
          if (sc.cap !== null) {
            const totalReceived = data
              .filter(step => step.name.includes(sc.name))
              .reduce((sum, step) => sum + step.amount, 0);
            
            const maxAdditional = (sc.cap * tx.investment) - totalReceived;

            if (maxAdditional <= 0) {
              // Already at or over cap from liquidation preference
              continue;
            }

            // Limit participation to cap
            proRataAmounts.set(sc.id, Math.min(proRataAmount, maxAdditional));
            availableForProRata -= Math.min(proRataAmount, maxAdditional);
          } else {
            proRataAmounts.set(sc.id, proRataAmount);
            availableForProRata -= proRataAmount;
          }
        }

        // Handle common shares last
        for (const sc of sortedShareClasses) {
          if (sc.type !== 'common') continue;
          
          const tx = transactions.find(t => t.shareClassId === sc.id);
          if (!tx) continue;

          const shareRatio = tx.shares / totalShares;
          const proRataAmount = shareRatio * remainingAmount;
          proRataAmounts.set(sc.id, proRataAmount);
        }

        // Add participation amounts to data
        Array.from(proRataAmounts.entries()).forEach(([shareClassId, amount]) => {
          if (amount > 0) {
            const sc = shareClasses.find(s => s.id === shareClassId);
            if (!sc) return;
            
            data.push({
              name: `${sc.name} ${sc.type === 'common' ? 'Common' : 'Participation'}`,
              start: currentStep,
              end: currentStep + amount,
              amount: amount,
              type: sc.type === 'common' ? 'common' : 'participation'
            });
            currentStep += amount;
          }
        });
      }

      return data;
    };

    const waterfallSteps = calculateWaterfallData(shareClasses, transactions, exitAmount);
    const waterfallChartData = waterfallSteps.map(step => ({
      name: step.name,
      value: step.amount,
      color: step.type === 'liquidation' ? '#8884d8' : '#82ca9d'
    }));
    setWaterfallData(waterfallChartData);

    // Calculate returns
    const returnsData = shareClasses.map(sc => {
      const tx = transactions.find(t => t.shareClassId === sc.id);
      if (!tx) return null;

      const totalReturn = waterfallSteps.reduce((sum, step) => {
        if (step.name.includes(sc.name)) {
          return sum + step.amount;
        }
        return sum;
      }, 0);

      return {
        name: sc.name,
        value: totalReturn / tx.investment
      };
    }).filter((data): data is ReturnDataPoint => data !== null);

    setReturnData(returnsData);

    // Calculate sensitivity data
    const minExit = Math.min(...transactions.map(tx => tx.investment)) * 0.5;
    const maxExit = Math.max(...transactions.map(tx => tx.investment)) * 4;
    const steps = 20;
    const stepSize = (maxExit - minExit) / steps;

    const sensitivityPoints = Array.from({ length: steps + 1 }, (_, i) => {
      const currentExit = minExit + (i * stepSize);
      const point: SensitivityDataPoint = { exitValue: currentExit };
      
      const totalShares = transactions.reduce((sum, tx) => sum + tx.shares, 0);
      let remainingAmount = currentExit;

      shareClasses.forEach(sc => {
        const tx = transactions.find(t => t.shareClassId === sc.id);
        if (!tx) return;

        let shareClassReturn = 0;

        // Calculate liquidation preference
        const liquidationPref = tx.investment * sc.liquidationPref;
        if (remainingAmount >= liquidationPref) {
          shareClassReturn += liquidationPref;
          remainingAmount -= liquidationPref;
        } else {
          shareClassReturn += remainingAmount;
          remainingAmount = 0;
        }

        // Calculate participation
        if (remainingAmount > 0) {
          const shareRatio = tx.shares / totalShares;
          const participation = shareRatio * remainingAmount;
          shareClassReturn += participation;
        }

        point[sc.name] = shareClassReturn / tx.investment;
      });

      return point;
    });

    setSensitivityData(sensitivityPoints);
  }, [shareClasses, transactions, exitAmount]);

  const renderShareClassesTable = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[800px] border-collapse">
        <thead>
          <tr>
            <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Name</th>
            <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Type</th>
            <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Seniority</th>
            <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Liquidation Preference</th>
            <th className="text-left p-4 bg-gray-50 text-gray-600 font-semibold border-b">Participation</th>
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
                <select
                  value={sc.type}
                  onChange={(e) => updateShareClass(sc.id, 'type', e.target.value as 'common' | 'preferred')}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="preferred">Preferred</option>
                  <option value="common">Common</option>
                </select>
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
                {sc.type === 'preferred' && (
                  <Input
                    type="number"
                    value={sc.liquidationPref}
                    onChange={(e) => updateShareClass(sc.id, 'liquidationPref', parseFloat(e.target.value))}
                    className="w-full"
                  />
                )}
              </td>
              <td className="p-4">
                {sc.type === 'preferred' && (
                  <select
                    value={sc.prefType}
                    onChange={(e) => {
                      const newType = e.target.value as "non-participating" | "participating";
                      updateShareClass(sc.id, 'prefType', newType);
                      if (newType === "non-participating") {
                        updateShareClass(sc.id, 'cap', null);
                      }
                    }}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="non-participating">Non-Participating</option>
                    <option value="participating">Participating</option>
                  </select>
                )}
              </td>
              <td className="p-4">
                {sc.type === 'preferred' && sc.prefType === "participating" && (
                  <Input
                    type="number"
                    value={sc.cap === null ? '' : sc.cap}
                    onChange={(e) => updateShareClass(sc.id, 'cap', e.target.value === '' ? null : parseFloat(e.target.value))}
                    className="w-full"
                    placeholder="No cap"
                  />
                )}
              </td>
              <td className="p-4">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => deleteShareClass(sc.id)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTransactionsTable = () => (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
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
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => deleteTransaction(tx.id)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Waterfall Analysis</h1>
        
        <div className="flex flex-col gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Share Classes</h2>
              <Button 
                onClick={addShareClass}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add Share Class
              </Button>
            </div>
            {renderShareClassesTable()}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Transactions</h2>
              <Button 
                onClick={addTransaction}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add Transaction
              </Button>
            </div>
            {renderTransactionsTable()}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Exit Value</h2>
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
            </div>
          </div>

          {waterfallData.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Waterfall Analysis</h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#4B5563' }}
                      interval={0}
                      height={40}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${formatNumber(value)}`}
                      tick={{ fill: '#4B5563' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => `$${formatNumber(value)}`}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }}
                    />
                    <Bar dataKey="value" fill="#4F46E5">
                      {waterfallData.map((entry, index) => (
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
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Returns Analysis</h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#4B5563' }}
                      interval={0}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value.toFixed(1)}x`}
                      tick={{ fill: '#4B5563' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => `${value.toFixed(2)}x`}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }}
                    />
                    <Bar dataKey="value" fill="#4F46E5">
                      {returnData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#4F46E5', '#82ca9d', '#ffc658', '#ff7300'][index % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {sensitivityData.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Returns Sensitivity</h2>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sensitivityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="exitValue"
                      type="number"
                      tickFormatter={(value) => `$${formatNumber(value)}`}
                      tick={{ fill: '#4B5563' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value.toFixed(1)}x`}
                      tick={{ fill: '#4B5563' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => `${value.toFixed(2)}x`}
                      labelFormatter={(value: number) => `Exit Value: $${formatNumber(value)}`}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB' }}
                    />
                    {shareClasses.map((sc, index) => (
                      <Line
                        key={sc.id}
                        type="monotone"
                        dataKey={sc.name}
                        stroke={['#4F46E5', '#82ca9d', '#ffc658', '#ff7300'][index % 4]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                    <ReferenceLine
                      x={exitAmount}
                      stroke="#dc2626"
                      strokeDasharray="3 3"
                      label={{ value: "Current Exit", position: 'top', fill: '#dc2626' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
