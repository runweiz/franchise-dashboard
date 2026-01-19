import React, { useState, useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart } from 'recharts';

// Brand Configuration Data
const BRANDS = [
  { id: 'tcb', name: 'The Captain\'s Boil', cac: 2551, annualSales: 1700000, franchiseFee: 50000, priority: 1, color: '#E63946' },
  { id: 'midori', name: 'Midori', cac: 2532, annualSales: 1200000, franchiseFee: 50000, priority: 2, color: '#2A9D8F' },
  { id: 'hiyogurt', name: 'Hi Yogurt', cac: 2491, annualSales: 600000, franchiseFee: 30000, priority: 3, color: '#F4A261' },
  { id: 'altitude', name: 'Altitude Golf', cac: 4000, annualSales: 1300000, franchiseFee: 30000, priority: 4, color: '#264653' },
  { id: 'noodlebar', name: 'Noodle Bar', cac: 2532, annualSales: 1500000, franchiseFee: 30000, priority: 5, color: '#E9C46A' },
  { id: 'dearsaigon', name: 'Dear Saigon', cac: 2500, annualSales: 1000000, franchiseFee: 50000, priority: 6, color: '#F77F00' },
  { id: 'rumble', name: 'Rumble Boxing', cac: 6000, annualSales: 1500000, franchiseFee: 75000, priority: 7, color: '#D62828' },
  { id: 'bakebe', name: 'Bakebe', cac: 6000, annualSales: 600000, franchiseFee: 30000, priority: 8, color: '#FCBF49' },
  { id: 'glasskitchen', name: 'Glass Kitchen', cac: 6000, annualSales: 1500000, franchiseFee: 50000, priority: 9, color: '#003049' },
];

const MAX_LOCATIONS_PER_BRAND = 100;
const MONTHS_TO_OPEN = 10;
const DAYS_TO_SIGN = 45;
const ROYALTY_RATE = 0.06;
const AD_FEE_RATE = 0.02;
const LOCATION_LIFESPAN_YEARS = 10;

// Priority weights for budget allocation
const PRIORITY_WEIGHTS = {
  1: 0.22, 2: 0.18, 3: 0.15, 4: 0.12, 5: 0.10,
  6: 0.08, 7: 0.06, 8: 0.05, 9: 0.04
};

