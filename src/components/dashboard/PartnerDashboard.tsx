import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  Calendar, 
  DollarSign, 
  Bell,
  TrendingDown,
  Clock
} from 'lucide-react';

interface PartnerStats {
  monthlySpent: number;
  totalSpent: number;
  daysThisMonth: number;
  todayMarked: boolean;
  pendingRequests: number;
  riderInfo: any;
}

const PartnerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PartnerStats>({
    monthlySpent: 0,
    totalSpent: 0,
    daysThisMonth: 0,
    todayMarked: false,
    pendingRequests: 0,
    riderInfo: null
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Fetch attendance records
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('partner_id', user.id);

      // Fetch pending requests
      const today = new Date().toISOString().split('T')[0];
      const { data: requests } = await supabase
        .from('requests')
        .select('*')
        .eq('partner_id', user.id)
        .eq('status', 'pending');

      // Find rider
      const { data: rider } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'rider')
        .limit(1)
        .maybeSingle();

      // Calculate stats
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const totalSpent = attendance?.reduce((sum, record) => sum + parseFloat(record.amount.toString()), 0) || 0;
      
      const monthlyAttendance = attendance?.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
      }) || [];

      const monthlySpent = monthlyAttendance.reduce((sum, record) => sum + parseFloat(record.amount.toString()), 0);
      const daysThisMonth = monthlyAttendance.length;

      const todayAttendance = attendance?.find(record => record.date === today);
      const todayMarked = !!todayAttendance;

      setStats({
        monthlySpent,
        totalSpent,
        daysThisMonth,
        todayMarked,
        pendingRequests: requests?.length || 0,
        riderInfo: rider
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const markAttendance = async () => {
    if (!user || !stats.riderInfo) return;

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get rider's petrol cost
      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .eq('rider_id', stats.riderInfo.user_id)
        .maybeSingle();

      if (!settings) {
        toast({
          title: "Error",
          description: "Rider hasn't set daily petrol cost yet.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Insert attendance record
      const { error: attendanceError } = await supabase
        .from('attendance')
        .upsert({
          partner_id: user.id,
          rider_id: stats.riderInfo.user_id,
          date: today,
          amount: settings.daily_petrol_cost,
          status: 'present'
        });

      if (attendanceError) throw attendanceError;

      // Update any pending requests
      await supabase
        .from('requests')
        .update({ status: 'completed' })
        .eq('partner_id', user.id)
        .eq('date', today);

      await fetchDashboardData();

      toast({
        title: "Attendance marked!",
        description: `Successfully marked attendance for ₹${settings.daily_petrol_cost}`,
      });

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Today's Action Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-accent/10 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stats.todayMarked ? (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                {stats.pendingRequests > 0 ? 
                  "Your rider is waiting for you to mark attendance!" : 
                  "Mark your attendance for today's travel"}
              </p>
              <Button 
                onClick={markAttendance} 
                disabled={loading}
                className="w-full bg-gradient-to-r from-accent to-warning hover:from-accent/90 hover:to-warning/90"
              >
                {loading ? 'Marking...' : 'Mark Attendance'}
              </Button>
              {stats.pendingRequests > 0 && (
                <div className="flex items-center gap-2 mt-2 text-warning">
                  <Bell className="h-4 w-4" />
                  <span className="text-sm">{stats.pendingRequests} pending request(s)</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-4">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-2" />
              <p className="text-success font-medium">Attendance marked for today!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-destructive">₹{stats.totalSpent}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-warning">₹{stats.monthlySpent}</p>
              </div>
              <DollarSign className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Days This Month</p>
                <p className="text-2xl font-bold text-primary">{stats.daysThisMonth}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Status</p>
                <p className={`text-sm font-semibold ${
                  stats.todayMarked ? 'text-success' : 'text-warning'
                }`}>
                  {stats.todayMarked ? 'Completed' : 'Pending'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <p className="text-2xl font-bold text-primary">{stats.daysThisMonth}</p>
              <p className="text-sm text-muted-foreground">Days Traveled</p>
            </div>
            <div className="text-center p-4 bg-warning/5 rounded-lg">
              <p className="text-2xl font-bold text-warning">₹{stats.monthlySpent}</p>
              <p className="text-sm text-muted-foreground">Total Spent</p>
            </div>
            <div className="text-center p-4 bg-accent/5 rounded-lg">
              <p className="text-2xl font-bold text-accent">
                ₹{stats.daysThisMonth > 0 ? (stats.monthlySpent / stats.daysThisMonth).toFixed(2) : '0'}
              </p>
              <p className="text-sm text-muted-foreground">Avg per Day</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="border-0 shadow-lg bg-muted/50">
        <CardHeader>
          <CardTitle className="text-lg">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Click "Mark Attendance" once per day when you travel together</p>
            <p>• The amount is automatically added based on the rider's daily petrol cost</p>
            <p>• You'll receive notifications when the rider sends a reminder</p>
            <p>• Your monthly and total spending is tracked automatically</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerDashboard;