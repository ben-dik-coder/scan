"use client";

type Option<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function AppleSegmented<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="apple-segmented" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={
            value === opt.id ? "apple-segmented-btn apple-segmented-btn-active" : "apple-segmented-btn"
          }
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
