"use client";

interface TabsProps {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            active === t.key ? "text-brand" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${active === t.key ? "bg-indigo-50 text-brand" : "bg-slate-100 text-slate-500"}`}>
              {t.count}
            </span>
          )}
          {active === t.key && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand rounded-full" />}
        </button>
      ))}
    </div>
  );
}
