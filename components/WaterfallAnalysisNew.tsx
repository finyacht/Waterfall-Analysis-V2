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
  [key: string]: any;  // For dynamic share class data
}

const WaterfallAnalysisNew = () => {
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([
    { id: 1, name: "Series A", seniority: 1, liquidationPref: 1, prefType: "non-participating", cap: null },
    { id: 2, name: "Series B", seniority: 2, liquidationPref: 1.5, prefType: "participating", cap: 3 }
  ]);
  
  const [transactions, setTransactions] = React.useState<Transaction[]>([
    { id: 1, shareClassId: 1, shares: 1000000, investment: 1000000 },
    { id: 2, shareClassId: 2, shares: 500000, investment: 2000000 }
  ]);
  
  const [exitAmount, setExitAmount] = React.useState(10000000);
  const [newShareClass, setNewShareClass] = React.useState<ShareClass>({ 
    id: 0,
    name: "", 
    seniority: 1, 
    liquidationPref: 1, 
    prefType: "non-participating",
    cap: null 
  });
  
  const [newTransaction, setNewTransaction] = React.useState<Transaction>({
    id: 0,
    shareClassId: 0,
    shares: 0,
    investment: 0
  });

  const [forceUpdateCounter, setForceUpdateCounter] = React.useState(0);

  // Add a ref to store share class names
  const shareClassNamesRef = React.useRef<{[key: number]: string}>({});

  // Initialize and update the ref whenever share classes change
  React.useEffect(() => {
    shareClasses.forEach(sc => {
      shareClassNamesRef.current[sc.id] = sc.name;
    });
  }, [shareClasses]);

  // Add effect to handle share class name changes
  React.useEffect(() => {
    // Force re-render of transaction selects when share classes change
    setForceUpdateCounter(prev => prev + 1);
  }, [shareClasses]);

  const addShareClass = () => {
    const nextId = Math.max(...shareClasses.map(sc => sc.id), 0) + 1;
    setShareClasses(prev => [
      ...prev,
      {
        id: nextId,
        name: `Series ${String.fromCharCode(65 + prev.length)}`,
        seniority: prev.length + 1,
        liquidationPref: 1,
        prefType: "non-participating",
        cap: null
      }
    ]);
  };

  const deleteShareClass = (id: number) => {
    setShareClasses(prev => prev.filter(sc => sc.id !== id));
  };

  const handleShareClassChange = (index: number, field: keyof ShareClass, value: any) => {
    const oldShareClass = shareClasses[index];
    const newShareClasses = [...shareClasses];
    
    // Update the share class
    newShareClasses[index] = {
      ...oldShareClass,
      [field]: field === 'prefType' ? value as "non-participating" | "participating" :
               field === 'cap' ? (value === null ? null : Number(value)) :
               field === 'name' ? value :
               Number(value) || 0
    };
    
    // Update share classes
    setShareClasses(newShareClasses);

    // Force re-render of transactions when name changes
    if (field === 'name') {
      // Create new transaction objects with the same data to force re-render
      setTransactions(transactions.map(tx => ({...tx})));
      // Force update counter to trigger re-render
      setForceUpdateCounter(prev => prev + 1);
    }
  };

  const getShareClassById = (id: number) => shareClasses.find(sc => sc.id === id);

  const addTransaction = () => {
    const nextId = Math.max(...transactions.map(tx => tx.id), 0) + 1;
    const defaultShareClassId = shareClasses[0]?.id || 1;
    
    setTransactions(prev => [
      ...prev,
      {
        id: nextId,
        shareClassId: defaultShareClassId,
        shares: 1000000,
        investment: 1000000
      }
    ]);
  };

  const deleteTransaction = (id: number) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const updateTransaction = (id: number, field: keyof Transaction, value: string | number) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id === id) {
        return {
          ...tx,
          [field]: typeof value === 'string' ? value : (Number(value) || 0)
        };
      }
      return tx;
    }));
  };

  const calculateSummaryData = () => {
    const returns = calculateReturnsAtExit(exitAmount);
    const activeShareClasses = shareClasses.filter(sc => 
      transactions.some(tx => tx.shareClassId === sc.id)
    );
    
    const summaryData = [{
      name: 'Distribution',
      ...Object.fromEntries(
        activeShareClasses.map(sc => [
          sc.name,
          returns[sc.name]?.total || 0
        ])
      )
    }];

    return summaryData;
  };

  const calculateWaterfallSteps = () => {
    let steps: WaterfallStepData[] = [];
    let currentAmount = 0;
    let remainingProceeds = exitAmount;
    
    // Clone and sort share classes by seniority (highest first)
    const sortedClasses = [...shareClasses]
      .filter(sc => sc.name !== "Common" && transactions.some(tx => tx.shareClassId === sc.id))
      .sort((a, b) => b.seniority - a.seniority);
    
    // Calculate total ownership percentages
    const totalShares = transactions.reduce((sum, tx) => sum + tx.shares, 0);
    const ownershipByClass = new Map<number, number>();
    
    // Pre-calculate all ownerships
    transactions.forEach(tx => {
      const currentOwnership = ownershipByClass.get(tx.shareClassId) || 0;
      ownershipByClass.set(tx.shareClassId, currentOwnership + (tx.shares / totalShares));
    });
    
    // First, allocate based on liquidation preferences
    for (const sc of sortedClasses) {
      if (remainingProceeds <= 0) break;

      const transactionsForClass = transactions.filter(tx => tx.shareClassId === sc.id);
      const totalInvestment = transactionsForClass.reduce((sum, tx) => sum + tx.investment, 0);
      const liquidationPrefAmount = totalInvestment * sc.liquidationPref;
      const ownership = ownershipByClass.get(sc.id) ?? 0; // Use nullish coalescing
      
      if (sc.prefType === "non-participating") {
        const prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        const ownershipPayout = ownership * exitAmount;
        const finalPayout = Math.min(Math.max(prefPayout, ownershipPayout), remainingProceeds);
        
        if (finalPayout > 0) {
          steps.push({
            name: sc.name,
            start: currentAmount,
            end: currentAmount + finalPayout,
            amount: finalPayout,
            type: finalPayout === prefPayout ? "Liquidation Preference" : "Pro-rata Ownership"
          });
          currentAmount += finalPayout;
        }
        
        remainingProceeds = Math.max(0, remainingProceeds - finalPayout);
      } else if (sc.prefType === "participating") {
        const prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        
        if (prefPayout > 0) {
          steps.push({
            name: `${sc.name} (Pref)`,
            start: currentAmount,
            end: currentAmount + prefPayout,
            amount: prefPayout,
            type: "Liquidation Preference"
          });
          currentAmount += prefPayout;
        }
        
        remainingProceeds = Math.max(0, remainingProceeds - prefPayout);
        
        if (remainingProceeds > 0) {
          let participationAmount = remainingProceeds * ownership;
          
          if (sc.cap && sc.cap > 0) {
            const capAmount = totalInvestment * sc.cap;
            const totalPayout = prefPayout + participationAmount;
            if (totalPayout > capAmount) {
              participationAmount = Math.max(0, Math.min(capAmount - prefPayout, remainingProceeds));
            }
          }
          
          participationAmount = Math.min(participationAmount, remainingProceeds);
          
          if (participationAmount > 0) {
            steps.push({
              name: `${sc.name} (Part)`,
              start: currentAmount,
              end: currentAmount + participationAmount,
              amount: participationAmount,
              type: "Participation"
            });
            currentAmount += participationAmount;
          }
          
          remainingProceeds = Math.max(0, remainingProceeds - participationAmount);
        }
      }
    }
    
    // Add Common if it exists and has remaining proceeds
    const commonClass = shareClasses.find(sc => sc.name === "Common");
    if (commonClass) {
      const commonTransactions = transactions.filter(tx => tx.shareClassId === commonClass.id);
      if (commonTransactions.length > 0 && remainingProceeds > 0) {
        steps.push({
          name: "Common",
          start: currentAmount,
          end: currentAmount + remainingProceeds,
          amount: remainingProceeds,
          type: "Ownership"
        });
        currentAmount += remainingProceeds;
        remainingProceeds = 0;
      }
    }
    
    // Add any unallocated amount
    if (remainingProceeds > 0) {
      steps.push({
        name: "Unallocated",
        start: currentAmount,
        end: currentAmount + remainingProceeds,
        amount: remainingProceeds,
        type: "Remaining"
      });
    }
    
    return steps;
  };

  const calculateReturnsAtExit = (exitValue: number): Returns => {
    // Initialize returns object for all current share classes
    const returns: Returns = Object.fromEntries(
      shareClasses.map(sc => [sc.name, { total: 0, components: [] }])
    );

    let remainingProceeds = exitValue;
    
    // Only include share classes that have transactions
    const activeShareClasses = shareClasses
      .filter(sc => transactions.some(tx => tx.shareClassId === sc.id))
      .sort((a, b) => b.seniority - a.seniority);
    
    if (activeShareClasses.length === 0) return returns;
    
    // Calculate total ownership percentages
    const totalShares = transactions.reduce((sum, tx) => sum + tx.shares, 0);
    const ownershipByClass = new Map<number, number>();
    
    transactions.forEach(tx => {
      const currentOwnership = ownershipByClass.get(tx.shareClassId) || 0;
      ownershipByClass.set(tx.shareClassId, currentOwnership + (tx.shares / totalShares));
    });
    
    // First, allocate based on liquidation preferences
    for (const sc of activeShareClasses) {
      if (remainingProceeds <= 0) break;

      const transactionsForClass = transactions.filter(tx => tx.shareClassId === sc.id);
      let totalInvestment = transactionsForClass.reduce((sum, tx) => sum + tx.investment, 0);
      let liquidationPrefAmount = totalInvestment * sc.liquidationPref;
      const ownership = ownershipByClass.get(sc.id) || 0;
      
      if (sc.prefType === "non-participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        let ownershipPayout = ownership * exitValue;
        let finalPayout = Math.min(Math.max(prefPayout, ownershipPayout), remainingProceeds);
        
        returns[sc.name].total = finalPayout;
        returns[sc.name].components.push({
          type: finalPayout === prefPayout ? "Liquidation Preference" : "Pro-rata Ownership",
          amount: finalPayout
        });
        
        remainingProceeds = Math.max(0, remainingProceeds - finalPayout);
      } else if (sc.prefType === "participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        remainingProceeds = Math.max(0, remainingProceeds - prefPayout);
        
        returns[sc.name].total = prefPayout;
        returns[sc.name].components.push({
          type: "Liquidation Preference",
          amount: prefPayout
        });
        
        let participationAmount = 0;
        if (remainingProceeds > 0) {
          participationAmount = remainingProceeds * ownership;
          
          if (sc.cap && sc.cap > 0) {
            const capAmount = totalInvestment * sc.cap;
            const totalPayout = prefPayout + participationAmount;
            if (totalPayout > capAmount) {
              participationAmount = Math.max(0, capAmount - prefPayout);
            }
          }
          
          participationAmount = Math.min(participationAmount, remainingProceeds);
          remainingProceeds = Math.max(0, remainingProceeds - participationAmount);
          
          returns[sc.name].total += participationAmount;
          returns[sc.name].components.push({
            type: "Pro-rata Ownership",
            amount: participationAmount
          });
        }
      }
    }
    
    // If there are still remaining proceeds, distribute them pro-rata
    if (remainingProceeds > 0) {
      for (const sc of activeShareClasses) {
        const ownership = ownershipByClass.get(sc.id) || 0;
        const additionalPayout = remainingProceeds * ownership;
        returns[sc.name].total += additionalPayout;
        returns[sc.name].components.push({
          type: "Pro-rata Ownership",
          amount: additionalPayout
        });
      }
    }
    
    return returns;
  };

  const generateChartData = () => {
    const data: ReturnPoint[] = [];
    const maxExit = Math.max(exitAmount * 3, 30000000);
    const steps = 20;
    
    const activeShareClasses = shareClasses.filter(sc => 
      transactions.some(tx => tx.shareClassId === sc.id)
    );

    for (let i = 0; i <= steps; i++) {
      const currentExitValue = (maxExit * i) / steps;
      const returns = calculateReturnsAtExit(currentExitValue);
      
      const point: ReturnPoint = { exitValue: currentExitValue };
      activeShareClasses.forEach(sc => {
        point[getShareClassById(sc.id)?.name || ''] = returns[getShareClassById(sc.id)?.name || '']?.total || 0;
      });
      
      data.push(point);
    }

    // Add exact exit amount point
    if (!data.some(point => Math.abs(point.exitValue - exitAmount) < 0.01)) {
      const returns = calculateReturnsAtExit(exitAmount);
      const exitPoint: ReturnPoint = { exitValue: exitAmount };
      activeShareClasses.forEach(sc => {
        exitPoint[getShareClassById(sc.id)?.name || ''] = returns[getShareClassById(sc.id)?.name || '']?.total || 0;
      });
      data.push(exitPoint);
    }

    return data.sort((a, b) => a.exitValue - b.exitValue);
  };

  // Memoize the chart data to prevent unnecessary recalculations
  const chartData = React.useMemo(() => generateChartData(), [exitAmount, shareClasses, transactions]);
  const summaryData = React.useMemo(() => calculateSummaryData(), [exitAmount, shareClasses, transactions]);

  const waterfallSteps = calculateWaterfallSteps();

  const totalData: WaterfallStepData = {
    name: "Total",
    start: 0,
    end: exitAmount,
    amount: exitAmount,
    type: "Total"
  };

  const handleAddShareClass = () => {
    addShareClass();
  };

  const handleDeleteShareClass = (index: number) => {
    deleteShareClass(shareClasses[index].id);
  };

  // Update the bar chart to use the name map
  const renderBarChart = () => (
    <BarChart data={[{
      name: 'Distribution',
      ...Object.fromEntries(
        shareClasses
          .filter(sc => transactions.some(tx => tx.shareClassId === sc.id))
          .map(sc => {
            const name = getShareClassById(sc.id)?.name || '';
            return [name, calculateReturnsAtExit(exitAmount)[name]?.total || 0];
          })
      )
    }]}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" />
      <YAxis tickFormatter={(value) => `$${formatNumber(value, 2)}`} />
      <Tooltip 
        formatter={(value: any, name: string) => [`$${formatNumber(value, 2)}`, name]}
      />
      <Legend />
      {shareClasses
        .filter(sc => transactions.some(tx => tx.shareClassId === sc.id))
        .map((sc, index) => {
          const colors = [
            "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
            "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"
          ];
          const name = getShareClassById(sc.id)?.name || '';
          return (
            <Bar
              key={`${sc.id}-${index}`}
              dataKey={name}
              name={name}
              stackId="a"
              fill={colors[index % colors.length]}
            />
          );
        })}
    </BarChart>
  );

  // Update the line chart to use the name map
  const renderLineChart = () => (
    <LineChart 
      data={chartData}
      margin={{ top: 50, right: 50, left: 120, bottom: 50 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis 
        dataKey="exitValue" 
        tickFormatter={(value) => `$${formatNumber(value, 2)}`}
        interval="preserveStartEnd"
        minTickGap={100}
        height={60}
        label={{ 
          value: 'Exit Value ($)', 
          position: 'insideBottom',
          offset: -10
        }}
        tick={{ fontSize: 12 }}
      />
      <YAxis 
        tickFormatter={(value) => `$${formatNumber(value, 2)}`}
        width={110}
        tickCount={10}
        label={{ 
          value: 'Return ($)', 
          angle: -90, 
          position: 'insideLeft',
          offset: -60
        }}
        tick={{ fontSize: 12 }}
        domain={[0, 'auto']}
      />
      <Tooltip
        formatter={(value: any, name: string) => [`$${formatNumber(value, 2)}`, name]}
        labelFormatter={(value) => `Exit Value: $${formatNumber(value, 2)}`}
        cursor={{ strokeDasharray: '3 3' }}
      />
      <Legend 
        verticalAlign="top"
        height={50}
        wrapperStyle={{
          paddingTop: "0px",
          paddingBottom: "30px",
          fontSize: "14px"
        }}
      />
      {shareClasses
        .filter(sc => transactions.some(tx => tx.shareClassId === sc.id))
        .map((sc, index) => {
          const colors = [
            "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
            "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"
          ];
          const name = getShareClassById(sc.id)?.name || '';
          return (
            <Line
              key={`${sc.id}-${index}`}
              type="monotone"
              dataKey={name}
              name={name}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          );
        })}
      <ReferenceLine
        x={exitAmount}
        stroke="#000000"
        strokeWidth={2}
        label={{
          position: "top",
          value: `Current Exit: $${formatNumber(exitAmount, 2)}`,
          fill: "#000000",
          fontSize: 14,
          fontWeight: "bold"
        }}
      />
    </LineChart>
  );

  // Update the transactions table rendering
  const TransactionSelect = ({ 
    transaction, 
    currentShareClass,
    onShareClassChange 
  }: { 
    transaction: Transaction;
    currentShareClass: ShareClass | undefined;
    onShareClassChange: (shareClassId: number) => void;
  }) => {
    // Create a unique key that includes the force update counter
    const selectKey = `${transaction.id}-${currentShareClass?.id}-${currentShareClass?.name}-${forceUpdateCounter}`;
    
    return (
      <div key={selectKey}>
        <select
          value={currentShareClass?.id || ''}
          onChange={(e) => {
            const id = parseInt(e.target.value);
            if (!isNaN(id)) {
              onShareClassChange(id);
            }
          }}
          className="w-full min-w-[200px] h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background 
            placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="" disabled>Select a share class</option>
          {shareClasses.map((sc) => (
            <option 
              key={`${sc.id}-${sc.name}`}
              value={sc.id}
            >
              {sc.name}
            </option>
          ))}
        </select>
      </div>
    );
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
      <tbody className="divide-y divide-gray-100">
        {transactions.map((tx) => {
          const currentShareClass = getShareClassById(tx.shareClassId);
          const rowKey = `tr-${tx.id}-${tx.shareClassId}-${currentShareClass?.name}-${forceUpdateCounter}`;
          
          return (
            <tr key={rowKey} className="hover:bg-gray-50 transition-colors duration-150">
              <td className="p-3">
                <TransactionSelect
                  transaction={tx}
                  currentShareClass={currentShareClass}
                  onShareClassChange={(shareClassId) => updateTransaction(tx.id, 'shareClassId', shareClassId)}
                />
              </td>
              <td className="p-3">
                <Input
                  type="text"
                  value={formatNumber(tx.shares)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                    updateTransaction(tx.id, 'shares', isNaN(value) ? 0 : value);
                  }}
                  className="h-10 w-full min-w-[150px]"
                />
              </td>
              <td className="p-3">
                <Input
                  type="text"
                  value={formatNumber(tx.investment)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                    updateTransaction(tx.id, 'investment', isNaN(value) ? 0 : value);
                  }}
                  className="h-10 w-full min-w-[150px]"
                />
              </td>
              <td className="p-3">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => deleteTransaction(tx.id)}
                  className="h-10 w-full min-w-[80px]"
                >
                  Delete
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  // Remove the shareClassNameMap since we're not using it anymore
  const getShareClassName = (id: number): string => {
    return getShareClassById(id)?.name || '';
  };

  return (
    <div className="p-4 space-y-6 max-w-[1920px] mx-auto">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
        Waterfall Analysis
      </h1>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 p-2 rounded-lg">📊</span>
                Share Classes
              </h2>
              <Button 
                variant="default" 
                onClick={handleAddShareClass}
                className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-4"
              >
                <Plus className="h-4 w-4" />
                Add Share Class
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 text-gray-600 font-medium w-[25%]">Name</th>
                    <th className="text-left p-3 text-gray-600 font-medium w-[10%]">Seniority</th>
                    <th className="text-left p-3 text-gray-600 font-medium w-[15%]">Liquidation Preference</th>
                    <th className="text-left p-3 text-gray-600 font-medium w-[15%]">Type</th>
                    <th className="text-left p-3 text-gray-600 font-medium w-[15%]">Cap</th>
                    <th className="text-center p-3 text-gray-600 font-medium w-[10%]">Has Transactions</th>
                    <th className="text-right p-3 text-gray-600 font-medium w-[10%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shareClasses.map((sc, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3">
                        <Input
                          type="text"
                          value={sc.name}
                          onChange={(e) => handleShareClassChange(index, 'name', e.target.value)}
                          className="h-10 w-full min-w-[200px]"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={sc.seniority}
                          onChange={(e) => handleShareClassChange(index, 'seniority', parseInt(e.target.value))}
                          className="h-10 w-full min-w-[80px]"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={sc.liquidationPref}
                          onChange={(e) => handleShareClassChange(index, 'liquidationPref', parseFloat(e.target.value))}
                          className="h-10 w-full min-w-[120px]"
                        />
                      </td>
                      <td className="p-3">
                        <Select
                          value={sc.prefType}
                          onValueChange={(value: "non-participating" | "participating") => 
                            handleShareClassChange(index, 'prefType', value)}
                        >
                          <SelectTrigger className="h-10 w-full min-w-[120px]">
                            <SelectValue>
                              {sc.prefType === "non-participating" ? "Non-Part." : "Part."}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="non-participating">Non-Part.</SelectItem>
                            <SelectItem value="participating">Part.</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        {sc.prefType === "participating" ? (
                          <Input
                            type="number"
                            value={sc.cap || ""}
                            onChange={(e) => handleShareClassChange(index, 'cap', e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="No cap"
                            className="h-10 w-full min-w-[120px]"
                          />
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={transactions.some(tx => tx.shareClassId === sc.id) ? 
                          "text-green-600 font-medium" : 
                          "text-gray-400"
                        }>
                          {transactions.some(tx => tx.shareClassId === sc.id) ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteShareClass(index)}
                          className="h-10 w-full min-w-[80px]"
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

        {/* Transactions Management */}
        <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="bg-green-100 text-green-600 p-2 rounded-lg">💰</span>
                Transactions
              </h2>
              <Button 
                variant="default" 
                onClick={addTransaction}
                className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-4"
              >
                <Plus className="h-4 w-4" />
                Add Transaction
              </Button>
            </div>
            
            {transactions.length > 0 && (
              <div className="overflow-x-auto">
                {renderTransactionsTable()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Waterfall Analysis Results */}
      <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="bg-purple-100 text-purple-600 p-2 rounded-lg">📈</span>
              Waterfall Results
            </h2>
            <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg">
              <Label htmlFor="exitAmount" className="font-medium text-gray-700 whitespace-nowrap">Exit Amount ($)</Label>
              <Input
                id="exitAmount"
                type="text"
                value={formatNumber(exitAmount)}
                onChange={(e) => {
                  const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                  setExitAmount(isNaN(value) ? 0 : value);
                }}
                placeholder="e.g. 10,000,000"
                className="w-44 bg-white"
              />
            </div>
          </div>

          <div className="space-y-8">
            {/* Distribution Summary Table */}
            <div className="bg-white p-6 rounded-xl shadow-inner">
              <h3 className="text-lg font-medium mb-4 text-gray-800">Distribution Summary</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 text-gray-600 font-medium rounded-l-lg">Share Class</th>
                      <th className="text-left p-3 text-gray-600 font-medium">Payout Amount</th>
                      <th className="text-left p-3 text-gray-600 font-medium rounded-r-lg">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(calculateReturnsAtExit(exitAmount))
                      .filter(([className]) => shareClasses.some(sc => 
                        sc.name === className && 
                        transactions.some(tx => tx.shareClassId === sc.id)
                      ))
                      .map(([className, value], index) => {
                        const percentage = (value.total / exitAmount) * 100;
                        return (
                          <tr key={`${className}-${index}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="p-3">{className}</td>
                            <td className="p-3">${formatNumber(value.total, 2)}</td>
                            <td className="p-3">{percentage.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    <tr className="border-t-2 border-gray-200 font-semibold bg-gray-50">
                      <td className="p-3">Total</td>
                      <td className="p-3">${formatNumber(exitAmount, 2)}</td>
                      <td className="p-3">100.00%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Distribution Chart */}
            <div className="bg-white p-6 rounded-xl shadow-inner">
              <h3 className="text-lg font-medium mb-4 text-gray-800">Summary Distribution</h3>
              <div className="mt-4">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={summaryData}
                      margin={{ top: 20, right: 30, left: 120, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis 
                        tickFormatter={(value) => `$${formatNumber(value, 2)}`}
                        width={110}
                        tickCount={8}
                        domain={[0, 'auto']}
                      />
                      <Tooltip 
                        formatter={(value: any, name: string) => [`$${formatNumber(value, 2)}`, name]}
                      />
                      <Legend />
                      {shareClasses
                        .filter(sc => transactions.some(tx => tx.shareClassId === sc.id))
                        .map((sc, index) => {
                          const colors = [
                            "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
                            "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"
                          ];
                          const name = getShareClassById(sc.id)?.name || '';
                          return (
                            <Bar
                              key={`${sc.id}-${index}`}
                              dataKey={name}
                              name={name}
                              stackId="a"
                              fill={colors[index % colors.length]}
                            />
                          );
                        })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Return Analysis Chart */}
            <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardContent className="p-6 space-y-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-600 p-2 rounded-lg">📈</span>
                  Return Analysis
                </h2>

                <div className="h-[500px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={chartData}
                      margin={{ top: 50, right: 50, left: 120, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="exitValue" 
                        tickFormatter={(value) => `$${formatNumber(value, 2)}`}
                        interval="preserveStartEnd"
                        minTickGap={100}
                        height={60}
                        label={{ 
                          value: 'Exit Value ($)', 
                          position: 'insideBottom',
                          offset: -10
                        }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${formatNumber(value, 2)}`}
                        width={110}
                        tickCount={10}
                        label={{ 
                          value: 'Return ($)', 
                          angle: -90, 
                          position: 'insideLeft',
                          offset: -60
                        }}
                        tick={{ fontSize: 12 }}
                        domain={[0, 'auto']}
                      />
                      <Tooltip
                        formatter={(value: any, name: string) => [`$${formatNumber(value, 2)}`, name]}
                        labelFormatter={(value) => `Exit Value: $${formatNumber(value, 2)}`}
                        cursor={{ strokeDasharray: '3 3' }}
                      />
                      <Legend 
                        verticalAlign="top"
                        height={50}
                        wrapperStyle={{
                          paddingTop: "0px",
                          paddingBottom: "30px",
                          fontSize: "14px"
                        }}
                      />
                      {shareClasses
                        .filter(sc => transactions.some(tx => tx.shareClassId === sc.id))
                        .map((sc, index) => {
                          const colors = [
                            "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
                            "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"
                          ];
                          const name = getShareClassById(sc.id)?.name || '';
                          return (
                            <Line
                              key={`${sc.id}-${index}`}
                              type="monotone"
                              dataKey={name}
                              name={name}
                              stroke={colors[index % colors.length]}
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6, strokeWidth: 2 }}
                            />
                          );
                        })}
                      <ReferenceLine
                        x={exitAmount}
                        stroke="#000000"
                        strokeWidth={2}
                        label={{
                          position: "top",
                          value: `Current Exit: $${formatNumber(exitAmount, 2)}`,
                          fill: "#000000",
                          fontSize: 14,
                          fontWeight: "bold"
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WaterfallAnalysisNew;