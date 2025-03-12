import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

const WaterfallAnalysis = () => {
  const [shareClasses, setShareClasses] = useState([
    { id: 1, name: "Series A", seniority: 1, liquidationPref: 1, prefType: "non-participating", cap: null },
    { id: 2, name: "Series B", seniority: 2, liquidationPref: 1.5, prefType: "participating", cap: 3 }
  ]);
  
  const [transactions, setTransactions] = useState([
    { id: 1, shareClass: "Series A", shares: 1000000, investment: 1000000 },
    { id: 2, shareClass: "Series B", shares: 500000, investment: 2000000 }
  ]);
  
  const [exitAmount, setExitAmount] = useState(10000000);
  const [newShareClass, setNewShareClass] = useState({ 
    name: "", 
    seniority: 1, 
    liquidationPref: 1, 
    prefType: "non-participating", 
    cap: null 
  });
  
  const [newTransaction, setNewTransaction] = useState({
    shareClass: "",
    shares: 0,
    investment: 0
  });

  const addShareClass = () => {
    if (newShareClass.name.trim() === "") return;
    
    setShareClasses([
      ...shareClasses,
      { 
        id: shareClasses.length + 1, 
        ...newShareClass 
      }
    ]);
    
    setNewShareClass({ 
      name: "", 
      seniority: 1, 
      liquidationPref: 1, 
      prefType: "non-participating", 
      cap: null 
    });
  };

  const addTransaction = () => {
    if (newTransaction.shareClass === "" || newTransaction.investment <= 0) return;
    
    setTransactions([
      ...transactions,
      {
        id: transactions.length + 1,
        ...newTransaction
      }
    ]);
    
    setNewTransaction({
      shareClass: "",
      shares: 0,
      investment: 0
    });
  };

  const deleteShareClass = (id) => {
    setShareClasses(shareClasses.filter(sc => sc.id !== id));
    setTransactions(transactions.filter(tx => tx.shareClass !== shareClasses.find(sc => sc.id === id)?.name));
  };

  const deleteTransaction = (id) => {
    setTransactions(transactions.filter(tx => tx.id !== id));
  };
  
  const calculateDetailedWaterfall = () => {
    let results = [];
    let remainingProceeds = exitAmount;
    let runningTotal = 0;
    
    // Start with total proceeds
    results.push({
      name: "Total Exit Proceeds",
      value: exitAmount,
      remainingProceeds: remainingProceeds,
      isStarting: true
    });
    
    // Clone and sort share classes by seniority (highest first)
    const sortedClasses = [...shareClasses].sort((a, b) => b.seniority - a.seniority);
    
    // Calculate total ownership percentages
    const totalShares = transactions.reduce((sum, tx) => sum + (parseFloat(tx.shares) || 0), 0);
    const ownershipByClass = {};
    
    transactions.forEach(tx => {
      if (!ownershipByClass[tx.shareClass]) {
        ownershipByClass[tx.shareClass] = 0;
      }
      ownershipByClass[tx.shareClass] += (parseFloat(tx.shares) || 0) / totalShares;
    });
    
    // First, allocate based on liquidation preferences
    for (const sc of sortedClasses) {
      const transactionsForClass = transactions.filter(tx => tx.shareClass === sc.name);
      let totalInvestment = transactionsForClass.reduce((sum, tx) => sum + parseFloat(tx.investment || 0), 0);
      let liquidationPrefAmount = totalInvestment * parseFloat(sc.liquidationPref || 1);
      
      if (remainingProceeds <= 0) {
        results.push({ 
          name: `${sc.name} (No Remaining Proceeds)`, 
          value: 0,
          description: `No remaining proceeds for ${sc.name}`,
          remainingProceeds,
          shareClass: sc.name
        });
        continue;
      }
      
      if (sc.prefType === "non-participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        // Calculate ownership payout based on the CURRENT remaining proceeds, not the original exit amount
        let ownershipPayout = ownershipByClass[sc.name] * remainingProceeds;
        
        // Non-participating prefers the greater of its preference or pro-rata share
        let finalPayout = Math.max(prefPayout, ownershipPayout);
        let payoutType = finalPayout === prefPayout ? "Liquidation Preference" : "Pro-rata Ownership";
        
        // Add to results
        results.push({ 
          name: `${sc.name} (${payoutType})`, 
          value: -finalPayout,
          description: `${sc.name} receives ${payoutType} of $${finalPayout.toLocaleString()}`,
          remainingProceeds,
          shareClass: sc.name
        });
        
        remainingProceeds -= finalPayout;
        runningTotal += finalPayout;
      } else if (sc.prefType === "participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        
        // Add liquidation preference payout
        results.push({ 
          name: `${sc.name} (Liquidation Pref)`, 
          value: -prefPayout,
          description: `${sc.name} receives liquidation preference of $${prefPayout.toLocaleString()}`,
          remainingProceeds,
          shareClass: sc.name
        });
        
        remainingProceeds -= prefPayout;
        runningTotal += prefPayout;
        
        // Calculate participation
        if (remainingProceeds > 0) {
          let participationAmount = remainingProceeds * ownershipByClass[sc.name];
          
          // Apply cap if exists
          if (sc.cap && sc.cap > 0) {
            const capAmount = totalInvestment * parseFloat(sc.cap);
            const maxParticipation = capAmount - prefPayout;
            
            if (participationAmount > maxParticipation) {
              results.push({ 
                name: `${sc.name} (Participation - Capped)`, 
                value: -maxParticipation,
                description: `${sc.name} receives capped participation of $${maxParticipation.toLocaleString()}`,
                remainingProceeds,
                shareClass: sc.name
              });
              
              remainingProceeds -= maxParticipation;
              runningTotal += maxParticipation;
            } else {
              results.push({ 
                name: `${sc.name} (Participation)`, 
                value: -participationAmount,
                description: `${sc.name} receives participation of $${participationAmount.toLocaleString()}`,
                remainingProceeds,
                shareClass: sc.name
              });
              
              remainingProceeds -= participationAmount;
              runningTotal += participationAmount;
            }
          } else {
            results.push({ 
              name: `${sc.name} (Participation)`, 
              value: -participationAmount,
              description: `${sc.name} receives participation of $${participationAmount.toLocaleString()}`,
              remainingProceeds,
              shareClass: sc.name
            });
            
            remainingProceeds -= participationAmount;
            runningTotal += participationAmount;
          }
        }
      }
    }
    
    // Remaining goes to common
    if (remainingProceeds > 0) {
      results.push({ 
        name: "Common Shareholders", 
        value: -remainingProceeds,
        description: `Common shareholders receive $${remainingProceeds.toLocaleString()}`,
        remainingProceeds,
        shareClass: "Common"
      });
      
      runningTotal += remainingProceeds;
      remainingProceeds = 0;
    }
    
    // Final balance (should be zero)
    results.push({
      name: "Remaining",
      value: remainingProceeds,
      remainingProceeds: 0,
      isFinal: true
    });
    
    return results;
  };
  
  const calculateSummaryWaterfall = () => {
    let results = [];
    let remainingProceeds = exitAmount;
    
    // Clone and sort share classes by seniority (highest first)
    const sortedClasses = [...shareClasses].sort((a, b) => b.seniority - a.seniority);
    
    // Calculate total ownership percentages
    const totalShares = transactions.reduce((sum, tx) => sum + (parseFloat(tx.shares) || 0), 0);
    const ownershipByClass = {};
    
    transactions.forEach(tx => {
      if (!ownershipByClass[tx.shareClass]) {
        ownershipByClass[tx.shareClass] = 0;
      }
      ownershipByClass[tx.shareClass] += (parseFloat(tx.shares) || 0) / totalShares;
    });
    
    // First, allocate based on liquidation preferences
    for (const sc of sortedClasses) {
      const transactionsForClass = transactions.filter(tx => tx.shareClass === sc.name);
      let totalInvestment = transactionsForClass.reduce((sum, tx) => sum + parseFloat(tx.investment || 0), 0);
      let liquidationPrefAmount = totalInvestment * parseFloat(sc.liquidationPref || 1);
      
      if (remainingProceeds <= 0) {
        results.push({ name: sc.name, payout: 0, type: "Liquidation Preference" });
        continue;
      }
      
      if (sc.prefType === "non-participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        // Calculate ownership payout based on the REMAINING proceeds, not the original exit amount
        let ownershipPayout = ownershipByClass[sc.name] * remainingProceeds;
        
        // Non-participating prefers the greater of its preference or pro-rata share
        let finalPayout = Math.max(prefPayout, ownershipPayout);
        
        results.push({ 
          name: sc.name, 
          payout: finalPayout, 
          type: finalPayout === prefPayout ? "Liquidation Preference" : "Ownership" 
        });
        
        remainingProceeds -= finalPayout;
      } else if (sc.prefType === "participating") {
        let prefPayout = Math.min(liquidationPrefAmount, remainingProceeds);
        remainingProceeds -= prefPayout;
        
        let participationAmount = 0;
        
        // Calculate participation
        if (remainingProceeds > 0) {
          participationAmount = remainingProceeds * ownershipByClass[sc.name];
          
          // Apply cap if exists
          if (sc.cap && sc.cap > 0) {
            const capAmount = totalInvestment * parseFloat(sc.cap);
            participationAmount = Math.min(participationAmount, capAmount - prefPayout);
          }
          
          remainingProceeds -= participationAmount;
        }
        
        results.push({ 
          name: sc.name, 
          payout: prefPayout + participationAmount, 
          type: "Participating Preferred" 
        });
      }
    }
    
    // Remaining goes to common
    if (remainingProceeds > 0) {
      results.push({ 
        name: "Common", 
        payout: remainingProceeds, 
        type: "Ownership" 
      });
    } else {
      results.push({ 
        name: "Common", 
        payout: 0, 
        type: "Ownership" 
      });
    }
    
    return results.map(r => ({
      ...r,
      payout: Math.round(r.payout * 100) / 100, // Round to 2 decimal places
      percentage: Math.round((r.payout / exitAmount) * 10000) / 100 // Calculate percentage
    }));
  };

  const waterfallSteps = calculateDetailedWaterfall();
  const summaryData = calculateSummaryWaterfall();
  
  // Custom tooltip for the waterfall chart
  const CustomWaterfallTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          {data.description ? (
            <p className="text-sm">{data.description}</p>
          ) : data.isStarting ? (
            <p className="text-sm">Starting amount: ${data.value.toLocaleString()}</p>
          ) : data.isFinal ? (
            <p className="text-sm">Remaining amount: ${data.value.toLocaleString()}</p>
          ) : (
            <p className="text-sm">{data.name}: ${Math.abs(data.value).toLocaleString()}</p>
          )}
          {typeof data.remainingProceeds !== 'undefined' && (
            <p className="text-sm font-semibold">
              Remaining: ${data.remainingProceeds.toLocaleString()}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Waterfall Analysis</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Share Classes Management */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Share Classes</h2>
            
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label htmlFor="className">Name</Label>
                  <Input
                    id="className"
                    value={newShareClass.name}
                    onChange={(e) => setNewShareClass({...newShareClass, name: e.target.value})}
                    placeholder="Series A"
                  />
                </div>
                
                <div>
                  <Label htmlFor="seniority">Seniority</Label>
                  <Input
                    id="seniority"
                    type="number"
                    min="1"
                    value={newShareClass.seniority}
                    onChange={(e) => setNewShareClass({...newShareClass, seniority: parseInt(e.target.value) || 1})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="liquidationPref">Liquidation Pref</Label>
                  <Input
                    id="liquidationPref"
                    type="number"
                    min="1"
                    step="0.1"
                    value={newShareClass.liquidationPref}
                    onChange={(e) => setNewShareClass({...newShareClass, liquidationPref: parseFloat(e.target.value) || 1})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="prefType">Preference Type</Label>
                  <Select
                    value={newShareClass.prefType}
                    onValueChange={(value) => setNewShareClass({...newShareClass, prefType: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non-participating">Non-Participating</SelectItem>
                      <SelectItem value="participating">Participating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {newShareClass.prefType === "participating" && (
                  <div className="col-span-2">
                    <Label htmlFor="cap">Cap (multiple of investment)</Label>
                    <Input
                      id="cap"
                      type="number"
                      min="0"
                      step="0.1"
                      value={newShareClass.cap || ""}
                      onChange={(e) => setNewShareClass({...newShareClass, cap: e.target.value ? parseFloat(e.target.value) : null})}
                      placeholder="No cap"
                    />
                  </div>
                )}
              </div>
              
              <Button onClick={addShareClass}>Add Share Class</Button>
            </div>
            
            {shareClasses.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Seniority</th>
                      <th className="text-left p-2">Liquidation Pref</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Cap</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shareClasses.map((sc) => (
                      <tr key={sc.id} className="border-b">
                        <td className="p-2">{sc.name}</td>
                        <td className="p-2">{sc.seniority}</td>
                        <td className="p-2">{sc.liquidationPref}x</td>
                        <td className="p-2">{sc.prefType === "non-participating" ? "Non-Part." : "Part."}</td>
                        <td className="p-2">{sc.cap ? `${sc.cap}x` : "No cap"}</td>
                        <td className="p-2">
                          <Button variant="destructive" size="sm" onClick={() => deleteShareClass(sc.id)}>Delete</Button>
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
        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="text-lg font-semibold">Transactions</h2>
            
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="txShareClass">Share Class</Label>
                  <Select
                    value={newTransaction.shareClass}
                    onValueChange={(value) => setNewTransaction({...newTransaction, shareClass: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {shareClasses.map((sc) => (
                        <SelectItem key={sc.id} value={sc.name}>{sc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="shares">Shares</Label>
                  <Input
                    id="shares"
                    type="number"
                    min="0"
                    value={newTransaction.shares}
                    onChange={(e) => setNewTransaction({...newTransaction, shares: parseFloat(e.target.value) || 0})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="investment">Investment Amount</Label>
                  <Input
                    id="investment"
                    type="number"
                    min="0"
                    value={newTransaction.investment}
                    onChange={(e) => setNewTransaction({...newTransaction, investment: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
              
              <Button onClick={addTransaction}>Add Transaction</Button>
            </div>
            
            {transactions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Share Class</th>
                      <th className="text-left p-2">Shares</th>
                      <th className="text-left p-2">Investment</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b">
                        <td className="p-2">{tx.shareClass}</td>
                        <td className="p-2">{tx.shares.toLocaleString()}</td>
                        <td className="p-2">${tx.investment.toLocaleString()}</td>
                        <td className="p-2">
                          <Button variant="destructive" size="sm" onClick={() => deleteTransaction(tx.id)}>Delete</Button>
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
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Waterfall Results</h2>
            <div className="flex items-center space-x-2">
              <Label htmlFor="exitAmount">Exit Amount ($)</Label>
              <Input
                id="exitAmount"
                type="number"
                min="0"
                value={exitAmount}
                onChange={(e) => setExitAmount(parseFloat(e.target.value) || 0)}
                className="w-40"
              />
            </div>
          </div>
          
          {/* Summary Chart */}
          <div>
            <h3 className="text-md font-medium mb-2">Summary Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [`$${value.toLocaleString()}`, 'Payout']}
                    labelFormatter={(name) => `${name}`}
                  />
                  <Legend />
                  <Bar dataKey="payout" name="Payout Amount ($)" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Step-by-Step Waterfall Chart */}
          <div>
            <h3 className="text-md font-medium mb-2">Step-by-Step Waterfall Distribution</h3>
            <div className="h-80">
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
                    fill={(data) => {
                      if (data.isStarting) return "#10B981"; // Green for starting amount
                      if (data.isFinal) return "#6B7280"; // Gray for final amount
                      if (data.value < 0) return "#3B82F6"; // Blue for payouts
                      return "#10B981"; // Green for positive values
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              <p>This chart shows the flow of exit proceeds through each distribution step.</p>
              <ul className="list-disc pl-4 mt-1">
                <li>Green bar shows the starting exit amount</li>
                <li>Blue bars show distributions to each share class</li>
                <li>Gray bar shows any remaining proceeds (should be zero)</li>
              </ul>
            </div>
          </div>
          
          {/* Summary Table */}
          <div>
            <h3 className="text-md font-medium mb-2">Distribution Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Share Class</th>
                    <th className="text-left p-2">Amount ($)</th>
                    <th className="text-left p-2">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map((result, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{result.name}</td>
                      <td className="p-2">${result.payout.toLocaleString()}</td>
                      <td className="p-2">{result.percentage}%</td>
                    </tr>
                  ))}
                  <tr className="border-b font-bold">
                    <td className="p-2">Total</td>
                    <td className="p-2">${exitAmount.toLocaleString()}</td>
                    <td className="p-2">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WaterfallAnalysis;