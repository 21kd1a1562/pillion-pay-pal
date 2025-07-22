import React from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bike, LogOut, User } from 'lucide-react';
import RiderDashboard from '@/components/dashboard/RiderDashboard';
import PartnerDashboard from '@/components/dashboard/PartnerDashboard';

const AppLayout = () => {
  const { user, userProfile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please wait while we load your profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Bike className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Pillion Pay Pal
                </h1>
                <p className="text-sm text-muted-foreground">
                  {userProfile.role === 'rider' ? 'Rider Dashboard' : 'Partner Dashboard'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{user.email}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  userProfile.role === 'rider' 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-accent/10 text-accent'
                }`}>
                  {userProfile.role === 'rider' ? 'Rider' : 'Partner'}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {userProfile.role === 'rider' ? <RiderDashboard /> : <PartnerDashboard />}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>Shared travel expense tracker for two friends</p>
            <p className="mt-1">Built with love for hassle-free expense management</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;