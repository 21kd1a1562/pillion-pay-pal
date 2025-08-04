import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsChart from './AnalyticsChart';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  Bell, 
  RotateCcw, 
  Users,
  MapPin,
  Copy,
  QrCode 
} from 'lucide-react';

interface DashboardStats {
  totalEarned: number;
  monthlyEarned: number;
  daysThisMonth: number;
  todayStatus: 'pending' | 'completed' | 'none';
  partnerInfo: any;
  pairingCode: string;
}

const RiderDashboard = () => {
  const { user } = useAuth();
  const [petrolCost, setPetrolCost] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats>({
    totalEarned: 0,
    monthlyEarned: 0,
    daysThisMonth: 0,
    todayStatus: 'none',
    partnerInfo: null,
    pairingCode: ''
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
      // Fetch current user profile for pairing code
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Fetch settings
      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .eq('rider_id', user.id)
        .maybeSingle();

      if (settings) {
        setPetrolCost(settings.daily_petrol_cost.toString());
      }

      // Fetch attendance records
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('rider_id', user.id);

      // Calculate stats
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const today = new Date().toISOString().split('T')[0];

      const totalEarned = attendance?.reduce((sum, record) => sum + parseFloat(record.amount.toString()), 0) || 0;
      
      const monthlyAttendance = attendance?.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
      }) || [];

      const monthlyEarned = monthlyAttendance.reduce((sum, record) => sum + parseFloat(record.amount.toString()), 0);
      const daysThisMonth = monthlyAttendance.length;

      const todayAttendance = attendance?.find(record => record.date === today);
      const todayStatus = todayAttendance ? 'completed' : 'pending';

      // Find partner
      const { data: partner } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'partner')
        .limit(1)
        .maybeSingle();

      setStats({
        totalEarned,
        monthlyEarned,
        daysThisMonth,
        todayStatus,
        partnerInfo: partner,
        pairingCode: profile?.pairing_code || ''
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const savePetrolCost = async () => {
    if (!user || !petrolCost) return;

    // Input validation
    const cost = parseFloat(petrolCost);
    if (isNaN(cost) || cost < 0 || cost > 10000) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount between ₹0 and ₹10,000",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // First check if settings already exist
      const { data: existingSettings } = await supabase
        .from('settings')
        .select('id')
        .eq('rider_id', user.id)
        .maybeSingle();

      if (existingSettings) {
        // Update existing record
        const { error } = await supabase
          .from('settings')
          .update({ daily_petrol_cost: parseFloat(petrolCost) })
          .eq('rider_id', user.id);
        
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('settings')
          .insert({
            rider_id: user.id,
            daily_petrol_cost: parseFloat(petrolCost)
          });
        
        if (error) throw error;
      }

      toast({
        title: "Settings saved",
        description: "Daily petrol cost updated successfully!",
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

  const sendRequest = async () => {
    if (!user || !stats.partnerInfo) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('requests')
        .upsert({
          rider_id: user.id,
          partner_id: stats.partnerInfo.user_id,
          date: today,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Request sent!",
        description: "Your partner has been notified to mark attendance.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetMonthlyData = async () => {
    if (!user) return;

    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('rider_id', user.id)
        .gte('date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);

      if (error) throw error;

      await fetchDashboardData();
      
      toast({
        title: "Data reset",
        description: "Monthly data has been cleared successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/10 to-accent/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Daily Petrol Cost Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="petrol-cost">Amount (₹)</Label>
              <Input
                id="petrol-cost"
                type="number"
                placeholder="Enter daily petrol cost"
                value={petrolCost}
                onChange={(e) => setPetrolCost(e.target.value)}
                min="0"
                max="10000"
                step="0.01"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={savePetrolCost} disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pairing Code Card */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-accent/10 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Your Pairing Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Share this code with your partner to pair your accounts
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border-2 border-dashed">
              <p className="text-3xl font-bold tracking-wider text-primary">
                {stats.pairingCode}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => {
                navigator.clipboard.writeText(stats.pairingCode);
                toast({
                  title: "Copied!",
                  description: "Pairing code copied to clipboard",
                });
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold text-success">₹{stats.totalEarned}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-primary">₹{stats.monthlyEarned}</p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Days This Month</p>
                <p className="text-2xl font-bold text-accent">{stats.daysThisMonth}</p>
              </div>
              <MapPin className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Status</p>
                <p className={`text-sm font-semibold ${
                  stats.todayStatus === 'completed' ? 'text-success' :
                  stats.todayStatus === 'pending' ? 'text-warning' : 'text-muted-foreground'
                }`}>
                  {stats.todayStatus === 'completed' ? 'Completed' : 
                   stats.todayStatus === 'pending' ? 'Pending' : 'No Travel'}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Chart */}
      <AnalyticsChart />

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Send Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.todayStatus !== 'completed' && stats.partnerInfo ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {stats.todayStatus === 'pending' ? 
                    "Partner hasn't marked attendance for today" :
                    "Send a request to your partner to mark attendance"
                  }
                </p>
                <Button 
                  onClick={sendRequest}
                  className="w-full bg-gradient-to-r from-warning to-accent hover:from-warning/90 hover:to-accent/90"
                >
                  Send Request
                </Button>
              </div>
            ) : stats.todayStatus === 'completed' ? (
              <div className="text-center p-4">
                <p className="text-success font-medium">✓ Partner marked attendance today!</p>
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted-foreground">No partner found</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Monthly Reset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Clear this month's attendance data to start fresh
            </p>
            <Button 
              onClick={resetMonthlyData}
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Reset Monthly Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RiderDashboard;