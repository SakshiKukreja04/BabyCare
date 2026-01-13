import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { SidebarNavigation } from './SidebarNavigation';
import { Button } from '@/components/ui/button';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <SidebarNavigation />
        <SidebarInset className="flex flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-border/50 bg-background/95 backdrop-blur-sm px-4 transition-all duration-200">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              {/* Home Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                asChild
                className="h-9 w-9 rounded-lg transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                <Link to="/">
                  <Home className="h-5 w-5 transition-transform duration-200" />
                  <span className="sr-only">Go to Home</span>
                </Link>
              </Button>
            </div>
          </div>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

