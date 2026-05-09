/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Settings, 
  HelpCircle, 
  ClipboardList, 
  ExternalLink, 
  Mail, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Paintbrush,
  Image as ImageIcon,
  Download,
  RotateCw,
  FileImage,
  Eye,
  EyeOff,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface PatchNote {
  date: string;
  version: string;
  changes: string[];
}

const PATCH_NOTES: PatchNote[] = [
  {
    date: '2026-04-24',
    version: 'v1.0.2',
    changes: [
      '멀티 로고 생성 엔진 탑재 (3가지 옵션 동시 생성)',
      '브랜드 명칭 시각화 알고리즘 고도화',
      '결과물 전시 그리드 레이아웃 개선',
      '실시간 렌더링 피드백 시스템 업데이트'
    ]
  },
  {
    date: '2026-04-24',
    version: 'v1.0.0',
    changes: [
      '혁신 로고 AI 최초 런칭',
      'Gemini AI 기반 로고 생성 엔진 탑재',
      '실시간 진행률 표시 기능 추가',
      '사용자 정의 API 키 입력 기능 구현',
      '패치노트 및 도움말 시스템 구축'
    ]
  }
];

const USAGE_STEPS = [
  { id: 1, title: 'API 키 설정', description: '우측 상단 설정 버튼을 통해 Google API 키를 입력하세요.' },
  { id: 2, title: '로고 정보 입력', description: '제작하고 싶은 로고의 브랜드명, 스타일, 색상을 입력합니다.' },
  { id: 3, title: '생성하기', description: '버튼을 클릭하면 AI가 디자인 핵심을 분석하여 로고를 생성합니다.' },
  { id: 4, title: '결과 확인', description: '생성된 로고 이미지를 확인하고 필요시 재시도할 수 있습니다.' }
];

// --- Components ---

