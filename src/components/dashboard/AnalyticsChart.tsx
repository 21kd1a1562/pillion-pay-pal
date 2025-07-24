import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp } from 'lucide-react';

interface AnalyticsData {
  date: string;
  amount: number;
  status: 'completed' | 'requested' | 'none';
}

type ViewType = 'all' | 'day' | 'month' | 'year';

const AnalyticsChart = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [viewType, setViewType] = useState<ViewType>('month');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
    }
  }, [user, viewType]);

  const fetchAnalyticsData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let startDate = new Date();
      let endDate = new Date();
      
      // Set date range based on view type
      if (viewType === 'day') {
        startDate.setDate(startDate.getDate() - 7); // Last 7 days
      } else if (viewType === 'month') {
        startDate.setMonth(startDate.getMonth() - 1); // Last 30 days
      } else if (viewType === 'year') {
        startDate.setFullYear(startDate.getFullYear() - 1); // Last 365 days
      } else {
        startDate.setFullYear(startDate.getFullYear() - 2); // All data (last 2 years)
      }

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Fetch attendance data
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('rider_id', user.id)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: true });

      // Fetch requests data
      const { data: requests } = await supabase
        .from('requests')
        .select('*')
        .eq('rider_id', user.id)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .eq('status', 'pending');

      // Generate date range
      const dateRange: AnalyticsData[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const attendanceRecord = attendance?.find(a => a.date === dateStr);
        const requestRecord = requests?.find(r => r.date === dateStr);
        
        let status: 'completed' | 'requested' | 'none' = 'none';
        if (attendanceRecord) {
          status = 'completed';
        } else if (requestRecord) {
          status = 'requested';
        }

        dateRange.push({
          date: dateStr,
          amount: attendanceRecord ? parseFloat(attendanceRecord.amount.toString()) : 0,
          status
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      setData(dateRange);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBarColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'hsl(var(--success))';
      case 'requested':
        return 'hsl(var(--warning))';
      default:
        return 'hsl(var(--muted))';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (viewType === 'day') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (viewType === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{formatDate(label)}</p>
          <p className="text-sm">
            Amount: <span className="font-semibold text-success">₹{data.amount}</span>
          </p>
          <p className="text-sm">
            Status: <span className={`font-semibold ${
              data.status === 'completed' ? 'text-success' :
              data.status === 'requested' ? 'text-warning' : 'text-muted-foreground'
            }`}>
              {data.status === 'completed' ? 'Completed' :
               data.status === 'requested' ? 'Requested' : 'No Travel'}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBar = (props: any) => {
    const { fill, ...rest } = props;
    const color = getBarColor(props.payload?.status);
    return <rect {...rest} fill={color} />;
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
          <div className="flex gap-1">
            {(['all', 'day', 'month', 'year'] as ViewType[]).map((type) => (
              <Button
                key={type}
                variant={viewType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType(type)}
                className="capitalize"
              >
                {type === 'all' ? 'All' : type}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground">Loading analytics...</div>
          </div>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="amount" 
                    shape={<CustomBar />}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-success"></div>
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-warning"></div>
                <span>Requested</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-muted"></div>
                <span>No Travel</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsChart;