import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsChart from './AnalyticsChart';
import { 
  CheckCircle, 
  Calendar, 
  DollarSign, 
  Bell,
  TrendingDown,
  Clock,
  UserPlus,
  Link
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PartnerStats {
  monthlySpent: number;
  totalSpent: number;
  daysThisMonth: number;
  todayMarked: boolean;
  pendingRequests: number;
  riderInfo: any;
  pairedRiderId: string | null;
}

const PartnerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PartnerStats>({
    monthlySpent: 0,
    totalSpent: 0,
    daysThisMonth: 0,
    todayMarked: false,
    pendingRequests: 0,
    riderInfo: null,
    pairedRiderId: null
  });
  const [loading, setLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState('');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Get current partner's profile to find paired rider
      const { data: partnerProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let pairedRiderId = null;
      let rider = null;

      // If partner has a paired rider, fetch that rider's info
      if (partnerProfile?.paired_rider_id) {
        pairedRiderId = partnerProfile.paired_rider_id;
        const { data: pairedRider } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', pairedRiderId)
          .single();
        rider = pairedRider;
      }

      // Fetch attendance records (only if paired)
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('partner_id', user.id)
        .eq('rider_id', pairedRiderId || 'no-rider');

      // Fetch pending requests (only if paired)
      const today = new Date().toISOString().split('T')[0];
      const { data: requests } = await supabase
        .from('requests')
        .select('*')
        .eq('partner_id', user.id)
        .eq('rider_id', pairedRiderId || 'no-rider')
        .eq('status', 'pending');

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
        riderInfo: rider,
        pairedRiderId
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

  const pairWithRider = async () => {
    if (!user || !pairingCode.trim()) return;

    setLoading(true);
    try {
      // Find rider by pairing code
      const { data: riderProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('pairing_code', pairingCode.trim().toUpperCase())
        .eq('role', 'rider')
        .single();

      if (!riderProfile) {
        toast({
          title: "Invalid Code",
          description: "No rider found with this pairing code.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Update partner's profile to include paired rider
      const { error } = await supabase
        .from('profiles')
        .update({ paired_rider_id: riderProfile.user_id })
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchDashboardData();
      setPairingCode('');

      toast({
        title: "Successfully Paired!",
        description: `You are now paired with ${riderProfile.email}`,
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
      {/* Pairing and Attendance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pairing Card */}
        {!stats.pairedRiderId ? (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-warning/10 to-accent/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Pair with Rider
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="pairing-code">Rider's Pairing Code</Label>
                <Input
                  id="pairing-code"
                  placeholder="Enter 6-digit code"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </div>
              <Button 
                onClick={pairWithRider} 
                disabled={loading || !pairingCode.trim()}
                className="w-full bg-gradient-to-r from-warning to-accent hover:from-warning/90 hover:to-accent/90"
              >
                {loading ? 'Pairing...' : 'Pair Account'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Ask your rider for their pairing code to connect your accounts
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-success/10 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Paired Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-success font-medium">✓ Successfully paired!</p>
                <p className="text-sm text-muted-foreground">
                  Paired with: {stats.riderInfo?.email}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's Action Card */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-accent/10 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stats.pairedRiderId ? (
            <div className="text-center p-4">
              <p className="text-muted-foreground">Pair with a rider first to mark attendance</p>
            </div>
          ) : !stats.todayMarked ? (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                {stats.pendingRequests > 0 ? 
                  "Your rider is waiting for you to mark attendance!" : 
                  "Mark your attendance for today's travel"}
              </p>
              <Button 
                onClick={markAttendance} 
                disabled={loading || !stats.riderInfo}
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
      </div>

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

      {/* Analytics Chart */}
      <AnalyticsChart />

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