const Modal = ({ title, isOpen, onClose, children }: { title: string, isOpen: boolean, onClose: () => void, children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-between p-6 border-bottom border-zinc-800">
            <h3 className="text-xl font-bold text-zinc-100">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default function App() {
  const [apiKey, setApiKey] = useState<string>(process.env.GEMINI_API_KEY || '');
  const [tempKey, setTempKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const [showInquiry, setShowInquiry] = useState(false);
  const [showUsageGuideModal, setShowUsageGuideModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showKeyVisible, setShowKeyVisible] = useState(false);
  
  const [brandName, setBrandName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [industry, setIndustry] = useState('tech');
  const [concept, setConcept] = useState('');
  const [mood, setMood] = useState('professional');
  const [symbol, setSymbol] = useState('브랜드 명칭의 톤앤매너에 맞는 상징물');
  const [colorTheme, setColorTheme] = useState('브랜드 명칭의 톤앤매너와 어울리는 색상톤');
  const [style, setStyle] = useState('minimalist');
  const [layout, setLayout] = useState('Combination Mark');
  const [typography, setTypography] = useState('Modern Sans-Serif');
  const [finish, setFinish] = useState('Flat Design');
  const [logoCount, setLogoCount] = useState(1);
  const [referenceImageData, setReferenceImageData] = useState<string | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [patchNotes, setPatchNotes] = useState<PatchNote[]>(PATCH_NOTES);
  const [livePatchVersion, setLivePatchVersion] = useState("V1.0.1");

  useEffect(() => {
    const fetchPatchNotes = async () => {
      try {
        const res = await fetch(`./patch-notes.json?t=${new Date().getTime()}`);
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            setPatchNotes(data);
            if (data.length > 0) {
              setLivePatchVersion(data[0].version.toUpperCase());
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch patch notes", err);
      }
    };

    fetchPatchNotes();
    // 심리스한 실시간 폴링 갱신
    const timer = setInterval(fetchPatchNotes, 30000); 
    return () => clearInterval(timer);
  }, []);
  const [regeneratingIndices, setRegeneratingIndices] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!brandName) {
      setError('브랜드 명칭을 입력해주세요.');
      return;
    }

    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setGeneratedImageUrls([]);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const urls: string[] = [];
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      for (let i = 0; i < logoCount; i++) {
        if (i > 0) await delay(1500);
        const stepProgress = Math.floor((i / logoCount) * 100);
        setProgress(stepProgress + 5);
        
        let promptOptimizer = `당신은 세계적인 로고 디자이너 및 브랜드 전략가이자 서체 전문가입니다. 아래 정보를 바탕으로 AI 이미지 생성 모델을 위한 아주 상세하고 예술적인 로고 생성 프롬프트를 작성하세요. 현재 생성 옵션 #${i + 1}입니다.
        
브랜드 명칭: ${brandName}
슬로건: ${slogan}
산업군: ${industry}
디자인 컨셉: ${concept}
감성/분위기: ${mood}
상징 요소: ${symbol}
색상: ${colorTheme}
스타일: ${style}
레이아웃: ${layout}
서체 스타일: ${typography}
질감 및 마감: ${finish}

[지침]
1. 결과는 오직 '영문 프롬프트'만 하나로 출력하세요.
2. 로고는 고해상도(8k), 벡터 스타일, 상업적 수준의 프리미엄 디자인이어야 합니다.
3. 브랜드 이름인 "${brandName}"을 로고의 핵심 디자인 요소로 포함시키되, 반드시 '한글(Korean)' 서체를 깨짐이나 오류 없이 완벽하고 정교하게 렌더링하도록 지시하세요. (MANDATORY: Render the Korean text "${brandName}" with pristine clarity and Zero artifacts. The typography must be legible and artistically integrated.)
4. 이 브랜드가 가진 고유한 정체성을 시각적으로 극대화할 수 있는 영감을 프롬프트에 담으세요.
5. 옵션 #${i + 1}에 맞춰서 이전과는 약간 다른 구도나 스타일적 변주를 주어 생성하세요.
6. 불필요한 서술 없이 프롬프트 텍스트만 출력하세요.`;

        let partsForOptimizer: any[] = [];
        
        if (referenceImageData) {
           promptOptimizer += `\n7. [위 내용에 더하여 중요] 사용자가 제공한 첨부 참고 이미지를 참고하여 그 주된 스타일, 형태, 색감, 감성을 깊게 분석하여 새 로고 디자인에 그 특징들이 분명하게 반영되도록 영문 프롬프트에 구체적으로 묘사하세요. 원본 요소를 단순히 베끼지 말고 주어진 브랜드 정보와 융합하세요.`;
           partsForOptimizer = [
              { text: promptOptimizer },
              { inlineData: { data: referenceImageData.split(',')[1], mimeType: referenceImageData.split(',')[0].split(':')[1].split(';')[0] } }
           ];
        } else {
           partsForOptimizer = [{ text: promptOptimizer }];
        }

        setProgress(stepProgress + 15);
        const optimizationResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: { parts: partsForOptimizer }
        });
        const optimizedPrompt = optimizationResponse.text?.trim() || `Professional premium logo for ${brandName}, ${industry} industry, ${style} style, ${colorTheme} colors, high quality, vector style, featuring perfectly rendered Korean text "${brandName}"`;
        
        setProgress(stepProgress + 25);
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts: [{ text: optimizedPrompt }]
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "1K"
            }
          }
        });

        const candidates = imageResponse.candidates;
        let found = false;
        for (const part of candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const base64Data = part.inlineData.data;
            urls.push(`data:image/png;base64,${base64Data}`);
            setGeneratedImageUrls([...urls]); // Real-time update
            found = true;
            break;
          }
        }
      }

      if (urls.length === 0) {
        throw new Error('모든 이미지 생성 시도에 실패했습니다. API 설정을 확인하거나 잠시 후 다시 시도해주세요.');
      }

      setProgress(100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '로고 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateOne = async (index: number) => {
    if (!brandName || !apiKey) return;
    
    setRegeneratingIndices(prev => [...prev, index]);
    try {
      const ai = new GoogleGenAI({ apiKey });
      let promptOptimizer = `당신은 세계적인 로고 디자이너이자 브랜드 전략가입니다.
브랜드 명칭: ${brandName}
슬로건: ${slogan}
산업군: ${industry}
디자인 컨셉: ${concept}
감성/분위기: ${mood}
상징 요소: ${symbol}
색상: ${colorTheme}
스타일: ${style}
레이아웃: ${layout}
서체 스타일: ${typography}
질감 및 마감: ${finish}

위 정보를 바탕으로 아주 창의적이고 프리미엄한 로고 생성 영문 프롬프트를 작성하세요. 
한글 "${brandName}" 텍스트가 깨짐 없이 완벽하게 렌더링되어야 함을 강력하게 지시하세요.
결과는 오직 영문 프롬프트 1개만 출력하세요.`;

      let partsForOptimizer: any[] = [];
      if (referenceImageData) {
         promptOptimizer += `\n[추가 중요 지시사항] 사용자가 첨부한 참고 이미지의 스타일, 톤앤매너, 형태를 분석하여 이번 로고의 디자인 지시문에 강하게 반영하세요.`;
         partsForOptimizer = [
            { text: promptOptimizer },
            { inlineData: { data: referenceImageData.split(',')[1], mimeType: referenceImageData.split(',')[0].split(':')[1].split(';')[0] } }
         ];
      } else {
         partsForOptimizer = [{ text: promptOptimizer }];
      }

      const optimizationResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: partsForOptimizer }
      });
      const optimizedPrompt = optimizationResponse.text?.trim() || `Premium logo for ${brandName}, ${style} style, Korean text "${brandName}"`;
      
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: [{ text: optimizedPrompt }] },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
      });

      const candidates = imageResponse.candidates;
      for (const part of candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const newUrl = `data:image/png;base64,${base64Data}`;
          setGeneratedImageUrls(prev => {
            const next = [...prev];
            next[index] = newUrl;
            return next;
          });
          break;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRegeneratingIndices(prev => prev.filter(i => i !== index));
    }
  };

  const handleDownload = (url: string, format: 'png' | 'jpg', index: number) => {
    const link = document.createElement('a');
    
    if (format === 'jpg') {
      // For JPG conversion in browser, we'd need a canvas, but simple rename works for many triggers
      // though actual transcoding is better. For now, let's just trigger PNG download as requested
      // and label it. In a real prod environment we'd use a canvas draw.
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          link.href = canvas.toDataURL('image/jpeg', 0.9);
          link.download = `logo_${brandName}_${index + 1}.jpg`;
          link.click();
        }
      };
      img.src = url;
    } else {
      link.href = url;
      link.download = `logo_${brandName}_${index + 1}.png`;
      link.click();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImageData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = () => {
    setReferenceImageData(null);
  };

  const saveApiKey = () => {
    setApiKey(tempKey);
    setShowApiKeyModal(false);
  };

  return (
    <div className="min-h-screen bg-[#030305] text-zinc-100 font-sans flex flex-col select-none overflow-x-hidden relative">
      {/* Background Enhancements */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-900/20 blur-[150px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/20 blur-[150px] rounded-full mix-blend-screen"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
      </div>
      
      <header className="h-16 px-6 flex items-center justify-between bg-white/[0.01] border-b border-white/5 shrink-0 sticky top-0 z-40 backdrop-blur-3xl">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)] ${isGenerating ? 'bg-amber-500 shadow-amber-500/50' : 'bg-emerald-500'}`}></div>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
            {isGenerating ? 'AI 프로세싱 중' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden sm:flex items-center bg-white/5 rounded-full px-4 py-1.5 border border-white/10">
            <div className={`w-1.5 h-1.5 rounded-full mr-3 ${apiKey ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-zinc-600'}`}></div>
            <button 
              onClick={() => setShowApiKeyModal(true)}
              className="text-[10px] font-black text-zinc-400 hover:text-white transition-colors uppercase tracking-widest"
            >
              API 인증 설정
            </button>
          </div>
          <button 
            onClick={() => setShowUsageModal(true)}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowUsageGuideModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-blue-400 hover:bg-white/10 transition-all"
          >
            <HelpCircle className="w-3 h-3" /> 사용방법
          </button>
          <button 
            onClick={() => setShowCostModal(true)}
            className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-amber-500 hover:bg-white/10 transition-all"
          >
            <Coins className="w-3 h-3" /> API 비용
          </button>
          <button 
            onClick={() => setShowPatchNotes(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-[10px] font-black hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-900/50 active:scale-95"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            패치노트 {livePatchVersion}
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 벤토 그리드 */}
      <main className="flex-1 p-6 lg:p-10 max-w-[1600px] mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6">
        
        <div className="md:col-span-4 space-y-6 relative z-10">
          <div className="bg-zinc-950/40 rounded-[2.5rem] border border-white/10 p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">로고 빌더</h2>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">BRAND IDENTITY DESIGN</p>
              </div>
              <Paintbrush className="w-6 h-6 text-zinc-700" />
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">브랜드 명칭</label>
                  <input 
                    type="text" 
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="예: NEXTIN"
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">슬로건</label>
                  <input 
                    type="text" 
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    placeholder="예: 미래를 그리는 혁신"
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-zinc-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">브랜드 산업군</label>
                  <select 
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                  >
                    <option value="tech" className="bg-zinc-900">IT / 테크놀로지</option>
                    <option value="beauty" className="bg-zinc-900">뷰티 / 패션 브랜드</option>
                    <option value="food" className="bg-zinc-900">음식점 / 카페 / F&B</option>
                    <option value="finance" className="bg-zinc-900">금융 / 법률 / 전문직</option>
                    <option value="education" className="bg-zinc-900">교육 / 연구 기관</option>
                    <option value="medical" className="bg-zinc-900">의료 / 헬스케어</option>
                    <option value="creative" className="bg-zinc-900">크리에이티브 스튜디오</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">핵심 감성 및 페르소나</label>
                  <select 
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                  >
                    <option value="professional" className="bg-zinc-900">전문적인 (Professional)</option>
                    <option value="friendly" className="bg-zinc-900">친근한 (Friendly)</option>
                    <option value="energetic" className="bg-zinc-900">열정적인 (Energetic)</option>
                    <option value="luxurious" className="bg-zinc-900">럭셔리한 (Luxurious)</option>
                    <option value="playful" className="bg-zinc-900">활기찬 (Playful)</option>
                    <option value="stoic" className="bg-zinc-900">안정적인 (Stoic)</option>
                    <option value="innovative" className="bg-zinc-900">혁신적인 (Innovative)</option>
                    <option value="minimal" className="bg-zinc-900">미니멀한 (Minimal)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">로고 생성 개수</label>
                <select 
                  value={logoCount}
                  onChange={(e) => setLogoCount(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num} className="bg-zinc-900">{num}개 생성</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">희망 상징물 (Symbol)</label>
                <select 
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                >
                  <option value="브랜드 명칭의 톤앤매너에 맞는 상징물" className="bg-zinc-900">브랜드 지향점 중심 (Default)</option>
                  <option value="추상적 도형 (Abstract Shape)" className="bg-zinc-900">추상적 기하학 형태</option>
                  <option value="동물 상징 (Animal Icon)" className="bg-zinc-900">강인한 동물 심볼</option>
                  <option value="자연 및 식물 (Nature/Organic)" className="bg-zinc-900">자연 친화적 요소</option>
                  <option value="첨단 기술 패브릭 (Tech Mesh)" className="bg-zinc-900">IT 및 기술 상징</option>
                  <option value="엠블럼 타이포그래피 (Lettermark)" className="bg-zinc-900">글자 중심 이니셜형</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">색상톤</label>
                  <select 
                    value={colorTheme}
                    onChange={(e) => setColorTheme(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                  >
                    <option value="브랜드 명칭의 톤앤매너와 어울리는 색상톤" className="bg-zinc-900">AI 추천 톤앤매너</option>
                    <option value="Premium Black & Silver" className="bg-zinc-900">모노톤 (Silver/Gold)</option>
                    <option value="Corporate Blue & White" className="bg-zinc-900">신뢰의 블루 & 화이트</option>
                    <option value="Soft Pastel Harmony" className="bg-zinc-900">파스텔 톤 (Pastel)</option>
                    <option value="High Contrast Vivid" className="bg-zinc-900">선명한 컬러 (Vivid)</option>
                    <option value="Natural Earth Tone" className="bg-zinc-900">어스톤 (Earth Tone)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">지향 스타일</label>
                  <select 
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                  >
                    <option value="minimalist" className="bg-zinc-900">심플 미니멀리즘</option>
                    <option value="abstract" className="bg-zinc-900">추상적 아트</option>
                    <option value="classical" className="bg-zinc-900">클래식 & 문장형</option>
                    <option value="geometric" className="bg-zinc-900">기하학적 도형</option>
                    <option value="hand-drawn" className="bg-zinc-900">핸드 드로잉 감성</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">로고 구성 레이아웃</label>
                <select 
                  value={layout}
                  onChange={(e) => setLayout(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                >
                  <option value="Combination Mark" className="bg-zinc-900">심볼 + 텍스트형 (Combination)</option>
                  <option value="Pictorial Mark" className="bg-zinc-900">심볼 강조형 (Pictorial)</option>
                  <option value="Wordmark" className="bg-zinc-900">텍스트 강조형 (Wordmark)</option>
                  <option value="Abstract Mark" className="bg-zinc-900">추상 심볼형 (Abstract)</option>
                  <option value="Emblem" className="bg-zinc-900">엠블럼/배지형 (Emblem)</option>
                  <option value="Monogram" className="bg-zinc-900">이니셜 모노그램 (Monogram)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">타이포그래피 컨셉</label>
                  <select 
                    value={typography}
                    onChange={(e) => setTypography(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                  >
                    <option value="Modern Sans-Serif" className="bg-zinc-900">모던 고딕 (Sans-Serif)</option>
                    <option value="Elegant Serif" className="bg-zinc-900">우아한 명조 (Serif)</option>
                    <option value="Bold Grotesque" className="bg-zinc-900">강렬한 볼드체 (Bold)</option>
                    <option value="Calligraphy Script" className="bg-zinc-900">손글씨/캘리그래피 (Script)</option>
                    <option value="Display Decorative" className="bg-zinc-900">독특한 장식체 (Display)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">마감 및 질감</label>
                  <select 
                    value={finish}
                    onChange={(e) => setFinish(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-white appearance-none cursor-pointer"
                  >
                    <option value="Flat Design" className="bg-zinc-900">플랫 디자인 (Flat)</option>
                    <option value="3D Rendering" className="bg-zinc-900">입체적 3D (3D)</option>
                    <option value="Metallic Glossy" className="bg-zinc-900">금속광택 (Metallic)</option>
                    <option value="Hand-drawn Sketch" className="bg-zinc-900">수채화 드로잉 (Hand-drawn)</option>
                    <option value="Matte Texture" className="bg-zinc-900">무광 매트 (Matte)</option>
                    <option value="Neon Glow" className="bg-zinc-900">네온 글로우 (Neon)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">참고 이미지 (선택사항)</label>
                {referenceImageData ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-white/10 group">
                    <img src={referenceImageData} alt="Reference" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <button
                        onClick={removeReferenceImage}
                        className="px-4 py-2 bg-red-500/80 text-white rounded-full text-xs font-bold hover:bg-red-500 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full h-32 flex flex-col items-center justify-center bg-white/5 border border-white/5 border-dashed rounded-xl text-zinc-500 hover:border-blue-500/50 hover:bg-white/10 transition-all">
                      <ImageIcon className="w-6 h-6 mb-2 opacity-50" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">클릭하거나 파일 드래그 (JPG/PNG)</span>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] font-bold text-red-400">{error}</span>
                </div>
              )}
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-8 w-full py-5 bg-white text-black rounded-2xl font-black text-sm tracking-tight hover:bg-zinc-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-2xl active:scale-[0.98]"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin text-zinc-900" /> : <Paintbrush className="w-5 h-5" />}
              AI 로고 생성 엔진 가동
            </button>
          </div>
        </div>

        {/* 결과물 전시 및 메인 디스플레이 (우측 8/12) */}
        <div className="md:col-span-8 flex flex-col gap-6">
          
          {/* 하이라이트 배너 */}
          <div className="h-48 rounded-[2.5rem] bg-gradient-to-r from-blue-600 to-indigo-700 overflow-hidden relative shadow-2xl group">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
             <div className="absolute inset-0 bg-black/10"></div>
             <div className="relative h-full flex flex-col justify-center px-10">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                   <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.4em]">Advanced Design OS</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter italic">혁신 로고 AI</h1>
             </div>
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
               className="absolute -top-20 -right-20 w-64 h-64 border-[1px] border-white/10 rounded-full"
             />
          </div>

          <div className="flex-1 bg-zinc-950 rounded-[3rem] border border-white/5 relative overflow-hidden flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
            <div className="absolute top-10 left-10 flex items-center gap-3 z-10">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
              <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.3em]">AI 렌더링 결과물</h3>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-start p-10 relative overflow-y-auto max-h-[700px] scrollbar-hide">
              {isGenerating && generatedImageUrls.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                  <div className="relative mb-12">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                      className="w-80 h-80 border-[2px] border-white/5 rounded-full flex items-center justify-center"
                    >
                      <div className="absolute top-0 w-4 h-4 bg-blue-500 rounded-full blur-[2px]"></div>
                    </motion.div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-7xl font-black text-white tracking-tighter">{progress}%</span>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-2">디자인 엔진 가동 중</span>
                    </div>
                  </div>
                  <motion.p 
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-sm font-black text-zinc-400 italic max-w-sm"
                  >
                    브랜드 아이덴티티의 정수를 분석하여 최적의 심볼을 연산 중입니다.
                  </motion.p>
                </div>
              ) : generatedImageUrls.length > 0 ? (
                <div className="w-full space-y-12 py-10">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {generatedImageUrls.map((url, idx) => (
                        <div key={idx} className="relative group flex flex-col gap-3">
                           <div className="absolute -top-4 left-4 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-lg z-10 shadow-lg">
                             DESIGN OPTION 0{idx + 1}
                           </div>
                           
                           <div className="relative aspect-square overflow-hidden rounded-[2.5rem] shadow-2xl border border-white/10 group">
                             <img 
                               src={url} 
                               alt={`Generated Logo ${idx + 1}`} 
                               className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                               referrerPolicy="no-referrer"
                             />
                             {regeneratingIndices.includes(idx) && (
                               <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center z-20">
                                 <div className="relative">
                                    <Loader2 className="w-10 h-10 animate-spin text-white mb-4" />
                                    <div className="absolute inset-0 blur-xl bg-white/20 animate-pulse"></div>
                                 </div>
                                 <span className="text-[10px] font-black text-white uppercase tracking-widest">다시 렌더링 중...</span>
                               </div>
                             )}
                           </div>
                           
                           {/* 이미지 하단 액션 바 - Always Visible */}
                           <div className="flex flex-col gap-2 p-1">
                             <div className="grid grid-cols-2 gap-2">
                               <button 
                                 onClick={() => handleDownload(url, 'png', idx)}
                                 className="py-3 bg-white/5 border border-white/5 text-white rounded-xl font-black text-[9px] flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                               >
                                 <Download className="w-3 h-3 text-blue-500" /> PNG 저장
                               </button>
                               <button 
                                 onClick={() => handleDownload(url, 'jpg', idx)}
                                 className="py-3 bg-white/5 border border-white/5 text-white rounded-xl font-black text-[9px] flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                               >
                                 <FileImage className="w-3 h-3 text-emerald-500" /> JPG 저장
                               </button>
                             </div>
                             <button 
                               onClick={() => handleRegenerateOne(idx)}
                               disabled={regeneratingIndices.includes(idx)}
                               className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
                             >
                               <RotateCw className={`w-3 h-3 ${regeneratingIndices.includes(idx) ? 'animate-spin' : ''}`} /> 디자인 다시 만들기
                             </button>
                           </div>

                           <div className="flex justify-center">
                              <div className="bg-white/5 backdrop-blur-2xl py-1.5 px-5 rounded-full border border-white/5 text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">
                                {regeneratingIndices.includes(idx) ? 'RE-PROCESS...' : 'IDENTIFIER: ' + (idx + 1024).toString(16).toUpperCase()}
                              </div>
                           </div>
                        </div>
                    ))}
                  </div>
                  
                  {isGenerating && (
                    <div className="flex flex-col items-center gap-4 py-10 border-t border-white/5">
                      <div className="flex items-center gap-3">
                         <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                         <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">추가 디자인 렌더링 중... ({progress}%)</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-zinc-800">
                  <div className="w-32 h-32 bg-white/5 rounded-[3rem] flex items-center justify-center border border-white/5 mb-8">
                    <ImageIcon className="w-12 h-12 opacity-10" />
                  </div>
                  <p className="text-sm font-black opacity-20 uppercase tracking-[0.4em]">대기 상태</p>
                </div>
              )}
            </div>
            
            {/* 보안 레이어 (텍스트 선택 방지 등) */}
            <div className="absolute inset-0 z-[1] pointer-events-none"></div>
          </div>
        </div>

      </main>

      {/* 하단 시스템 정보 바 */}
      <footer className="h-16 px-10 flex flex-col md:flex-row items-center justify-between border-t border-white/5 shrink-0 bg-black/40 backdrop-blur-xl z-30">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">설계 및 개발</span>
            <span className="text-[12px] font-black text-zinc-300 tracking-tighter">정혁신 (JHX-DEV)</span>
          </div>
          <div className="hidden lg:block h-3 w-px bg-white/10"></div>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] hidden lg:block">브랜드 지능 플랫폼 v1.0.1</p>
        </div>
        
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <button 
            onClick={() => setShowInquiry(true)}
            className="text-[10px] font-black text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
          >
            지원요청
          </button>
          <a 
            href="https://hyeoksinai.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full text-[10px] font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/10 active:scale-95"
          >
            혁신 AI 플랫폼 바로가기 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>

      {/* 모달 시스템 */}
      <Modal title="서비스 사용 안내" isOpen={showUsageModal} onClose={() => setShowUsageModal(false)}>
        <div className="space-y-6 py-4">
          {USAGE_STEPS.map((step) => (
            <div key={step.id} className="flex gap-6 group">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center text-lg font-black shadow-xl group-hover:scale-110 transition-transform">
                {step.id}
              </div>
              <div className="flex-1 border-b border-white/5 pb-5">
                <h4 className="font-black text-white text-lg tracking-tight">{step.title}</h4>
                <p className="text-sm font-bold text-zinc-500 leading-relaxed mt-1.5">{step.description}</p>
              </div>
            </div>
          ))}
          <button 
            onClick={() => setShowUsageModal(false)}
            className="w-full mt-6 py-5 bg-white text-black rounded-2xl font-black text-base transition-all hover:bg-zinc-200 shadow-2xl"
          >
            확인 및 계속하기
          </button>
        </div>
      </Modal>

      <Modal title="API 인증 설정" isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)}>
        <div className="space-y-6">
          <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-600/20 flex gap-4">
             <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
             <p className="text-xs font-bold text-blue-100/60 leading-relaxed tracking-tight">
               로고 생성을 위해서는 Google Gemini API 키가 필요합니다. 입력된 키는 귀하의 브라우저 로컬 저장소에만 안전하게 기록됩니다.
             </p>
          </div>
          <div className="relative">
            <input 
              type={showKeyVisible ? "text" : "password"}
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Gemini API Key를 입력하세요"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-14 focus:border-blue-500 font-black transition-all outline-none text-white"
            />
            <button 
              onClick={() => setShowKeyVisible(!showKeyVisible)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-white transition-colors"
            >
              {showKeyVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={saveApiKey}
              className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/10"
            >
              인증 키 적용
            </button>
            <button 
              onClick={() => setShowApiKeyModal(false)}
              className="flex-1 py-5 bg-white/5 text-zinc-400 rounded-2xl font-black hover:bg-white/10 transition-all"
            >
              취소
            </button>
          </div>
        </div>
      </Modal>

      <Modal title="혁신 로고 AI 사용방법" isOpen={showUsageGuideModal} onClose={() => setShowUsageGuideModal(false)}>
        <div className="space-y-8 py-2">
          <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-600/20">
             <p className="text-xs font-bold text-blue-100/80 leading-relaxed tracking-tight">
               혁신 로고 AI는 전문 디자이너의 사고방식을 학습한 인공지능이 당신의 브랜드에 딱 맞는 프리미엄 로고를 단 몇 초 만에 제작해드립니다.
             </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-black text-white">01</div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">브랜드 정체성 입력</h4>
                <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">브랜드 이름과 슬로건, 그리고 어떤 산업군(IT, 요식업, 금융 등)인지 입력해주세요. 상세할수록 정교한 결과가 나옵니다.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-black text-white">02</div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">스타일 및 페르소나 설정</h4>
                <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">'전문적인', '친근한' 등 원하는 분위기와 색상톤, 지향하는 스타일을 드롭다운 메뉴에서 선택하세요.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-black text-white">03</div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">AI 엔진 가동</h4>
                <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">'AI 로고 생성 엔진 가동' 버튼을 클릭하면, AI가 수만 가지 디자인 조합 중 최적의 로고 3가지를 동시에 렌더링합니다.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-black text-white">04</div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">파일 저장 및 재렌더링</h4>
                <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">마음에 드는 로고가 있다면 PNG 또는 JPG로 즉시 다운로드하세요. 조금 더 수정이 필요하다면 '다시 만들기'를 눌러 새로운 시안을 확인하세요.</p>
              </div>
            </div>
          </div>

          <div className="p-5 bg-zinc-900 border border-white/5 rounded-2xl">
             <div className="flex items-center gap-2 mb-2">
               <AlertCircle className="w-3 h-3 text-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase">꿀팁</span>
             </div>
             <p className="text-[10px] text-zinc-400 font-bold leading-relaxed">
               로고에 반드시 포함되어야 하는 특정한 상징(예: 독수리, 톱니바퀴)이 있다면 '상징물' 옵션에서 선택하거나 컨셉 설명에 자세히 적어주세요!
             </p>
          </div>

          <button 
            onClick={() => setShowUsageGuideModal(false)}
            className="w-full py-5 bg-white text-black rounded-2xl font-black hover:bg-zinc-200 transition-all shadow-xl"
          >
            확인했습니다
          </button>
        </div>
      </Modal>

      <Modal title="API 이용 비용 가이드" isOpen={showCostModal} onClose={() => setShowCostModal(false)}>
        <div className="space-y-6">
          <div className="bg-amber-600/10 p-6 rounded-3xl border border-amber-600/20 flex gap-4">
             <Coins className="w-5 h-5 text-amber-500 shrink-0" />
             <p className="text-xs font-bold text-amber-100/60 leading-relaxed tracking-tight font-sans">
               본 서비스는 Google Cloud Vertex AI 모델을 사용합니다. 아래는 1회 생성(로고 1개 기준) 당 예상 비용입니다. (추정 환율: 1,400원/$)
             </p>
          </div>
          
          <div className="space-y-3">
            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">PROMPT OPTIMIZER (GEMINI 3 FLASH)</div>
                <div className="text-sm font-black text-white">프롬프트 최적화 (1,000토큰 기준)</div>
              </div>
              <div className="text-right text-emerald-400 font-bold">약 0.14원</div>
            </div>

            <div className="p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">IMAGE GENERATOR (IMAGEN 3)</div>
                <div className="text-sm font-black text-white">로고 이미지 생성 (1장 기준)</div>
              </div>
              <div className="text-right text-emerald-400 font-bold">약 42.00원</div>
            </div>

            <div className="p-6 bg-blue-600/20 border border-blue-600/30 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">TOTAL ESTIMATED COST</div>
                <div className="text-lg font-black text-white">합계 (로고 1개당)</div>
              </div>
              <div className="text-right text-xl font-black text-white">약 42.14원</div>
            </div>
          </div>

          <div className="pt-4">
             <p className="text-[10px] text-zinc-500 text-center font-bold leading-relaxed px-4">
               * 실제 청구 비용은 Google Cloud 정책 및 사용량(토큰 수, 출력 크기 등)에 따라 실시간으로 변동될 수 있습니다.
             </p>
          </div>
          
          <button 
            onClick={() => setShowCostModal(false)}
            className="w-full py-5 bg-white text-black rounded-2xl font-black hover:bg-zinc-200 transition-all shadow-xl"
          >
            닫기
          </button>
        </div>
      </Modal>

      <Modal title="실시간 업데이트 패치노트" isOpen={showPatchNotes} onClose={() => setShowPatchNotes(false)}>
        <div className="space-y-6 py-2">
          {patchNotes.map((note, idx) => (
            <div key={idx} className="space-y-5 p-8 bg-gradient-to-b from-white/5 to-transparent rounded-[2.5rem] border border-white/5 relative overflow-hidden">
              {idx === 0 && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>}
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black text-white tracking-tighter italic flex items-center gap-3">
                  {note.version}
                  {idx === 0 && <span className="text-[10px] font-black tracking-widest bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full not-italic">LATEST</span>}
                </span>
                <span className="text-[10px] font-black text-zinc-500 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full tracking-widest">{note.date}</span>
              </div>
              <ul className="space-y-4">
                {note.changes.map((change, cIdx) => (
                  <li key={cIdx} className="flex gap-4 text-sm font-bold text-zinc-300 leading-relaxed">
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${idx === 0 ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-zinc-600'}`}></div>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>

      <Modal title="고객 지원 & 유지보수" isOpen={showInquiry} onClose={() => setShowInquiry(false)}>
        <div className="p-2 space-y-8">
          <div className="space-y-1 text-center">
             <p className="text-zinc-400 text-base font-bold leading-relaxed px-4">
              플랫폼 이용에 어려움이 있거나 유지보수가 필요한 경우 아래 공식 채널로 문의해 주시기 바랍니다.
             </p>
          </div>
          <div className="flex items-center justify-center p-8 bg-white/5 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex flex-col items-center gap-4 relative">
               <div className="p-4 bg-white/5 rounded-[1.5rem] border border-white/10">
                 <Mail className="w-8 h-8 text-white font-black" />
               </div>
               <div className="text-center">
                  <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">공식 고객 지원 채널</div>
                  <span className="text-2xl font-black text-white tracking-tighter italic">info@nextin.ai.kr</span>
               </div>
            </div>
          </div>
          <button 
             onClick={() => window.location.href = 'mailto:info@nextin.ai.kr'}
             className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black flex items-center justify-center gap-4 hover:bg-blue-700 shadow-2xl shadow-blue-600/20 transition-all active:scale-[0.98]"
          >
             문의 메일 작성 <ExternalLink className="w-4 h-4 ml-1" />
          </button>
        </div>
      </Modal>

    </div>
  );
}
