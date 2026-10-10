'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Download,
  Filter,
  TrendingUp,
  Users,
  Target,
  Sparkles,
  Compass,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ContactReportRow {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  lead_source: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  created_at: string;
}

const SOURCE_COLORS: Record<string, string> = {
  meta: '#1877F2',
  google: '#EA4335',
  website: '#10B981',
  whatsapp: '#25D366',
  csv: '#F59E0B',
  manual: '#8B5CF6',
  other: '#6B7280',
};

export default function ReportsPage() {
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ContactReportRow[]>([]);
  const [dealsCount, setDealsCount] = useState(0);
  const [wonDealsCount, setWonDealsCount] = useState(0);

  const fetchReportData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);

    try {
      // 1. Fetch contacts
      let query = supabase
        .from('contacts')
        .select('id, name, phone, email, company, lead_source, utm_source, utm_campaign, utm_medium, created_at')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });

      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);
        query = query.gte('created_at', sinceDate.toISOString());
      }

      const { data: contactsData, error: contactsErr } = await query;
      if (contactsErr) throw contactsErr;

      setContacts(contactsData || []);

      // 2. Fetch deals count
      const [dealsRes, wonRes] = await Promise.all([
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('account_id', accountId),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('status', 'won'),
      ]);

      setDealsCount(dealsRes.count || 0);
      setWonDealsCount(wonRes.count || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [accountId, dateRange, supabase]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Aggregated Daily Lead Trend
  const dailyTrendData = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach((c) => {
      const day = new Date(c.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      map.set(day, (map.get(day) || 0) + 1);
    });

    return Array.from(map.entries()).map(([date, count]) => ({
      date,
      leads: count,
    }));
  }, [contacts]);

  // Aggregated Lead Sources Distribution
  const sourceDistribution = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach((c) => {
      const src = c.lead_source || c.utm_source || 'direct/other';
      map.set(src, (map.get(src) || 0) + 1);
    });

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
      color: SOURCE_COLORS[name.toLowerCase()] || SOURCE_COLORS.other,
    }));
  }, [contacts]);

  // Aggregated UTM Campaign Performance
  const campaignData = useMemo(() => {
    const map = new Map<string, number>();
    contacts.forEach((c) => {
      const camp = c.utm_campaign || 'No Campaign Tag';
      map.set(camp, (map.get(camp) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([campaign, count]) => ({ campaign, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [contacts]);

  // Export to CSV
  const handleExportCSV = () => {
    if (contacts.length === 0) {
      toast.error('No data available to export');
      return;
    }

    const headers = [
      'Contact ID',
      'Name',
      'Phone',
      'Email',
      'Company',
      'Lead Source',
      'UTM Source',
      'UTM Medium',
      'UTM Campaign',
      'Acquisition Date',
    ];

    const rows = contacts.map((c) => [
      c.id,
      c.name || '',
      c.phone,
      c.email || '',
      c.company || '',
      c.lead_source || '',
      c.utm_source || '',
      c.utm_medium || '',
      c.utm_campaign || '',
      new Date(c.created_at).toLocaleString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_report_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV report downloaded successfully!');
  };

  // Export to Excel (.xlsx)
  const handleExportXLSX = () => {
    if (contacts.length === 0) {
      toast.error('No data available to export');
      return;
    }

    const formattedData = contacts.map((c) => ({
      'Contact ID': c.id,
      Name: c.name || 'Unnamed',
      Phone: c.phone,
      Email: c.email || '',
      Company: c.company || '',
      'Lead Source': c.lead_source || '',
      'UTM Source': c.utm_source || '',
      'UTM Medium': c.utm_medium || '',
      'UTM Campaign': c.utm_campaign || '',
      'Created At': new Date(c.created_at).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads & Campaigns');

    // Auto column widths
    const maxCols = Object.keys(formattedData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 16),
    }));
    worksheet['!cols'] = maxCols;

    XLSX.writeFile(workbook, `leads_report_${dateRange}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Excel (.xlsx) report downloaded successfully!');
  };

  const topCampaign = campaignData.find((c) => c.campaign !== 'No Campaign Tag')?.campaign || 'None';
  const conversionRate = dealsCount > 0 ? ((wonDealsCount / dealsCount) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header & Date Range Filter & Export Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            Analytics & Reports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time lead acquisition velocity, campaign performance, and export tools.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range chips */}
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {(['7d', '30d', '90d', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  dateRange === r
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchReportData}
            disabled={loading}
            className="h-8 text-xs border-border"
          >
            <RefreshCw className={`size-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Export Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={loading || contacts.length === 0}
            className="h-8 text-xs border-border"
          >
            <FileText className="size-3.5 mr-1.5 text-blue-400" />
            CSV
          </Button>

          <Button
            size="sm"
            onClick={handleExportXLSX}
            disabled={loading || contacts.length === 0}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
          >
            <FileSpreadsheet className="size-3.5 mr-1.5" />
            Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Leads Acquired</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">{contacts.length}</div>
          <p className="text-[11px] text-muted-foreground">in selected time window</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Top UTM Campaign</span>
            <Compass className="size-4 text-purple-400" />
          </div>
          <div className="text-base font-bold tracking-tight text-purple-400 truncate font-mono">
            {topCampaign}
          </div>
          <p className="text-[11px] text-muted-foreground">Highest volume source</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Pipeline Won Deals</span>
            <Target className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-500">{wonDealsCount} Won</div>
          <p className="text-[11px] text-muted-foreground">out of {dealsCount} active pipeline deals</p>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Win Conversion</span>
            <Sparkles className="size-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-400">{conversionRate}%</div>
          <p className="text-[11px] text-muted-foreground">Deals successfully closed</p>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Lead Acquisition Trend */}
        <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Lead Inflow Trend</h3>
            <p className="text-[11px] text-muted-foreground">Daily volume of incoming contacts</p>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : dailyTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No lead activity in this time range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrendData}>
                  <defs>
                    <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      borderColor: '#374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#leadGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Acquisition Channel Distribution */}
        <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Lead Sources Breakdown</h3>
            <p className="text-[11px] text-muted-foreground">Distribution across Meta, Google, Website & WhatsApp</p>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : sourceDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No source data recorded.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    label={(entry) => `${entry.name} (${entry.value})`}
                  >
                    {sourceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      borderColor: '#374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Top UTM Campaigns Bar Chart */}
        <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Top UTM Campaigns Attribution</h3>
            <p className="text-[11px] text-muted-foreground">Number of contacts generated per campaign</p>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : campaignData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No campaign tags recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="campaign" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      borderColor: '#374151',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