export default function FranchiseForecastDashboard() {
  const [baseAdsBudget, setBaseAdsBudget] = useState(10000);
  const [reinvestmentRate, setReinvestmentRate] = useState(0.5);
  const [exactBudgetInput, setExactBudgetInput] = useState('10000');
  const [exactRateInput, setExactRateInput] = useState('0.5');
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedBrands, setExpandedBrands] = useState({});

  const toggleBrandExpand = (brandId) => {
    setExpandedBrands(prev => ({
      ...prev,
      [brandId]: !prev[brandId]
    }));
  };

  // Handle exact input changes
  const handleExactBudgetChange = (value) => {
    setExactBudgetInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 8000 && parsed <= 12000) {
      setBaseAdsBudget(parsed);
    }
  };

  const handleExactRateChange = (value) => {
    setExactRateInput(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 1) {
      setReinvestmentRate(parsed);
    }
  };

  // Core forecast calculation
  const forecastData = useMemo(() => {
    const months = 60; // 5 years
    const monthlyData = [];
    
    // Track state for each brand
    const brandState = {};
    BRANDS.forEach(brand => {
      brandState[brand.id] = {
        totalSigned: 0,
        pendingLocations: [], // { signedMonth, opensMonth, annualSales }
        openLocations: [], // { openedMonth, closesMonth, annualSales }
        accumulatedFractional: 0, // accumulate fractional signings
        totalFranchiseFees: 0,
        totalRoyalties: 0,
        totalAdFees: 0,
        totalSystemSales: 0,
        totalAdSpend: 0, // track ad spend per brand
      };
    });

    let cumulativeMetrics = {
      totalLocations: 0,
      totalFranchiseFees: 0,
      totalRoyalties: 0,
      totalAdFees: 0,
      totalAdSpend: 0,
      totalSystemSales: 0,
    };

    for (let month = 1; month <= months; month++) {
      
      // STEP 1: Move pending locations to open if it's their opening month
      BRANDS.forEach(brand => {
        const state = brandState[brand.id];
        const nowOpening = state.pendingLocations.filter(loc => loc.opensMonth === month);
        nowOpening.forEach(loc => {
          state.openLocations.push({
            openedMonth: month,
            closesMonth: month + (LOCATION_LIFESPAN_YEARS * 12),
            annualSales: loc.annualSales
          });
        });
        // Remove from pending
        state.pendingLocations = state.pendingLocations.filter(loc => loc.opensMonth !== month);
      });
      
      // STEP 2: Calculate reinvestment from PREVIOUS month's new signings
      // Reinvestment = projected annual sales of each newly signed location × reinvestment %
      // This happens immediately after signing (not when store opens)
      let reinvestmentFromNewSignings = 0;
      if (month > 1) {
        const prevMonthData = monthlyData[month - 2];
        if (prevMonthData && prevMonthData.newSigningsDetail) {
          prevMonthData.newSigningsDetail.forEach(signing => {
            reinvestmentFromNewSignings += signing.annualSales * (reinvestmentRate / 100);
          });
        }
      }
      
      const totalBudget = baseAdsBudget + reinvestmentFromNewSignings;
      
      // STEP 3: Allocate budget by priority
      const brandAllocations = {};
      BRANDS.forEach(brand => {
        brandAllocations[brand.id] = totalBudget * PRIORITY_WEIGHTS[brand.priority];
      });

      // STEP 4: Calculate new signings per brand based on budget allocation
      let monthNewSignings = 0;
      let monthFranchiseFees = 0;
      let monthRoyalties = 0;
      let monthAdFees = 0;
      let monthSystemSales = 0;
      const newSigningsDetail = []; // Track details of new signings for reinvestment calc

      const brandMonthlyData = {};

      BRANDS.forEach(brand => {
        const state = brandState[brand.id];
        const allocation = brandAllocations[brand.id];
        
        // Track ad spend for this brand
        state.totalAdSpend += allocation;
        
        // Calculate potential new signings (CAC based)
        const potentialSignings = allocation / brand.cac;
        
        // Check if at max capacity
        const remainingCapacity = MAX_LOCATIONS_PER_BRAND - state.totalSigned;
        
        if (remainingCapacity > 0) {
          // Add to accumulated fractional
          state.accumulatedFractional += Math.min(potentialSignings, remainingCapacity);
          
          // Process whole signings from accumulated
          const wholeSignings = Math.floor(state.accumulatedFractional);
          
          for (let i = 0; i < wholeSignings && state.totalSigned < MAX_LOCATIONS_PER_BRAND; i++) {
            state.totalSigned++;
            state.totalFranchiseFees += brand.franchiseFee;
            monthFranchiseFees += brand.franchiseFee;
            monthNewSignings++;
            
            // Track this signing for reinvestment calculation
            newSigningsDetail.push({
              brandId: brand.id,
              annualSales: brand.annualSales
            });
            
            // Queue for opening - opens 10 months after signing
            // The 45 days lead-to-sign is factored into CAC efficiency
            state.pendingLocations.push({
              signedMonth: month,
              opensMonth: month + MONTHS_TO_OPEN,
              annualSales: brand.annualSales
            });
          }
          
          state.accumulatedFractional -= wholeSignings;
        }

        // STEP 5: Calculate this month's revenue from this brand's open locations
        let brandMonthlyRevenue = 0;
        let activeLocations = 0;
        
        state.openLocations.forEach(loc => {
          if (month >= loc.openedMonth && month < loc.closesMonth) {
            const monthlySales = loc.annualSales / 12;
            brandMonthlyRevenue += monthlySales;
            activeLocations++;
          }
        });

        // Calculate royalties (6%) and ad fees (2%) from this month's sales
        const brandRoyalties = brandMonthlyRevenue * ROYALTY_RATE;
        const brandAdFees = brandMonthlyRevenue * AD_FEE_RATE;
        
        state.totalRoyalties += brandRoyalties;
        state.totalAdFees += brandAdFees;
        state.totalSystemSales += brandMonthlyRevenue;
        
        monthRoyalties += brandRoyalties;
        monthAdFees += brandAdFees;
        monthSystemSales += brandMonthlyRevenue;

        brandMonthlyData[brand.id] = {
          signed: state.totalSigned,
          pending: state.pendingLocations.length,
          open: activeLocations,
          monthlyRevenue: brandMonthlyRevenue,
          monthlyRoyalties: brandRoyalties,
          monthlyAdFees: brandAdFees,
          monthlyAdSpend: allocation,
          totalFees: state.totalFranchiseFees,
          totalRoyalties: state.totalRoyalties,
          totalAdFees: state.totalAdFees,
          totalSystemSales: state.totalSystemSales,
          totalAdSpend: state.totalAdSpend,
        };
      });

      cumulativeMetrics.totalLocations += monthNewSignings;
      cumulativeMetrics.totalFranchiseFees += monthFranchiseFees;
      cumulativeMetrics.totalRoyalties += monthRoyalties;
      cumulativeMetrics.totalAdFees += monthAdFees;
      cumulativeMetrics.totalAdSpend += totalBudget;
      cumulativeMetrics.totalSystemSales += monthSystemSales;

      // Count total open locations across all brands
      let totalOpenLocations = 0;
      BRANDS.forEach(brand => {
        totalOpenLocations += brandState[brand.id].openLocations.filter(
          loc => month >= loc.openedMonth && month < loc.closesMonth
        ).length;
      });

      monthlyData.push({
        month,
        year: Math.ceil(month / 12),
        monthLabel: `Y${Math.ceil(month / 12)}M${((month - 1) % 12) + 1}`,
        adsBudget: totalBudget,
        baseBudget: baseAdsBudget,
        reinvestment: reinvestmentFromNewSignings,
        newSignings: monthNewSignings,
        newSigningsDetail: newSigningsDetail, // Store for next month's reinvestment calc
        cumulativeSignings: cumulativeMetrics.totalLocations,
        openLocations: totalOpenLocations,
        monthlyFranchiseFees: monthFranchiseFees,
        cumulativeFranchiseFees: cumulativeMetrics.totalFranchiseFees,
        monthlyRoyalties: monthRoyalties,
        cumulativeRoyalties: cumulativeMetrics.totalRoyalties,
        monthlyAdFees: monthAdFees,
        cumulativeAdFees: cumulativeMetrics.totalAdFees,
        monthlySystemSales: monthSystemSales,
        cumulativeSystemSales: cumulativeMetrics.totalSystemSales,
        cumulativeAdSpend: cumulativeMetrics.totalAdSpend,
        brands: brandMonthlyData,
      });
    }

    // Calculate yearly summaries
    const yearlySummary = [];
    for (let year = 1; year <= 5; year++) {
      const yearData = monthlyData.filter(d => d.year === year);
      const lastMonth = yearData[yearData.length - 1];
      const prevYearEnd = year === 1 ? 0 : monthlyData[(year - 1) * 12 - 1]?.cumulativeSignings || 0;
      
      yearlySummary.push({
        year,
        newLocations: lastMonth.cumulativeSignings - prevYearEnd,
        totalLocations: lastMonth.cumulativeSignings,
        openLocations: lastMonth.openLocations,
        franchiseFees: yearData.reduce((sum, d) => sum + d.monthlyFranchiseFees, 0),
        royalties: yearData.reduce((sum, d) => sum + d.monthlyRoyalties, 0),
        adFees: yearData.reduce((sum, d) => sum + d.monthlyAdFees, 0),
        systemSales: yearData.reduce((sum, d) => sum + d.monthlySystemSales, 0),
        adSpend: yearData.reduce((sum, d) => sum + d.adsBudget, 0),
      });
    }

    // Brand final summary
    const brandSummary = BRANDS.map(brand => {
      const state = brandState[brand.id];
      const openCount = state.openLocations.filter(
        loc => 60 >= loc.openedMonth && 60 < loc.closesMonth
      ).length;
      return {
        ...brand,
        totalSigned: state.totalSigned,
        openLocations: openCount,
        pendingLocations: state.pendingLocations.length,
        totalFranchiseFees: state.totalFranchiseFees,
        totalRoyalties: state.totalRoyalties,
        totalAdFees: state.totalAdFees,
        totalSystemSales: state.totalSystemSales,
        totalAdSpend: state.totalAdSpend,
      };
    });

    // Calculate yearly breakdown per brand
    const brandYearlyBreakdown = {};
    BRANDS.forEach(brand => {
      brandYearlyBreakdown[brand.id] = [];
      for (let year = 1; year <= 5; year++) {
        const yearMonths = monthlyData.filter(d => d.year === year);
        const prevYearLastMonth = year === 1 ? null : monthlyData[(year - 1) * 12 - 1];
        const lastMonthOfYear = yearMonths[yearMonths.length - 1];
        
        const prevYearSigned = prevYearLastMonth ? prevYearLastMonth.brands[brand.id].signed : 0;
        const yearEndSigned = lastMonthOfYear.brands[brand.id].signed;
        const yearEndOpen = lastMonthOfYear.brands[brand.id].open;
        
        const yearFranchiseFees = yearMonths.reduce((sum, m) => {
          const prevMonth = m.month > 1 ? monthlyData[m.month - 2] : null;
          const prevSigned = prevMonth ? prevMonth.brands[brand.id].signed : 0;
          const currentSigned = m.brands[brand.id].signed;
          const newThisMonth = currentSigned - prevSigned;
          return sum + (newThisMonth * brand.franchiseFee);
        }, 0);
        
        const yearSystemSales = yearMonths.reduce((sum, m) => sum + m.brands[brand.id].monthlyRevenue, 0);
        const yearRoyalties = yearMonths.reduce((sum, m) => sum + m.brands[brand.id].monthlyRoyalties, 0);
        const yearAdFees = yearMonths.reduce((sum, m) => sum + m.brands[brand.id].monthlyAdFees, 0);
        const yearAdSpend = yearMonths.reduce((sum, m) => sum + m.brands[brand.id].monthlyAdSpend, 0);
        
        brandYearlyBreakdown[brand.id].push({
          year,
          newSigned: yearEndSigned - prevYearSigned,
          totalSigned: yearEndSigned,
          openLocations: yearEndOpen,
          franchiseFees: yearFranchiseFees,
          systemSales: yearSystemSales,
          royalties: yearRoyalties,
          adFees: yearAdFees,
          adSpend: yearAdSpend,
        });
      }
    });

    return {
      monthly: monthlyData,
      yearly: yearlySummary,
      brands: brandSummary,
      brandYearly: brandYearlyBreakdown,
      totals: cumulativeMetrics,
    };
  }, [baseAdsBudget, reinvestmentRate]);

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatNumber = (value) => {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: '"DM Sans", system-ui, sans-serif',
      color: '#e2e8f0',
      padding: '24px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        
        .slider-container {
          position: relative;
          width: 100%;
        }
        
        .custom-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          outline: none;
          opacity: 0.9;
          transition: opacity 0.2s;
        }
        
        .custom-slider:hover {
          opacity: 1;
        }
        
        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          transition: transform 0.2s;
        }
        
        .custom-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        
        .tab-button {
          padding: 12px 24px;
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.3s;
        }
        
        .tab-button:hover {
          color: #e2e8f0;
        }
        
        .tab-button.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }
        
        .card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.1);
          border-radius: 16px;
          padding: 24px;
          backdrop-filter: blur(10px);
        }
        
        .metric-card {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        
        .input-field {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          padding: 10px 14px;
          color: #e2e8f0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          width: 100%;
          outline: none;
          transition: border-color 0.2s;
        }
        
        .input-field:focus {
          border-color: #3b82f6;
        }
        
        .brand-row {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        
        .brand-row:hover {
          background: rgba(59, 130, 246, 0.1);
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 700,
          margin: 0,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Franchise Growth Forecast Model
        </h1>
        <p style={{ color: '#94a3b8', marginTop: '8px', fontSize: '14px' }}>
          5-Year Dynamic Projection Dashboard • 9 Brands • Real-time Scenario Modeling
        </p>
      </div>

      {/* Control Panel */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span>
          Model Parameters
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px' }}>
          {/* Base Ads Budget */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Monthly Base Ads Budget</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>$</span>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100px' }}
                  value={exactBudgetInput}
                  onChange={(e) => handleExactBudgetChange(e.target.value)}
                />
              </div>
            </div>
            <div className="slider-container">
              <input
                type="range"
                className="custom-slider"
                min="8000"
                max="12000"
                step="100"
                value={baseAdsBudget}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setBaseAdsBudget(val);
                  setExactBudgetInput(val.toString());
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                <span>$8,000</span>
                <span>$10,000</span>
                <span>$12,000</span>
              </div>
            </div>
          </div>

          {/* Reinvestment Rate */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500 }}>Reinvestment Rate (% of Projected Annual Sales per Signing)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '80px' }}
                  value={exactRateInput}
                  onChange={(e) => handleExactRateChange(e.target.value)}
                />
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>%</span>
              </div>
            </div>
            <div className="slider-container">
              <input
                type="range"
                className="custom-slider"
                min="0.1"
                max="1"
                step="0.01"
                value={reinvestmentRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setReinvestmentRate(val);
                  setExactRateInput(val.toFixed(2));
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                <span>0.1%</span>
                <span>0.55%</span>
                <span>1.0%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current Parameters Display */}
        <div style={{ 
          marginTop: '24px', 
          padding: '16px', 
          background: 'rgba(59, 130, 246, 0.1)', 
          borderRadius: '8px',
          display: 'flex',
          gap: '48px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>ACTIVE BASE BUDGET</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6', fontFamily: '"JetBrains Mono", monospace' }}>
              ${baseAdsBudget.toLocaleString()}
            </div>
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>ACTIVE REINVESTMENT</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#8b5cf6', fontFamily: '"JetBrains Mono", monospace' }}>
              {reinvestmentRate.toFixed(2)}%
            </div>
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>EXAMPLE: TCB SIGNING</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b', fontFamily: '"JetBrains Mono", monospace' }}>
              +{formatCurrency(1700000 * (reinvestmentRate / 100))}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>$1.7M × {reinvestmentRate.toFixed(2)}%</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>PROJECTED Y5 MONTHLY BUDGET</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e', fontFamily: '"JetBrains Mono", monospace' }}>
              {formatCurrency(forecastData.monthly[59]?.adsBudget || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)', marginBottom: '24px' }}>
        {['overview', 'monthly', 'brands', 'revenue'].map(tab => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div className="metric-card">
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>TOTAL LOCATIONS</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{forecastData.totals.totalLocations}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>signed over 5 years</div>
            </div>
            <div className="metric-card">
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>FRANCHISE FEES</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(forecastData.totals.totalFranchiseFees)}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>collected</div>
            </div>
            <div className="metric-card">
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>TOTAL ROYALTIES</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#8b5cf6' }}>{formatCurrency(forecastData.totals.totalRoyalties)}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>6% of net sales</div>
            </div>
            <div className="metric-card">
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>AD FEES COLLECTED</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(forecastData.totals.totalAdFees)}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>2% of net sales</div>
            </div>
            <div className="metric-card">
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>SYSTEM-WIDE SALES</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#ec4899' }}>{formatCurrency(forecastData.totals.totalSystemSales)}</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>all brands combined</div>
            </div>
          </div>

          {/* Yearly Summary Table */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>5-Year Summary by Year</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>YEAR</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>NEW SIGNED</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>TOTAL SIGNED</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>OPEN LOCS</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>FRANCHISE FEES</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>SYSTEM SALES</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>ROYALTIES (6%)</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>AD FEES (2%)</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>AD SPEND</th>
                </tr>
              </thead>
              <tbody>
                {forecastData.yearly.map((year, idx) => (
                  <tr key={year.year} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>Year {year.year}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace' }}>{year.newLocations}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', color: '#3b82f6' }}>{year.totalLocations}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', color: '#22c55e' }}>{year.openLocations}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', color: '#f59e0b' }}>{formatCurrency(year.franchiseFees)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', color: '#ec4899' }}>{formatCurrency(year.systemSales)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', color: '#8b5cf6' }}>{formatCurrency(year.royalties)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', color: '#06b6d4' }}>{formatCurrency(year.adFees)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', color: '#ef4444' }}>{formatCurrency(year.adSpend)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                  <td style={{ padding: '12px', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>{forecastData.totals.totalLocations}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>—</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>—</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(forecastData.totals.totalFranchiseFees)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#ec4899' }}>{formatCurrency(forecastData.totals.totalSystemSales)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#8b5cf6' }}>{formatCurrency(forecastData.totals.totalRoyalties)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#06b6d4' }}>{formatCurrency(forecastData.totals.totalAdFees)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(forecastData.totals.totalAdSpend)}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', fontSize: '12px', color: '#94a3b8' }}>
              <strong style={{ color: '#22c55e' }}>Timing Notes:</strong> 
              <span style={{ marginLeft: '8px' }}>① Franchise fee collected at signing</span>
              <span style={{ marginLeft: '16px' }}>② Reinvestment (projected sales × %) added to budget immediately after signing</span>
              <span style={{ marginLeft: '16px' }}>③ Location opens 10 months after signing → starts generating system sales, royalties (6%), ad fees (2%)</span>
            </div>
          </div>

          {/* Brand Breakdown Panel */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }}></span>
              5-Year Breakdown by Brand
              <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b', marginLeft: 'auto' }}>Click to expand yearly details</span>
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {forecastData.brands.sort((a, b) => a.priority - b.priority).map((brand) => (
                <div key={brand.id} style={{ border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', overflow: 'hidden' }}>
                  {/* Brand Header Row - Clickable */}
                  <div 
                    onClick={() => toggleBrandExpand(brand.id)}
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '200px repeat(7, 1fr) 40px',
                      alignItems: 'center',
                      padding: '16px',
                      background: expandedBrands[brand.id] ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => { if (!expandedBrands[brand.id]) e.currentTarget.style.background = 'rgba(148, 163, 184, 0.05)'; }}
                    onMouseLeave={(e) => { if (!expandedBrands[brand.id]) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: brand.color }}></div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{brand.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Priority #{brand.priority} • CAC: {formatCurrency(brand.cac)}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>SIGNED</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#3b82f6' }}>{brand.totalSigned}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>OPEN</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#22c55e' }}>{brand.openLocations}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>AD SPEND</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#ef4444' }}>{formatCurrency(brand.totalAdSpend)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>FEES</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#f59e0b' }}>{formatCurrency(brand.totalFranchiseFees)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>SALES</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#ec4899' }}>{formatCurrency(brand.totalSystemSales)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>ROYALTIES</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#8b5cf6' }}>{formatCurrency(brand.totalRoyalties)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>AD FEES</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#06b6d4' }}>{formatCurrency(brand.totalAdFees)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ 
                        display: 'inline-block',
                        transform: expandedBrands[brand.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        fontSize: '18px',
                        color: '#64748b'
                      }}>▼</span>
                    </div>
                  </div>

                  {/* Expanded Yearly Details */}
                  {expandedBrands[brand.id] && (
                    <div style={{ 
                      background: 'rgba(15, 23, 42, 0.5)', 
                      borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                      padding: '12px 16px'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}>
                            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>YEAR</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>NEW SIGNED</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>TOTAL SIGNED</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>OPEN LOCS</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>AD SPEND</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>FRANCHISE FEES</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>SYSTEM SALES</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>ROYALTIES</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>AD FEES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecastData.brandYearly[brand.id].map((yearData) => (
                            <tr key={yearData.year} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.08)' }}>
                              <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500 }}>Year {yearData.year}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>{yearData.newSigned}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#3b82f6' }}>{yearData.totalSigned}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#22c55e' }}>{yearData.openLocations}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#ef4444' }}>{formatCurrency(yearData.adSpend)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#f59e0b' }}>{formatCurrency(yearData.franchiseFees)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#ec4899' }}>{formatCurrency(yearData.systemSales)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#8b5cf6' }}>{formatCurrency(yearData.royalties)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#06b6d4' }}>{formatCurrency(yearData.adFees)}</td>
                            </tr>
                          ))}
                          <tr style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                            <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700 }}>5-Year Total</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', fontWeight: 700 }}>{brand.totalSigned}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>—</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>—</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(brand.totalAdSpend)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(brand.totalFranchiseFees)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', fontWeight: 700, color: '#ec4899' }}>{formatCurrency(brand.totalSystemSales)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', fontWeight: 700, color: '#8b5cf6' }}>{formatCurrency(brand.totalRoyalties)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', fontWeight: 700, color: '#06b6d4' }}>{formatCurrency(brand.totalAdFees)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', display: 'flex', gap: '16px' }}>
                        <span>Annual Sales/Location: {formatCurrency(brand.annualSales)}</span>
                        <span>Franchise Fee: {formatCurrency(brand.franchiseFee)}</span>
                        <span>Budget Allocation: {(PRIORITY_WEIGHTS[brand.priority] * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Growth Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Signed vs Open Locations (10-month lag)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={forecastData.monthly.filter((_, i) => i % 3 === 0)}>
                  <defs>
                    <linearGradient id="colorSigned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOpen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="monthLabel" tick={{ fill: '#64748b', fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="cumulativeSignings" stroke="#3b82f6" fill="url(#colorSigned)" name="Total Signed" />
                  <Area type="monotone" dataKey="openLocations" stroke="#22c55e" fill="url(#colorOpen)" name="Open Locations" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Monthly Ads Budget Growth</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={forecastData.monthly.filter((_, i) => i % 3 === 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="monthLabel" tick={{ fill: '#64748b', fontSize: 10 }} interval={3} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="baseBudget" stackId="a" fill="#3b82f6" name="Base Budget" />
                  <Bar dataKey="reinvestment" stackId="a" fill="#8b5cf6" name="Reinvestment (from signings)" />
                  <Line type="monotone" dataKey="adsBudget" stroke="#22c55e" strokeWidth={2} dot={false} name="Total Budget" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Tab */}
      {activeTab === 'monthly' && (
        <div>
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Monthly Revenue Streams</h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={forecastData.monthly.filter((_, i) => i % 2 === 0)}>
                <defs>
                  <linearGradient id="colorRoyalties" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAdFees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="monthLabel" tick={{ fill: '#64748b', fontSize: 10 }} interval={5} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend />
                <Area type="monotone" dataKey="monthlyRoyalties" stackId="1" stroke="#8b5cf6" fill="url(#colorRoyalties)" name="Royalties (6%)" />
                <Area type="monotone" dataKey="monthlyAdFees" stackId="1" stroke="#f59e0b" fill="url(#colorAdFees)" name="Ad Fees (2%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Monthly Data Table (Sample)</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#1e293b' }}>
                  <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    <th style={{ textAlign: 'left', padding: '10px', color: '#94a3b8', fontSize: '11px' }}>MONTH</th>
                    <th style={{ textAlign: 'right', padding: '10px', color: '#94a3b8', fontSize: '11px' }}>ADS BUDGET</th>
                    <th style={{ textAlign: 'right', padding: '10px', color: '#94a3b8', fontSize: '11px' }}>NEW SIGNS</th>
                    <th style={{ textAlign: 'right', padding: '10px', color: '#94a3b8', fontSize: '11px' }}>TOTAL SIGNED</th>
                    <th style={{ textAlign: 'right', padding: '10px', color: '#94a3b8', fontSize: '11px' }}>OPEN LOCS</th>
                    <th style={{ textAlign: 'right', padding: '10px', color: '#94a3b8', fontSize: '11px' }}>SYSTEM SALES</th>
                    <th style={{ textAlign: 'right', padding: '10px', color: '#94a3b8', fontSize: '11px' }}>ROYALTIES</th>
                    <th style={{ textAlign: 'right', padding: '10px', color: '#94a3b8', fontSize: '11px' }}>AD FEES</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.monthly.filter((_, i) => i % 6 === 0 || i === 59).map((row) => (
                    <tr key={row.month} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                      <td style={{ padding: '10px', fontSize: '13px' }}>{row.monthLabel}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>{formatCurrency(row.adsBudget)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>{row.newSignings}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#3b82f6' }}>{row.cumulativeSignings}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#22c55e' }}>{row.openLocations}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#ec4899' }}>{formatCurrency(row.monthlySystemSales)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#8b5cf6' }}>{formatCurrency(row.monthlyRoyalties)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#06b6d4' }}>{formatCurrency(row.monthlyAdFees)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b' }}>
              Showing every 6th month. Open locations start generating sales 10 months after signing.
            </div>
          </div>
        </div>
      )}

      {/* Brands Tab */}
      {activeTab === 'brands' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Locations by Brand (End of Y5)</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={forecastData.brands} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={120} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="totalSigned" name="Signed Locations">
                    {forecastData.brands.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Franchise Fees by Brand</h3>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={forecastData.brands.filter(b => b.totalFranchiseFees > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="totalFranchiseFees"
                    nameKey="name"
                    label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#64748b' }}
                  >
                    {forecastData.brands.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Brand Details Table */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Brand Performance Summary</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <th style={{ textAlign: 'left', padding: '12px', color: '#94a3b8', fontSize: '11px' }}>BRAND</th>
                  <th style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '11px' }}>PRIORITY</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '11px' }}>CAC</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '11px' }}>SIGNED</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '11px' }}>OPEN</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '11px' }}>FRANCHISE FEES</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '11px' }}>ROYALTIES</th>
                  <th style={{ textAlign: 'right', padding: '12px', color: '#94a3b8', fontSize: '11px' }}>SYSTEM SALES</th>
                </tr>
              </thead>
              <tbody>
                {forecastData.brands.sort((a, b) => a.priority - b.priority).map((brand) => (
                  <tr key={brand.id} className="brand-row" style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: brand.color }}></div>
                        <span style={{ fontWeight: 500 }}>{brand.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ 
                        background: 'rgba(59, 130, 246, 0.2)', 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        fontSize: '12px',
                        fontWeight: 600 
                      }}>
                        #{brand.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '13px' }}>{formatCurrency(brand.cac)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#3b82f6', fontWeight: 600 }}>{brand.totalSigned}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#22c55e' }}>{brand.openLocations}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '13px' }}>{formatCurrency(brand.totalFranchiseFees)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#8b5cf6' }}>{formatCurrency(brand.totalRoyalties)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#ec4899' }}>{formatCurrency(brand.totalSystemSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && (
        <div>
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Cumulative Revenue Streams</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={forecastData.monthly.filter((_, i) => i % 2 === 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="monthLabel" tick={{ fill: '#64748b', fontSize: 10 }} interval={5} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                <Tooltip 
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend />
                <Line type="monotone" dataKey="cumulativeFranchiseFees" stroke="#22c55e" strokeWidth={2} dot={false} name="Franchise Fees" />
                <Line type="monotone" dataKey="cumulativeRoyalties" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Royalties" />
                <Line type="monotone" dataKey="cumulativeAdFees" stroke="#f59e0b" strokeWidth={2} dot={false} name="Ad Fees" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>ROI Analysis</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>TOTAL REVENUE</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#22c55e', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatCurrency(forecastData.totals.totalFranchiseFees + forecastData.totals.totalRoyalties + forecastData.totals.totalAdFees)}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>fees + royalties + ad fees</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>TOTAL AD SPEND</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatCurrency(forecastData.totals.totalAdSpend)}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>over 5 years</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>NET PROFIT</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#3b82f6', fontFamily: '"JetBrains Mono", monospace' }}>
                    {formatCurrency((forecastData.totals.totalFranchiseFees + forecastData.totals.totalRoyalties + forecastData.totals.totalAdFees) - forecastData.totals.totalAdSpend)}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>revenue - ad spend</div>
                </div>
                <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>ROI</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#8b5cf6', fontFamily: '"JetBrains Mono", monospace' }}>
                    {(((forecastData.totals.totalFranchiseFees + forecastData.totals.totalRoyalties + forecastData.totals.totalAdFees) / forecastData.totals.totalAdSpend - 1) * 100).toFixed(0)}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>return on ad spend</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>System-Wide Sales Growth</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={forecastData.monthly.filter((_, i) => i % 3 === 0)}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="monthLabel" tick={{ fill: '#64748b', fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="monthlySystemSales" stroke="#ec4899" fill="url(#colorSales)" name="Monthly Sales" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '32px', padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
        <p>Model Assumptions: 45 days lead-to-sign • 10 months sign-to-open • 10-year location lifespan • 6% royalty • 2% ad fee • 100 max locations/brand</p>
        <p style={{ marginTop: '4px' }}>Reinvestment: When a new franchisee signs, (projected annual sales × reinvestment %) is added to next month's ad budget</p>
      </div>
    </div>
  );
}
