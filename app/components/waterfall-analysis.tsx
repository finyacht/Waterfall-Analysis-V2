"use client";

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface ShareClass {
  id: number;
  name: string;
  seniority: number;
  liquidationPref: number;
  prefType: 'participating' | 'non-participating';
  cap: number | null;
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

type ShareClassField = {
  name: string;
  seniority: number;
  liquidationPref: number;
  prefType: 'participating' | 'non-participating';
  cap: number | null;
  id: number;
};

export default function WaterfallAnalysis() {
  const [shareClasses, setShareClasses] = useState<ShareClass[]>([
    {
      id: 1,
      name: "Series A",
      seniority: 1,
      liquidationPref: 1,
      prefType: "non-participating",
      cap: null
    },
    {
      id: 2,
      name: "Series B",
      seniority: 2,
      liquidationPref: 1.5,
      prefType: "participating",
      cap: 3
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

  const deleteShareClass = (id: number) => {
    setShareClasses(shareClasses.filter(sc => sc.id !== id));
    setTransactions(transactions.filter(t => t.shareClassId !== id));
    toast({
      title: 'Share Class Deleted',
      description: 'Share class and associated transaction removed',
      variant: 'destructive',
    });
  };

  const updateTransaction = (id: number, field: keyof Transaction, value: number) => {
    setTransactions(transactions.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  useEffect(() => {
    if (shareClasses.length === 0 || transactions.length === 0) return;

    // Sort share classes by seniority
    const sortedShareClasses = [...shareClasses].sort((a, b) => a.seniority - b.seniority);
    let remainingAmount = exitAmount;

    // Calculate waterfall data by series
    const waterfallResults: WaterfallDataPoint[] = sortedShareClasses.map(sc => {
      const tx = transactions.find(t => t.shareClassId === sc.id);
      if (!tx) return { name: sc.name, liquidation: 0, participation: 0 };

      // Calculate liquidation preference
      let liquidation = 0;
      if (sc.prefType === 'participating' || sc.prefType === 'non-participating') {
        const liquidationPref = tx.investment * sc.liquidationPref;
        liquidation = Math.min(remainingAmount, liquidationPref);
        remainingAmount -= liquidation;
      }

      // Calculate participation
      let participation = 0;
      if (remainingAmount > 0 && (sc.prefType === 'participating' || (sc.prefType === 'non-participating' && sc.cap !== null))) {
        const totalShares = transactions.reduce((sum, t) => sum + t.shares, 0);
        const rawParticipation = (tx.shares / totalShares) * remainingAmount;
        
        if (sc.cap !== null) {
          const maxReturn = tx.investment * sc.cap;
          participation = Math.min(rawParticipation, maxReturn - liquidation);
        } else {
          participation = rawParticipation;
        }
        
        remainingAmount -= participation;
      }

      return {
        name: sc.name,
        liquidation,
        participation
      };
    });

    setWaterfallData(waterfallResults);

    // Calculate returns
    const returnsData = shareClasses.map(sc => {
      const tx = transactions.find(t => t.shareClassId === sc.id);
      if (!tx) return null;

      const seriesData = waterfallData.find(d => d.name === sc.name);
      if (!seriesData) return null;

      return {
        name: sc.name,
        liquidationReturn: seriesData.liquidation / tx.investment,
        participationReturn: seriesData.participation / tx.investment
      };
    }).filter((data): data is ReturnDataPoint => data !== null);

    setReturnData(returnsData);

    // Calculate sensitivity data with a wider range around exit amount
    const minExit = Math.min(exitAmount * 0.5, ...transactions.map(tx => tx.investment));
    const maxExit = Math.max(exitAmount * 2, ...transactions.map(tx => tx.investment * 4));
    const steps = 30; // Increased number of points for smoother lines
    const stepSize = (maxExit - minExit) / steps;

    const sensitivityPoints = Array.from({ length: steps + 1 }, (_, i) => {
      const currentExit = minExit + (i * stepSize);
      const point: SensitivityDataPoint = { exitValue: currentExit };
      
      shareClasses.forEach(sc => {
        const tx = transactions.find(t => t.shareClassId === sc.id);
        if (!tx) return;

        let remainingAmount = currentExit;
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

        // Calculate participation if applicable
        if (remainingAmount > 0 && (sc.prefType === "participating" || (sc.prefType === "non-participating" && sc.cap !== null))) {
          const totalShares = transactions.reduce((sum, t) => sum + t.shares, 0);
          const participation = (tx.shares / totalShares) * remainingAmount;
          const maxParticipation = sc.cap ? tx.investment * (sc.cap - 1) : participation;
          shareClassReturn += Math.min(participation, maxParticipation);
        }

        point[sc.name] = shareClassReturn / tx.investment;
      });

      return point;
    });

    setSensitivityData(sensitivityPoints);
  }, [shareClasses, transactions, exitAmount]);

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-900">Waterfall Analysis</h1>
      </div>

      {/* Share Classes Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Share Classes</CardTitle>
          <Button onClick={addShareClass} className="bg-blue-600 hover:bg-blue-700">
            Add Share Class
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Name</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Seniority</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Liquidation Preference</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Type</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Cap</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shareClasses.map((sc) => (
                  <tr key={sc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <Input
                        value={sc.name}
                        onChange={(e) => updateShareClass(sc.id, { name: e.target.value })}
                        className="bg-transparent border-gray-200"
                      />
                    </td>
                    <td className="p-4">
                      <Input
                        type="number"
                        value={sc.seniority}
                        onChange={(e) => updateShareClass(sc.id, { seniority: Number(e.target.value) })}
                        className="bg-transparent border-gray-200"
                      />
                    </td>
                    <td className="p-4">
                      <Input
                        type="number"
                        value={sc.liquidationPref}
                        onChange={(e) => updateShareClass(sc.id, { liquidationPref: Number(e.target.value) })}
                        className="bg-transparent border-gray-200"
                      />
                    </td>
                    <td className="p-4">
                      <select
                        value={sc.prefType}
                        onChange={(e) => updateShareClass(sc.id, { prefType: e.target.value as 'participating' | 'non-participating' })}
                        className="w-full p-2 border rounded bg-white border-gray-200"
                      >
                        <option value="non-participating">Non-Participating</option>
                        <option value="participating">Participating</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <Input
                        type="number"
                        value={sc.cap || ''}
                        placeholder="No cap"
                        disabled={sc.prefType === 'non-participating'}
                        onChange={(e) => updateShareClass(sc.id, { cap: e.target.value ? Number(e.target.value) : null })}
                        className="bg-transparent border-gray-200"
                      />
                    </td>
                    <td className="p-4">
                      <Button
                        variant="destructive"
                        onClick={() => deleteShareClass(sc.id)}
                        className="w-full"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Section */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Share Class</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Shares</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Investment</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const shareClass = shareClasses.find((sc) => sc.id === tx.shareClassId);
                  return (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4">
                        <Input value={shareClass?.name || ''} disabled className="bg-transparent border-gray-200" />
                      </td>
                      <td className="p-4">
                        <Input
                          type="number"
                          value={tx.shares}
                          onChange={(e) => updateTransaction(tx.id, 'shares', Number(e.target.value))}
                          className="bg-transparent border-gray-200"
                        />
                      </td>
                      <td className="p-4">
                        <Input
                          type="number"
                          value={tx.investment}
                          onChange={(e) => updateTransaction(tx.id, 'investment', Number(e.target.value))}
                          className="bg-transparent border-gray-200"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Exit Value Section */}
      <Card>
        <CardHeader>
          <CardTitle>Exit Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full max-w-sm">
            <Label>Exit Value ($)</Label>
            <Input
              type="number"
              value={exitAmount}
              onChange={(e) => setExitAmount(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Waterfall Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Returns by Series</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(value: number) => `$${(value / 1000000).toFixed(2)}M`}
                  labelFormatter={(name) => name}
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
                />
                <Legend />
                <Bar
                  dataKey="liquidation"
                  stackId="a"
                  name="Liquidation Preference"
                  fill="#4F46E5"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="participation"
                  stackId="a"
                  name="Participation"
                  fill="#10B981"
                  radius={[0, 0, 4, 4]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Table */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Share Class</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Investment</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Liquidation</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Participation</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Total Return</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Multiple</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {waterfallData.map((data, index) => {
                  const tx = transactions.find(t => t.shareClassId === shareClasses[index]?.id);
                  if (!tx) return null;
                  
                  const totalReturn = data.liquidation + data.participation;
                  const multiple = totalReturn / tx.investment;
                  const percentOfTotal = (totalReturn / exitAmount) * 100;

                  return (
                    <tr key={data.name} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 font-medium">{data.name}</td>
                      <td className="p-4">${(tx.investment / 1000000).toFixed(2)}M</td>
                      <td className="p-4">${(data.liquidation / 1000000).toFixed(2)}M</td>
                      <td className="p-4">${(data.participation / 1000000).toFixed(2)}M</td>
                      <td className="p-4">${(totalReturn / 1000000).toFixed(2)}M</td>
                      <td className="p-4">{multiple.toFixed(2)}x</td>
                      <td className="p-4">{percentOfTotal.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-gray-200 font-medium">
                  <td className="p-4">Total</td>
                  <td className="p-4">${(transactions.reduce((sum, tx) => sum + tx.investment, 0) / 1000000).toFixed(2)}M</td>
                  <td className="p-4">${(waterfallData.reduce((sum, d) => sum + d.liquidation, 0) / 1000000).toFixed(2)}M</td>
                  <td className="p-4">${(waterfallData.reduce((sum, d) => sum + d.participation, 0) / 1000000).toFixed(2)}M</td>
                  <td className="p-4">${(exitAmount / 1000000).toFixed(2)}M</td>
                  <td className="p-4">-</td>
                  <td className="p-4">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sensitivity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Returns Sensitivity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={sensitivityData}
                margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="exitValue"
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  label={{ 
                    value: 'Exit Value ($)', 
                    position: 'bottom', 
                    offset: 15,
                    style: { textAnchor: 'middle' }
                  }}
                />
                <YAxis
                  tickFormatter={(value) => `${value.toFixed(1)}x`}
                  label={{ 
                    value: 'Return Multiple (x)', 
                    angle: -90, 
                    position: 'insideLeft',
                    offset: 10,
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}x`}
                  labelFormatter={(value: number) =>
                    `Exit Value: $${(value / 1000000).toFixed(2)}M`
                  }
                  contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36}
                  wrapperStyle={{ paddingTop: '10px' }}
                />
                <ReferenceLine
                  x={exitAmount}
                  stroke="#6B7280"
                  strokeDasharray="3 3"
                  label={{
                    value: `Current Exit: $${(exitAmount / 1000000).toFixed(1)}M`,
                    position: 'top',
                    fill: '#6B7280',
                    offset: 15
                  }}
                />
                {shareClasses.map((sc, index) => (
                  <Line
                    key={sc.id}
                    type="monotone"
                    dataKey={sc.name}
                    stroke={['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ 
                      r: 6, 
                      fill: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5],
                      stroke: 'white',
                      strokeWidth: 2
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 