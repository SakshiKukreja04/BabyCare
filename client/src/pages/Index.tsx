import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/home/HeroSection';
import FeaturesSection from '@/components/home/FeaturesSection';
import HowItWorksSection from '@/components/home/HowItWorksSection';
import TrustSection from '@/components/home/TrustSection';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if this is a Firebase redirect with auth params
    const hash = location.hash;
    const search = location.search;
    
    if (hash || search) {
      // eslint-disable-next-line no-console
      console.log("🔍 Root page detected hash/search params:", { hash, search });
      // Firebase redirects might come to root - let AuthContext handle it
      // Don't navigate away, let getRedirectResult process it
    }
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TrustSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
