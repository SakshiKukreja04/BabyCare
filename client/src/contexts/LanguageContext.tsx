import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Header
    'nav.home': 'Home',
    'nav.howItWorks': 'How It Works',
    'nav.features': 'Features',
    'nav.about': 'About',
    'nav.login': 'Login',
    'nav.signup': 'Sign Up',
    
    // Hero
    'hero.title': 'Caring for Your Baby.',
    'hero.titleHighlight': 'Supporting You.',
    'hero.subtitle': 'A safe, explainable, India-first baby & maternal care assistant — built with doctors\' logic and Google AI.',
    'hero.cta.primary': 'Get Started',
    'hero.cta.secondary': 'How It Works',
    
    // Features
    'features.title': 'Everything You Need',
    'features.subtitle': 'Comprehensive care tools designed with love and medical expertise',
    'features.babyCare.title': 'Baby Care Monitoring',
    'features.babyCare.desc': 'Track feeding, sleep, and growth milestones with intuitive logging tools.',
    'features.alerts.title': 'Smart Alerts',
    'features.alerts.desc': 'Rule-based safety checks that notify you when attention is needed.',
    'features.cryAnalysis.title': 'Cry Analysis',
    'features.cryAnalysis.desc': 'AI-powered analysis to understand why your baby is crying and get helpful recommendations.',
    'features.chatbot.title': 'Chatbot Support',
    'features.chatbot.desc': 'Get instant answers to your baby care questions with our intelligent AI assistant.',
    'features.prescriptions.title': 'Prescription Management',
    'features.prescriptions.desc': 'Track medications, analyze prescriptions, and receive SMS notifications and reminders.',
    'features.nutrition.title': 'Nutrition Tracker',
    'features.nutrition.desc': 'Monitor your baby\'s nutrition intake and get culturally relevant dietary guidance.',
    'features.analytics.title': 'Daily Health Analytics',
    'features.analytics.desc': 'Comprehensive insights and trends about your baby\'s health and care patterns.',
    'features.multilingual.title': 'Multilingual Support',
    'features.multilingual.desc': 'Available in English and Hindi for all Indian families.',
    'features.explainableAI.title': 'Explainable AI',
    'features.explainableAI.desc': 'Clear explanations powered by Google Gemini AI technology.',
    'features.emergency.title': 'Emergency Support',
    'features.emergency.desc': 'Quick access to emergency contacts and nearby hospitals.',
    
    // How It Works
    'howItWorks.title': 'How It Works',
    'howItWorks.subtitle': 'Simple steps to start your caregiving journey',
    'howItWorks.step1.title': 'Create Profile',
    'howItWorks.step1.desc': 'Add your baby\'s basic information',
    'howItWorks.step2.title': 'Log Daily Care',
    'howItWorks.step2.desc': 'Track feeding, sleep, and activities',
    'howItWorks.step3.title': 'Safety Checks',
    'howItWorks.step3.desc': 'System monitors for any concerns',
    'howItWorks.step4.title': 'Get Guidance',
    'howItWorks.step4.desc': 'Receive alerts and helpful tips',
    'howItWorks.step5.title': 'Emergency Help',
    'howItWorks.step5.desc': 'Quick access when you need it most',
    
    // Trust
    'trust.title': 'Built with Trust & Safety',
    'trust.aiNote': 'AI Does NOT Diagnose',
    'trust.aiNoteDesc': 'Our AI provides guidance, not medical diagnosis. Always consult healthcare professionals.',
    'trust.doctorsFirst': 'Doctors-First Logic',
    'trust.doctorsFirstDesc': 'All safety rules are designed with pediatric expertise and medical guidelines.',
    'trust.privacy': 'Privacy-First Design',
    'trust.privacyDesc': 'Your data is encrypted and never shared. Your family\'s privacy is our priority.',
    
    // Footer
    'footer.about': 'About',
    'footer.contact': 'Contact',
    'footer.privacy': 'Privacy Policy',
    'footer.disclaimer': 'Emergency Disclaimer',
    'footer.tagline': 'Caring for families across India',
    
    // Auth
    'auth.login.title': 'Welcome Back',
    'auth.login.subtitle': 'Sign in to continue caring for your little one',
    'auth.signup.title': 'Join Our Family',
    'auth.signup.subtitle': 'Create an account to start your caregiving journey',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.name': 'Full Name',
    'auth.loginBtn': 'Login',
    'auth.signupBtn': 'Sign Up',
    'auth.googleBtn': 'Continue with Google',
    'auth.noAccount': 'Don\'t have an account?',
    'auth.hasAccount': 'Already have an account?',
    
    // Dashboard
    'dashboard.welcome': 'You\'re doing great',
    'dashboard.babySummary': 'Baby Summary',
    'dashboard.age': 'Age',
    'dashboard.lastFeed': 'Last Feed',
    'dashboard.lastSleep': 'Last Sleep',
    'dashboard.status': 'Status',
    'dashboard.alerts': 'Alerts',
    'dashboard.mentalHealth': 'How are you feeling?',
    'dashboard.emergency': 'Emergency Support',
    'dashboard.callDoctor': 'Call Doctor',
    'dashboard.findHospital': 'Find Hospital',
    
    // Baby Profile
    'profile.title': 'Baby Profile',
    'profile.subtitle': 'Tell us about your little one',
    'profile.babyName': 'Baby\'s Name',
    'profile.dob': 'Date of Birth',
    'profile.gestationalAge': 'Gestational Age (weeks)',
    'profile.weight': 'Current Weight (kg)',
    'profile.save': 'Save Profile',
    
    // Daily Log
    'log.title': 'Daily Care Log',
    'log.feeding': 'Feeding',
    'log.sleep': 'Sleep',
    'log.medication': 'Medication',
    'log.time': 'Time',
    'log.quantity': 'Quantity (ml)',
    'log.duration': 'Duration (hours)',
    'log.given': 'Given',
    'log.notGiven': 'Not Given',
    'log.add': 'Add Entry',

    // Nutrition Awareness
    'nutrition.title': 'Local Nutrition Awareness',
    'nutrition.subtitle': 'Culturally relevant wellness tips for new mothers',
    'nutrition.iron.title': 'Iron-rich foods in Indian households',
    'nutrition.iron.content': 'Foods like spinach (palak), jaggery (gur), dates (khajoor), and lentils (dal) are commonly used in Indian homes and are known for their iron content.',
    'nutrition.hydration.title': 'Simple hydration reminders',
    'nutrition.hydration.content': 'Staying hydrated is important for new mothers. Traditional drinks like buttermilk (chaas), coconut water, and jeera water are commonly enjoyed.',
    'nutrition.meals.title': 'Balanced home-cooked meals',
    'nutrition.meals.content': 'A mix of whole grains, vegetables, proteins, and healthy fats in home-cooked meals can support overall wellness during recovery.',
    'nutrition.traditional.title': 'Traditional postpartum practices',
    'nutrition.traditional.content': 'Many Indian families follow traditional foods like ajwain ladoo, dry fruits, and warm soups. These are part of cultural practices passed through generations.',
    'nutrition.disclaimer': 'General awareness only. Not medical or dietary advice. Please consult your doctor or nutritionist.',

    // Rule Trace Explanation
    'ruleTrace.whySeeing': 'Why am I seeing this?',
    'ruleTrace.modalTitle': 'Understanding This Alert',
    'ruleTrace.triggeredRule': 'Triggered Rule',
    'ruleTrace.whatCaused': 'What Caused It',
    'ruleTrace.whyMatters': 'Why This Matters',
    'ruleTrace.defaultRule': 'Safety monitoring rule activated',
    'ruleTrace.defaultTrigger': 'Based on logged care data',
    'ruleTrace.defaultExplanation': 'This helps ensure your baby receives consistent care.',
    'ruleTrace.reassurance': 'These alerts are guidance only. You know your baby best. Trust your instincts.',

    // Mood Check-in
    'mood.title': 'Weekly Check-in',
    'mood.subtitle': 'Taking care of yourself matters too',
    'mood.struggling': 'Struggling',
    'mood.okay': 'Okay',
    'mood.good': 'Good',
    'mood.prompt': 'Tap to share how you\'re feeling today',
    'mood.response.struggling': 'It\'s okay to feel overwhelmed sometimes. You\'re doing your best, and seeking support is always okay. Remember, you don\'t have to do this alone. 💙',
    'mood.response.okay': 'Some days are just okay, and that\'s perfectly fine. You\'re showing up for your little one, and that takes strength. Take it one step at a time.',
    'mood.response.good': 'That\'s wonderful to hear! Your positive energy benefits both you and your baby. Keep nurturing yourself too. 💙',
    'mood.disclaimer': 'This is not a clinical assessment. For persistent concerns, please speak with a healthcare provider.',
  },
  hi: {
    // Header
    'nav.home': 'होम',
    'nav.howItWorks': 'कैसे काम करता है',
    'nav.features': 'विशेषताएं',
    'nav.about': 'हमारे बारे में',
    'nav.login': 'लॉग इन',
    'nav.signup': 'साइन अप',
    
    // Hero
    'hero.title': 'आपके बच्चे की देखभाल।',
    'hero.titleHighlight': 'आपका साथ।',
    'hero.subtitle': 'एक सुरक्षित, स्पष्ट, भारत-केंद्रित बेबी और मातृ देखभाल सहायक — डॉक्टरों के तर्क और Google AI के साथ बनाया गया।',
    'hero.cta.primary': 'शुरू करें',
    'hero.cta.secondary': 'कैसे काम करता है',
    
    // Features
    'features.title': 'आपकी सभी जरूरतें',
    'features.subtitle': 'प्यार और चिकित्सा विशेषज्ञता के साथ डिज़ाइन किए गए व्यापक देखभाल उपकरण',
    'features.babyCare.title': 'बेबी केयर मॉनिटरिंग',
    'features.babyCare.desc': 'सहज लॉगिंग टूल के साथ फीडिंग, नींद और विकास को ट्रैक करें।',
    'features.alerts.title': 'स्मार्ट अलर्ट',
    'features.alerts.desc': 'नियम-आधारित सुरक्षा जांच जो ध्यान देने की आवश्यकता होने पर सूचित करती है।',
    'features.cryAnalysis.title': 'रोने का विश्लेषण',
    'features.cryAnalysis.desc': 'AI-संचालित विश्लेषण जो आपके बच्चे के रोने के कारण को समझने में मदद करता है।',
    'features.chatbot.title': 'चैटबॉट सहायता',
    'features.chatbot.desc': 'हमारे बुद्धिमान AI सहायक के साथ बेबी केयर प्रश्नों के तत्काल उत्तर प्राप्त करें।',
    'features.prescriptions.title': 'प्रिस्क्रिप्शन प्रबंधन',
    'features.prescriptions.desc': 'दवाओं को ट्रैक करें, प्रिस्क्रिप्शन का विश्लेषण करें और SMS सूचनाएं प्राप्त करें।',
    'features.nutrition.title': 'पोषण ट्रैकर',
    'features.nutrition.desc': 'अपने बच्चे के पोषण सेवन की निगरानी करें और सांस्कृतिक रूप से प्रासंगिक आहार मार्गदर्शन प्राप्त करें।',
    'features.analytics.title': 'दैनिक स्वास्थ्य विश्लेषण',
    'features.analytics.desc': 'आपके बच्चे के स्वास्थ्य और देखभाल पैटर्न के बारे में व्यापक अंतर्दृष्टि और रुझान।',
    'features.multilingual.title': 'बहुभाषी समर्थन',
    'features.multilingual.desc': 'सभी भारतीय परिवारों के लिए अंग्रेजी और हिंदी में उपलब्ध।',
    'features.explainableAI.title': 'समझाने योग्य AI',
    'features.explainableAI.desc': 'Google Gemini AI तकनीक द्वारा संचालित स्पष्ट स्पष्टीकरण।',
    'features.emergency.title': 'आपातकालीन सहायता',
    'features.emergency.desc': 'आपातकालीन संपर्कों और नजदीकी अस्पतालों तक त्वरित पहुंच।',
    
    // How It Works
    'howItWorks.title': 'कैसे काम करता है',
    'howItWorks.subtitle': 'अपनी देखभाल यात्रा शुरू करने के सरल कदम',
    'howItWorks.step1.title': 'प्रोफ़ाइल बनाएं',
    'howItWorks.step1.desc': 'अपने बच्चे की बुनियादी जानकारी जोड़ें',
    'howItWorks.step2.title': 'दैनिक देखभाल लॉग',
    'howItWorks.step2.desc': 'फीडिंग, नींद और गतिविधियों को ट्रैक करें',
    'howItWorks.step3.title': 'सुरक्षा जांच',
    'howItWorks.step3.desc': 'सिस्टम किसी भी चिंता के लिए निगरानी करता है',
    'howItWorks.step4.title': 'मार्गदर्शन प्राप्त करें',
    'howItWorks.step4.desc': 'अलर्ट और उपयोगी टिप्स प्राप्त करें',
    'howItWorks.step5.title': 'आपातकालीन मदद',
    'howItWorks.step5.desc': 'जब आपको सबसे ज्यादा जरूरत हो',
    
    // Trust
    'trust.title': 'विश्वास और सुरक्षा के साथ बनाया गया',
    'trust.aiNote': 'AI निदान नहीं करता',
    'trust.aiNoteDesc': 'हमारा AI मार्गदर्शन प्रदान करता है, चिकित्सा निदान नहीं।',
    'trust.doctorsFirst': 'डॉक्टर-प्रथम तर्क',
    'trust.doctorsFirstDesc': 'सभी सुरक्षा नियम बाल चिकित्सा विशेषज्ञता के साथ डिज़ाइन किए गए हैं।',
    'trust.privacy': 'गोपनीयता-प्रथम डिज़ाइन',
    'trust.privacyDesc': 'आपका डेटा एन्क्रिप्टेड है और कभी साझा नहीं किया जाता।',
    
    // Footer
    'footer.about': 'हमारे बारे में',
    'footer.contact': 'संपर्क',
    'footer.privacy': 'गोपनीयता नीति',
    'footer.disclaimer': 'आपातकालीन अस्वीकरण',
    'footer.tagline': 'पूरे भारत में परिवारों की देखभाल',
    
    // Auth
    'auth.login.title': 'वापस स्वागत है',
    'auth.login.subtitle': 'अपने छोटे की देखभाल जारी रखने के लिए साइन इन करें',
    'auth.signup.title': 'हमारे परिवार में शामिल हों',
    'auth.signup.subtitle': 'अपनी देखभाल यात्रा शुरू करने के लिए खाता बनाएं',
    'auth.email': 'ईमेल',
    'auth.password': 'पासवर्ड',
    'auth.confirmPassword': 'पासवर्ड की पुष्टि करें',
    'auth.name': 'पूरा नाम',
    'auth.loginBtn': 'लॉग इन',
    'auth.signupBtn': 'साइन अप',
    'auth.googleBtn': 'Google से जारी रखें',
    'auth.noAccount': 'खाता नहीं है?',
    'auth.hasAccount': 'पहले से खाता है?',
    
    // Dashboard
    'dashboard.welcome': 'आप बहुत अच्छा कर रहे हैं',
    'dashboard.babySummary': 'बेबी सारांश',
    'dashboard.age': 'उम्र',
    'dashboard.lastFeed': 'अंतिम फीड',
    'dashboard.lastSleep': 'अंतिम नींद',
    'dashboard.status': 'स्थिति',
    'dashboard.alerts': 'अलर्ट',
    'dashboard.mentalHealth': 'आप कैसा महसूस कर रहे हैं?',
    'dashboard.emergency': 'आपातकालीन सहायता',
    'dashboard.callDoctor': 'डॉक्टर को कॉल करें',
    'dashboard.findHospital': 'अस्पताल खोजें',
    
    // Baby Profile
    'profile.title': 'बेबी प्रोफ़ाइल',
    'profile.subtitle': 'हमें अपने छोटे के बारे में बताएं',
    'profile.babyName': 'बच्चे का नाम',
    'profile.dob': 'जन्म तिथि',
    'profile.gestationalAge': 'गर्भकालीन आयु (सप्ताह)',
    'profile.weight': 'वर्तमान वजन (किलो)',
    'profile.save': 'प्रोफ़ाइल सहेजें',
    
    // Daily Log
    'log.title': 'दैनिक देखभाल लॉग',
    'log.feeding': 'फीडिंग',
    'log.sleep': 'नींद',
    'log.medication': 'दवाई',
    'log.time': 'समय',
    'log.quantity': 'मात्रा (मिली)',
    'log.duration': 'अवधि (घंटे)',
    'log.given': 'दिया गया',
    'log.notGiven': 'नहीं दिया',
    'log.add': 'एंट्री जोड़ें',

    // Nutrition Awareness
    'nutrition.title': 'स्थानीय पोषण जागरूकता',
    'nutrition.subtitle': 'नई माताओं के लिए सांस्कृतिक रूप से प्रासंगिक कल्याण युक्तियाँ',
    'nutrition.iron.title': 'भारतीय घरों में आयरन युक्त खाद्य पदार्थ',
    'nutrition.iron.content': 'पालक, गुड़, खजूर और दाल जैसे खाद्य पदार्थ भारतीय घरों में आमतौर पर उपयोग किए जाते हैं और इनमें आयरन की मात्रा होती है।',
    'nutrition.hydration.title': 'सरल हाइड्रेशन रिमाइंडर',
    'nutrition.hydration.content': 'नई माताओं के लिए हाइड्रेटेड रहना महत्वपूर्ण है। छाछ, नारियल पानी और जीरा पानी जैसे पारंपरिक पेय का आनंद लिया जाता है।',
    'nutrition.meals.title': 'संतुलित घर का बना भोजन',
    'nutrition.meals.content': 'घर के बने भोजन में साबुत अनाज, सब्जियां, प्रोटीन और स्वस्थ वसा का मिश्रण रिकवरी के दौरान समग्र कल्याण का समर्थन कर सकता है।',
    'nutrition.traditional.title': 'पारंपरिक प्रसवोत्तर प्रथाएं',
    'nutrition.traditional.content': 'कई भारतीय परिवार अजवाइन लड्डू, सूखे मेवे और गर्म सूप जैसे पारंपरिक खाद्य पदार्थों का पालन करते हैं। ये पीढ़ियों से चली आ रही सांस्कृतिक प्रथाओं का हिस्सा हैं।',
    'nutrition.disclaimer': 'केवल सामान्य जागरूकता। चिकित्सा या आहार सलाह नहीं। कृपया अपने डॉक्टर या पोषण विशेषज्ञ से परामर्श लें।',

    // Rule Trace Explanation
    'ruleTrace.whySeeing': 'यह क्यों दिख रहा है?',
    'ruleTrace.modalTitle': 'इस अलर्ट को समझें',
    'ruleTrace.triggeredRule': 'ट्रिगर किया गया नियम',
    'ruleTrace.whatCaused': 'इसका कारण',
    'ruleTrace.whyMatters': 'यह क्यों मायने रखता है',
    'ruleTrace.defaultRule': 'सुरक्षा निगरानी नियम सक्रिय',
    'ruleTrace.defaultTrigger': 'लॉग किए गए देखभाल डेटा के आधार पर',
    'ruleTrace.defaultExplanation': 'यह सुनिश्चित करने में मदद करता है कि आपके बच्चे को लगातार देखभाल मिले।',
    'ruleTrace.reassurance': 'ये अलर्ट केवल मार्गदर्शन हैं। आप अपने बच्चे को सबसे अच्छी तरह जानते हैं। अपनी प्रवृत्ति पर भरोसा करें।',

    // Mood Check-in
    'mood.title': 'साप्ताहिक चेक-इन',
    'mood.subtitle': 'अपना ख्याल रखना भी मायने रखता है',
    'mood.struggling': 'मुश्किल',
    'mood.okay': 'ठीक',
    'mood.good': 'अच्छा',
    'mood.prompt': 'आज आप कैसा महसूस कर रहे हैं, यह साझा करने के लिए टैप करें',
    'mood.response.struggling': 'कभी-कभी अभिभूत महसूस करना ठीक है। आप अपना सर्वश्रेष्ठ कर रहे हैं, और सहायता मांगना हमेशा ठीक है। याद रखें, आपको यह अकेले नहीं करना है। 💙',
    'mood.response.okay': 'कुछ दिन बस ठीक होते हैं, और यह बिल्कुल ठीक है। आप अपने छोटे के लिए मौजूद हैं, और इसमें ताकत लगती है। एक समय में एक कदम उठाएं।',
    'mood.response.good': 'यह सुनकर बहुत अच्छा लगा! आपकी सकारात्मक ऊर्जा आपको और आपके बच्चे दोनों को लाभ पहुंचाती है। अपना भी ख्याल रखें। 💙',
    'mood.disclaimer': 'यह एक क्लीनिकल असेसमेंट नहीं है। लगातार चिंताओं के लिए, कृपया स्वास्थ्य सेवा प्रदाता से बात करें।',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
