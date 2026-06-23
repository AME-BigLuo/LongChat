import React from 'react';
import { PRESET_TEAHOUSES, Teahouse } from '../data/teahouseData';
import { Coffee, ChevronRight, MessageSquare, Sparkles } from 'lucide-react';
import { AppLanguage } from '../types';

interface TeahouseListProps {
  activeId: string;
  onSelect: (id: string) => void;
  customActiveCounts: Record<string, number>;
  language: AppLanguage;
}

export default function TeahouseList({ activeId, onSelect, customActiveCounts, language }: TeahouseListProps) {
  return (
    <div className="border-4 border-black p-4 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3" id="teahouse_directory_card">
      <h3 className="text-xs font-mono font-black uppercase tracking-wider flex items-center justify-between border-b-2 border-black pb-1.5 text-black">
        <span className="flex items-center gap-1">
          <Coffee className="w-3.5 h-3.5 text-black" />
          <span>{language === 'zh' ? '2. 选择茶馆' : '2. Choose a teahouse'}</span>
        </span>
        <span className="text-[9px] border border-black bg-amber-100 px-1">{language === 'zh' ? '3 个茶馆' : '3 rooms'}</span>
      </h3>
      
      <p className="text-[11px] text-neutral-500 font-sans leading-tight">
        {language === 'zh' ? '选择一个最适合当前话题的茶馆。' : 'Pick the room that matches the discussion you want to have.'}
      </p>

      <div className="grid grid-cols-1 gap-2.5 pt-1.5" id="teahouses_selector_grid">
        {PRESET_TEAHOUSES.map((th) => {
          const isActive = th.id === activeId;
          const activeCount = customActiveCounts[th.id] ?? th.defaultAgents.length;

          return (
            <div
              key={th.id}
              onClick={() => onSelect(th.id)}
              className={`border-2 p-3 text-left cursor-pointer transition-all flex items-start gap-2.5 relative ${
                isActive
                  ? 'bg-amber-100 text-black border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-x-1 -translate-y-1'
                  : 'bg-white text-black border-neutral-300 hover:border-black hover:bg-neutral-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
              }`}
              id={`teahouse_card_${th.id}`}
            >
              <span className="text-3xl p-1 bg-white border border-black shrink-0 block">
                {th.icon}
              </span>
              
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-black text-xs block truncate">{th.name}</span>
                  <span className="text-[8px] font-mono border border-black bg-white px-1 leading-none scale-90">
                    {language === 'zh' ? `${activeCount}茶友` : `${activeCount} guests`}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-600 mt-1 leading-snug line-clamp-2">
                  {th.description}
                </p>
              </div>

              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <ChevronRight className={`w-4 h-4 text-black ${isActive ? 'translate-x-0.5' : 'text-neutral-400'}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
