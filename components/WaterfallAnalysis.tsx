import React from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { formatNumber } from "@/utils/formatNumber";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";

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
  shareClass: string;
  shares: number;
  investment: number;
}

interface WaterfallStep {
  name: string;
  value: number;
  remainingProceeds?: number;
  isStarting?: boolean;
  isFinal?: boolean;
  description?: string;
  shareClass?: string;
}

interface SummaryData {
  name: string;
  payout: number;
  type: string;
  percentage: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: WaterfallStep;
  }>;
}

// Type for ownershipByClass
interface OwnershipByClass {
  [key: string]: number;
}

interface WaterfallStepData {
  isStarting?: boolean;
  isFinal?: boolean;
  value: number;
  name: string;
}

export default function WaterfallAnalysis() {
  const [shareClasses, setShareClasses] = React.useState<ShareClass[]>([
    { id: 1, name: "Series A", seniority: 1, liquidationPref: 1, prefType: "non-participating", cap: null },
    { id: 2, name: "Series B", seniority: 2, liquidationPref: 1.5, prefType: "participating", cap: 3 }
  ]);
  
  const [transactions, setTransactions] = React.useState<Transaction[]>([
    { id: 1, shareClass: "Series A", shares: 1000000, investment: 1000000 },
    { id: 2, shareClass: "Series B", shares: 500000, investment: 2000000 }
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
    shareClass: "",
    shares: 0,
    investment: 0
  });

  const addShareClass = () => {
    if (newShareClass.name.trim() === "" || !newShareClass.prefType) return;
    
    const nextId = Math.max(...shareClasses.map(sc => sc.id), 0) + 1;
    setShareClasses(prev => [
      ...prev,
      { 
        ...newShareClass,
        id: nextId
      }
    ]);
    
    setNewShareClass({ 
      id: 0,
      name: "", 
      seniority: 1, 
      liquidationPref: 1, 
      prefType: "non-participating", 
      cap: null 
    });
  };

  const addTransaction = () => {
    if (newTransaction.shareClass === "" || newTransaction.investment <= 0) return;
    
    const nextId = Math.max(...transactions.map(tx => tx.id), 0) + 1;
    setTransactions([
      ...transactions,
      {
        ...newTransaction,
        id: nextId
      }
    ]);
  };

  const deleteShareClass = (id: number) => {
    setShareClasses(shareClasses.filter(sc => sc.id !== id));
    setTransactions(transactions.filter(tx => tx.shareClass !== shareClasses.find(sc => sc.id === id)?.name));
  };

  const deleteTransaction = (id: number) => {
    setTransactions(transactions.filter(tx => tx.id !== id));
  };
  
  const calculateDetailedWaterfall = (): WaterfallStep[] => {
    let results: WaterfallStep[] = [];
    let remainingProceeds = exitAmount;
    
    // Start with total proceeds
    results.push({
      name: "Total Exit Proceeds",
      value: exitAmount,
      remainingProceeds: remainingProceeds,
      isStarting: true
    });
    
    // Clone and sort share classes by seniority (highest first)
    const sortedClasses = [...shareClasses]
      .filter(sc => sc.name !== "Common")
      .sort((a, b) => b.seniority - a.seniority);
    
    // Calculate total ownership percentages
    const totalShares = transactions.reduce((sum, tx) => sum + tx.shares, 0);
    const ownershipByClass: OwnershipByClass = {};
    
    transactions.forEach(tx => {
      if (!ownershipByClass[tx.shareClass]) {
        ownershipByClass[tx.shareClass] = 0;
      }
      ownershipByClass[tx.shareClass] += tx.shares / totalShares;
    });
    
    // First, allocate based on liquidation preferences
    for (const sc of sortedClasses) {
      if (remainingProceeds <= 0) break;

      const transactionsForClass = transactions.filter(tx => tx.shareClass === sc.name);
      let totalInvestment = transactionsForClass.reduce((sum, tx) => sum + tx.investment, 0);
      let liquidationPrefAmount = totalInvestment * sc.liquidationPref;
      
      if (sc.prefType === "non-participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        let ownershipPayout = ownershipByClass[sc.name] * exitAmount;
        let finalPayout = Math.min(Math.max(prefPayout, ownershipPayout), remainingProceeds);
        let payoutType = finalPayout === prefPayout ? "Liquidation Preference" : "Pro-rata Ownership";
        
        if (finalPayout > 0) {
        results.push({ 
          name: `${sc.name} (${payoutType})`, 
          value: -finalPayout,
            description: `${sc.name} receives ${payoutType} of $${formatNumber(finalPayout)}`,
            remainingProceeds: remainingProceeds - finalPayout,
          shareClass: sc.name
        });
        
          remainingProceeds = Math.max(0, remainingProceeds - finalPayout);
        }
      } else if (sc.prefType === "participating") {
        // First, liquidation preference
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        
        if (prefPayout > 0) {
        results.push({ 
          name: `${sc.name} (Liquidation Pref)`, 
          value: -prefPayout,
            description: `${sc.name} receives liquidation preference of $${formatNumber(prefPayout)}`,
            remainingProceeds: remainingProceeds - prefPayout,
          shareClass: sc.name
        });
        
          remainingProceeds = Math.max(0, remainingProceeds - prefPayout);
        }
        
        // Then, participation if there are remaining proceeds
        if (remainingProceeds > 0) {
          let participationAmount = remainingProceeds * ownershipByClass[sc.name];
          
          if (sc.cap && sc.cap > 0) {
            const capAmount = totalInvestment * sc.cap;
            const totalPayout = prefPayout + participationAmount;
            if (totalPayout > capAmount) {
              participationAmount = Math.max(0, Math.min(capAmount - prefPayout, remainingProceeds));
            }
          }
          
          if (participationAmount > 0) {
            participationAmount = Math.min(participationAmount, remainingProceeds);
            results.push({ 
              name: `${sc.name} (Participation)`, 
              value: -participationAmount,
              description: `${sc.name} receives participation of $${formatNumber(participationAmount)}`,
              remainingProceeds: remainingProceeds - participationAmount,
              shareClass: sc.name
            });
            
            remainingProceeds = Math.max(0, remainingProceeds - participationAmount);
          }
        }
      }
    }
    
    // Final balance (will always be >= 0)
    if (remainingProceeds > 0) {
      results.push({ 
        name: "Remaining",
        value: remainingProceeds,
        remainingProceeds: 0,
        isFinal: true,
        description: `Remaining amount: $${formatNumber(remainingProceeds)}`
      });
    }
    
    return results;
  };
  
  const calculateSummaryWaterfall = (): SummaryData[] => {
    let tempResults: Array<{name: string; payout: number; type: string}> = [];
    let remainingProceeds = exitAmount;
    
    // Clone and sort share classes by seniority (highest first)
    const sortedClasses = [...shareClasses]
      .filter(sc => sc.name !== "Common")
      .sort((a, b) => b.seniority - a.seniority);
    
    // Calculate total ownership percentages
    const totalShares = transactions.reduce((sum, tx) => sum + tx.shares, 0);
    const ownershipByClass: OwnershipByClass = {};
    
    transactions.forEach(tx => {
      if (!ownershipByClass[tx.shareClass]) {
        ownershipByClass[tx.shareClass] = 0;
      }
      ownershipByClass[tx.shareClass] += tx.shares / totalShares;
    });
    
    // First, allocate based on liquidation preferences
    for (const sc of sortedClasses) {
      if (remainingProceeds <= 0) {
        tempResults.push({ name: sc.name, payout: 0, type: "No Proceeds Available" });
        continue;
      }

      const transactionsForClass = transactions.filter(tx => tx.shareClass === sc.name);
      let totalInvestment = transactionsForClass.reduce((sum, tx) => sum + tx.investment, 0);
      let liquidationPrefAmount = totalInvestment * sc.liquidationPref;
      
      if (sc.prefType === "non-participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        let ownershipPayout = ownershipByClass[sc.name] * exitAmount;
        let finalPayout = Math.min(Math.max(prefPayout, ownershipPayout), remainingProceeds);
        
        tempResults.push({ 
          name: sc.name, 
          payout: finalPayout, 
          type: finalPayout === prefPayout ? "Liquidation Preference" : "Pro-rata Ownership" 
        });
        
        remainingProceeds = Math.max(0, remainingProceeds - finalPayout);
      } else if (sc.prefType === "participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        remainingProceeds = Math.max(0, remainingProceeds - prefPayout);
        
        let participationAmount = 0;
        if (remainingProceeds > 0) {
          participationAmount = remainingProceeds * ownershipByClass[sc.name];
          
          if (sc.cap && sc.cap > 0) {
            const capAmount = totalInvestment * sc.cap;
            const totalPayout = prefPayout + participationAmount;
            if (totalPayout > capAmount) {
              participationAmount = Math.max(0, Math.min(capAmount - prefPayout, remainingProceeds));
            }
          }
          
          participationAmount = Math.min(participationAmount, remainingProceeds);
          remainingProceeds = Math.max(0, remainingProceeds - participationAmount);
        }
        
        tempResults.push({ 
          name: sc.name, 
          payout: prefPayout + participationAmount, 
          type: "Participating Preferred" 
        });
      }
    }
    
    // Only add Common if it exists in shareClasses and has transactions
    const commonClass = shareClasses.find(sc => sc.name === "Common");
    const commonTransactions = transactions.filter(tx => tx.shareClass === "Common");
    if (commonClass && commonTransactions.length > 0 && remainingProceeds > 0) {
    tempResults.push({ 
      name: "Common", 
        payout: remainingProceeds, 
      type: "Ownership" 
    });
      remainingProceeds = 0;
    }
    
    // If there are still remaining proceeds, add them as a separate entry
    if (remainingProceeds > 0) {
      tempResults.push({
        name: "Unallocated",
        payout: remainingProceeds,
        type: "Remaining"
      });
    }
    
    // Convert to final format with percentages
    return tempResults.map(r => ({
      ...r,
      payout: Math.round(r.payout * 100) / 100,
      percentage: Math.round((r.payout / exitAmount) * 10000) / 100
    }));
  };

  const waterfallSteps = calculateDetailedWaterfall();
  const summaryData = calculateSummaryWaterfall();
  
  // Custom tooltip for the waterfall chart
  const CustomWaterfallTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          {data.description ? (
            <p className="text-sm">{data.description}</p>
          ) : data.isStarting ? (
            <p className="text-sm">Starting amount: ${formatNumber(data.value)}</p>
          ) : data.isFinal ? (
            <p className="text-sm">Remaining amount: ${formatNumber(data.value)}</p>
          ) : (
            <p className="text-sm">{data.name}: ${formatNumber(Math.abs(data.value))}</p>
          )}
          {typeof data.remainingProceeds !== 'undefined' && (
            <p className="text-sm font-semibold">
              Remaining: ${formatNumber(data.remainingProceeds)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const updateTransaction = (id: number, field: keyof Transaction, value: number | string) => {
    setTransactions(transactions.map(tx => {
      if (tx.id === id) {
        return {
          ...tx,
          [field]: typeof value === 'string' ? value : (value || 0)
        };
      }
      return tx;
    }));
  };

  const updateShareClass = (id: number, field: keyof ShareClass, value: number | string | null) => {
    setShareClasses(shareClasses.map(sc => {
      if (sc.id === id) {
        return {
          ...sc,
          [field]: field === 'prefType' ? value as "non-participating" | "participating" :
                   field === 'cap' ? (value === null ? null : Number(value)) :
                   typeof value === 'string' ? value : (Number(value) || 1)
        };
      }
      return sc;
    }));
  };

  const getBarFill = (data: WaterfallStepData): string => {
    if (data.isStarting) return "#22C55E";
    if (data.isFinal) return "#86EFAC";
    return data.value < 0 ? "#15803D" : "#22C55E";
  };

  return (
    <div className="p-4 space-y-6 container mx-auto">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
        Waterfall Analysis
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Share Classes Management */}
        <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="bg-blue-100 text-blue-600 p-2 rounded-lg">📊</span>
              Share Classes
            </h2>

            {/* Move the new share class form to the top */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                  <Label htmlFor="new-class-name" className="text-sm font-medium">Name</Label>
                  <Input
                    id="new-class-name"
                    value={newShareClass.name}
                    onChange={(e) => setNewShareClass({...newShareClass, name: e.target.value})}
                    placeholder="e.g. Series A"
                    className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-seniority" className="flex items-center gap-2 text-sm font-medium">
                    Seniority
                    <span 
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 transition-colors duration-200 cursor-help text-sm" 
                      title="Higher seniority numbers (like 2, 3) mean the share class gets paid before lower numbers (like 1). For example, Series B with seniority 2 gets paid before Series A with seniority 1."
                    >
                      ℹ️
                    </span>
                  </Label>
                  <Input
                    id="new-seniority"
                    type="number"
                    min="1"
                    value={newShareClass.seniority || ""}
                    onChange={(e) => setNewShareClass({...newShareClass, seniority: parseInt(e.target.value) || 0})}
                    placeholder="e.g. 1"
                    className="h-10 w-full bg-white border-gray-200 focus:border-blue-500 text-base px-3"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-liquidation-pref" className="text-sm font-medium">Liquidation Pref</Label>
                  <Input
                    id="new-liquidation-pref"
                    type="number"
                    min="0"
                    step="0.1"
                    value={newShareClass.liquidationPref || ""}
                    onChange={(e) => setNewShareClass({...newShareClass, liquidationPref: parseFloat(e.target.value) || 0})}
                    placeholder="e.g. 1.0"
                    className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-pref-type" className="text-sm font-medium">Preference Type</Label>
                  <Select
                    value={newShareClass.prefType}
                    onValueChange={(value: "non-participating" | "participating") => 
                      setNewShareClass({...newShareClass, prefType: value})}
                  >
                    <SelectTrigger className="h-10 w-full bg-white border-gray-200 hover:bg-gray-50">
                      <SelectValue placeholder="Select preference type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non-participating">Non-Participating</SelectItem>
                      <SelectItem value="participating">Participating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {newShareClass.prefType === "participating" && (
                  <div className="space-y-2">
                    <Label htmlFor="new-cap" className="text-sm font-medium">Cap</Label>
                    <Input
                      id="new-cap"
                      type="number"
                      min="0"
                      step="0.1"
                      value={newShareClass.cap || ""}
                      onChange={(e) => setNewShareClass({...newShareClass, cap: e.target.value ? parseFloat(e.target.value) : null})}
                      placeholder="No cap"
                      className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
              
              <Button onClick={addShareClass} className="w-full bg-black hover:bg-gray-800 h-10">Add Share Class</Button>
            </div>
            
            {/* Share Classes table */}
            {shareClasses.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full mt-6">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 text-gray-600 font-medium rounded-l-lg w-[20%]">Name</th>
                      <th className="text-left p-3 text-gray-600 font-medium w-[20%]">Seniority</th>
                      <th className="text-left p-3 text-gray-600 font-medium w-[20%]">Liquidation Pref</th>
                      <th className="text-left p-3 text-gray-600 font-medium w-[25%]">Type</th>
                      <th className="text-left p-3 text-gray-600 font-medium w-[15%]">Cap</th>
                      <th className="text-left p-3 text-gray-600 font-medium rounded-r-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shareClasses.map((sc) => (
                    <tr key={sc.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="p-3">
                        <Input
                          type="text"
                          value={sc.name}
                          onChange={(e) => updateShareClass(sc.id, 'name', e.target.value)}
                          className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={sc.seniority}
                            onChange={(e) => updateShareClass(sc.id, 'seniority', e.target.value)}
                            className="h-10 w-full bg-white border-gray-200 focus:border-blue-500 text-base px-3"
                          />
                          <span 
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 transition-colors duration-200 cursor-help text-sm flex-shrink-0" 
                            title="Higher seniority numbers (like 2, 3) mean the share class gets paid before lower numbers (like 1). For example, Series B with seniority 2 gets paid before Series A with seniority 1."
                          >
                            ℹ️
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="1"
                          step="0.1"
                          value={sc.liquidationPref}
                          onChange={(e) => updateShareClass(sc.id, 'liquidationPref', e.target.value)}
                          className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                        />
                      </td>
                      <td className="p-3">
                        <Select
                          value={sc.prefType}
                          onValueChange={(value: "non-participating" | "participating") => updateShareClass(sc.id, 'prefType', value)}
                        >
                          <SelectTrigger className="h-10 w-full bg-white border-gray-200 hover:bg-gray-50">
                            <SelectValue placeholder="Select preference type">
                              {sc.prefType === "non-participating" ? "Non-Part." : sc.prefType === "participating" ? "Part." : ""}
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
                            min="0"
                            step="0.1"
                            value={sc.cap || ""}
                            onChange={(e) => updateShareClass(sc.id, 'cap', e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="No cap"
                            className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Button variant="destructive" size="sm" onClick={() => deleteShareClass(sc.id)} className="w-full h-10">
                          Delete
                        </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Transactions Management */}
        <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="bg-green-100 text-green-600 p-2 rounded-lg">💰</span>
              Transactions
            </h2>
            
            {/* Update new transaction form layout */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
                  <Label htmlFor="txShareClass" className="text-sm font-medium">Share Class</Label>
                  <Select
                    value={newTransaction.shareClass}
                    onValueChange={(value: string) => setNewTransaction({...newTransaction, shareClass: value})}
                  >
                    <SelectTrigger className="h-10 w-full bg-white border-gray-200 hover:bg-gray-50">
                      <SelectValue placeholder="Select a share class" />
                    </SelectTrigger>
                    <SelectContent>
                      {shareClasses.map((sc) => (
                        <SelectItem key={sc.id} value={sc.name}>{sc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shares" className="text-sm font-medium">Shares</Label>
                  <Input
                    id="shares"
                    type="text"
                    value={newTransaction.shares || ""}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                      setNewTransaction({...newTransaction, shares: isNaN(value) ? 0 : value});
                    }}
                    placeholder="e.g. 1,000,000"
                    className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="txInvestment" className="text-sm font-medium">Investment Amount</Label>
                  <Input
                    id="txInvestment"
                    type="text"
                    value={newTransaction.investment || ""}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                      setNewTransaction({...newTransaction, investment: isNaN(value) ? 0 : value});
                    }}
                    placeholder="e.g. 1,000,000"
                    className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="pt-[72px]">
                <Button onClick={addTransaction} className="w-full bg-black hover:bg-gray-800 h-10">Add Transaction</Button>
              </div>
            </div>
            
            {/* Update transactions table layout */}
            {transactions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full mt-6">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-3 text-gray-600 font-medium rounded-l-lg w-[35%]">Share Class</th>
                      <th className="text-left p-3 text-gray-600 font-medium w-[25%]">Shares</th>
                      <th className="text-left p-3 text-gray-600 font-medium w-[25%]">Investment</th>
                      <th className="text-left p-3 text-gray-600 font-medium rounded-r-lg w-[15%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="p-3">
                        <Select
                          value={tx.shareClass}
                          onValueChange={(value: string) => updateTransaction(tx.id, 'shareClass', value)}
                        >
                          <SelectTrigger className="h-10 w-full bg-white border-gray-200 hover:bg-gray-50">
                            <SelectValue>{tx.shareClass}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {shareClasses.map((sc) => (
                              <SelectItem key={sc.id} value={sc.name}>{sc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Input
                          type="text"
                          value={formatNumber(tx.shares)}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                            updateTransaction(tx.id, 'shares', isNaN(value) ? 0 : value);
                          }}
                          className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
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
                          className="h-10 w-full bg-white border-gray-200 focus:border-blue-500"
                        />
                      </td>
                      <td className="p-3">
                        <Button variant="destructive" size="sm" onClick={() => deleteTransaction(tx.id)} className="w-full h-10">
                          Delete
                        </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                value={exitAmount || ""}
                onChange={(e) => {
                  const value = parseFloat(e.target.value.replace(/[^0-9]/g, ''));
                  setExitAmount(isNaN(value) ? 0 : value);
                }}
                placeholder="e.g. 10,000,000"
                className="w-44 bg-white"
              />
            </div>
          </div>
          
          {/* Update chart containers with modern styling */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-inner">
              <h3 className="text-lg font-medium mb-4 text-gray-800">Summary Distribution</h3>
              <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                      formatter={(value: ValueType) => {
                        if (typeof value === 'number') {
                          return [`$${formatNumber(value)}`, 'Payout'];
                        }
                        return ['$0', 'Payout'];
                      }}
                    labelFormatter={(name) => `${name}`}
                  />
                  <Legend />
                  <Bar dataKey="payout" name="Payout Amount ($)" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
            <div className="bg-white p-6 rounded-xl shadow-inner">
              <h3 className="text-lg font-medium mb-4 text-gray-800">Step-by-Step Waterfall Distribution</h3>
              <div className="h-80 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={waterfallSteps}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip content={<CustomWaterfallTooltip />} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#000" />
                  <Bar 
                    dataKey="value" 
                    name="Amount" 
                      fill={getBarFill as any}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            </div>

            {/* Update the legend styling */}
            <div className="mt-4 bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
              <p className="font-medium mb-2">Chart Legend:</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-green-500 rounded"></span>
                  Starting exit amount
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-blue-500 rounded"></span>
                  Distributions to share classes
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-gray-300 rounded"></span>
                  Remaining proceeds
                </li>
              </ul>
          </div>
          
            {/* Update summary table styling */}
            <div className="bg-white p-6 rounded-xl shadow-inner">
              <h3 className="text-lg font-medium mb-4 text-gray-800">Distribution Summary</h3>
            <div className="overflow-x-auto">
                  <table className="w-full">
                <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-3 text-gray-600 font-medium rounded-l-lg">Share Class</th>
                        <th className="text-left p-3 text-gray-600 font-medium">Amount ($)</th>
                        <th className="text-left p-3 text-gray-600 font-medium rounded-r-lg">Percentage</th>
                  </tr>
                </thead>
                    <tbody className="divide-y divide-gray-100">
                  {summaryData.map((result, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="p-3">{result.name}</td>
                          <td className="p-3">${formatNumber(result.payout)}</td>
                          <td className="p-3">{result.percentage}%</td>
                    </tr>
                  ))}
                      <tr className="font-bold bg-gray-50">
                        <td className="p-3 rounded-bl-lg">Total</td>
                        <td className="p-3">${formatNumber(exitAmount)}</td>
                        <td className="p-3 rounded-br-lg">100%</td>
                  </tr>
                </tbody>
              </table>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}