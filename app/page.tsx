import dynamic from 'next/dynamic';

const WaterfallAnalysis = dynamic(() => import('@/components/WaterfallAnalysisNew'), {
  ssr: false
});

export default function Home() {
  return (
    <main className="min-h-screen">
      <WaterfallAnalysis />
    </main>
  );
} 