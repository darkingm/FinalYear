'use client';

import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowDownUp } from 'lucide-react';
import { AdvancedRealTimeChart } from 'react-ts-tradingview-widgets';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ChartPage() {
    const params = useParams();
    const router = useRouter();
    const { theme, systemTheme } = useTheme();
    const symbol = Array.isArray(params?.symbol) ? params.symbol[0] : (params?.symbol || 'BTCUSDT');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const currentTheme = theme === 'system' ? systemTheme : theme;
    const widgetTheme: 'dark' | 'light' = currentTheme === 'dark' ? 'dark' : 'light';

    return (
        <div className="min-h-screen bg-white dark:bg-[#0b0e11] flex flex-col">
            <Header />

            <main className="flex-1 flex flex-col pt-4">
                <div className="container mx-auto px-4 mb-4 flex w-full items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-400">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800" />
                        <h1 className="text-xl font-bold dark:text-gray-100 flex items-center gap-2">
                            {symbol} <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-[#2b3139] text-gray-500 font-medium">Spot</span>
                        </h1>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Link href="/products">
                            <Button size="sm" className="bg-[#fcd535] hover:bg-[#f0c822] text-black font-semibold shadow-md border-none">
                                <ArrowDownUp className="w-4 h-4 mr-2" />
                                Trade Now
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex-1 w-full bg-white dark:bg-[#181a20] border-y border-gray-100 dark:border-[#2b3139]">
                    <div className="h-[calc(100vh-160px)] min-h-[600px] w-full relative">
                        {!mounted ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#121417] animate-pulse">
                                <div className="flex flex-col items-center text-gray-400">
                                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-4" />
                                    Loading Chart...
                                </div>
                            </div>
                        ) : (
                            <AdvancedRealTimeChart
                                symbol={symbol.toUpperCase().includes('USDT') ? symbol.toUpperCase() : `BINANCE:${symbol.toUpperCase()}USDT`}
                                theme={widgetTheme}
                                autosize
                                hide_top_toolbar={false}
                                allow_symbol_change={true}
                                save_image={false}
                                hide_side_toolbar={false}
                                show_popup_button={true}
                                calendar={true}
                                studies={[
                                    "Volume@tv-basicstudies",
                                    "MACD@tv-basicstudies"
                                ]}
                            />
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
