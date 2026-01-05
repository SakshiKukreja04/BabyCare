import { useState } from 'react';
import { Leaf, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const NutritionAwarenessCard = () => {
  const { t } = useLanguage();

  const nutritionTips = [
    {
      id: 'iron',
      title: t('nutrition.iron.title'),
      content: t('nutrition.iron.content'),
    },
    {
      id: 'hydration',
      title: t('nutrition.hydration.title'),
      content: t('nutrition.hydration.content'),
    },
    {
      id: 'meals',
      title: t('nutrition.meals.title'),
      content: t('nutrition.meals.content'),
    },
    {
      id: 'traditional',
      title: t('nutrition.traditional.title'),
      content: t('nutrition.traditional.content'),
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-healthcare-mint-light/40 to-healthcare-mint-light/20 border-healthcare-mint/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-healthcare-mint-dark">
          <div className="w-8 h-8 rounded-full bg-healthcare-mint/20 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-healthcare-mint" />
          </div>
          {t('nutrition.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {t('nutrition.subtitle')}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="single" collapsible className="space-y-2">
          {nutritionTips.map((tip) => (
            <AccordionItem
              key={tip.id}
              value={tip.id}
              className="border rounded-xl bg-white/60 px-4 border-healthcare-mint/20"
            >
              <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-3">
                {tip.title}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-3">
                {tip.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-4 p-3 bg-healthcare-mint/10 rounded-xl border border-healthcare-mint/20">
          <p className="text-xs text-muted-foreground text-center italic">
            {t('nutrition.disclaimer')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NutritionAwarenessCard;
