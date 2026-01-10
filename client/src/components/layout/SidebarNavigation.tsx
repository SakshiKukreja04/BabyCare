import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageCircle,
  UtensilsCrossed,
  BarChart3,
  User,
  AudioWaveform,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Baby, Heart } from 'lucide-react';

const navigationItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    title: 'Cry Analysis',
    icon: AudioWaveform,
    href: '/cry-analysis',
  },
  {
    title: 'Chatbot',
    icon: MessageCircle,
    href: '/chatbot',
  },
  {
    title: 'Nutritionist',
    icon: UtensilsCrossed,
    href: '/nutrition',
  },
  {
    title: 'Daily Analytics',
    icon: BarChart3,
    href: '/analytics',
  },
  {
    title: 'Profile',
    icon: User,
    href: '/profile',
  },
];

export function SidebarNavigation() {
  const location = useLocation();

  return (
    <Sidebar className="w-[260px] border-r border-sidebar-border bg-sidebar/95 backdrop-blur-sm">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <div className="relative">
            <Baby className="w-6 h-6 text-primary transition-transform group-hover:scale-110" />
            <Heart className="w-3 h-3 text-healthcare-peach-dark absolute -bottom-0.5 -right-0.5 animate-pulse-soft" />
          </div>
          <span className="font-bold text-lg text-foreground">
            Baby<span className="text-primary">Care</span>
          </span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        'transition-all duration-200',
                        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      )}
                    >
                      <Link to={item.href}>
                        <Icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          Baby & Maternal Care Assistant
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}

