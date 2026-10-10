import type { ReactNode } from "react";

interface StepSectionProps {
  id: string;
  step: number;
  title: string;
  description: string;
  disabled?: boolean;
  children: ReactNode;
}

export default function StepSection({
  id,
  step,
  title,
  description,
  disabled = false,
  children,
}: StepSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`scroll-mt-24 transition-opacity duration-300 ${disabled ? "opacity-50" : ""}`}
    >
      <div className="mb-5 flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-stone-300 text-xs font-medium text-stone-600"
        >
          {String(step).padStart(2, "0")}
        </span>
        <div>
          <h2
            id={headingId}
            className="font-display text-xl text-ink sm:text-2xl"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-stone-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
