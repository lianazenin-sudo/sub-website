import { cn } from "@/lib/utils";

type SectionLabelProps = {
  children: string;
  className?: string;
  as?: "h2" | "p";
  id?: string;
};

/** Small dark pill used above Features, Pricing, and FAQs. */
export function SectionLabel({
  children,
  className,
  as: Tag = "p",
  id,
}: SectionLabelProps) {
  return (
    <Tag
      id={id}
      className={cn(
        "inline-flex items-center rounded-full bg-ink-soft px-4 py-1.5 text-[13px] font-medium text-white/80",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
