import {
  BriefcaseBusiness,
  Car,
  CircleHelp,
  Ellipsis,
  Film,
  HeartPulse,
  House,
  ShoppingBag,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";

const systemCategoryIcons: Record<string, LucideIcon> = {
  bag: ShoppingBag,
  bolt: Zap,
  briefcase: BriefcaseBusiness,
  car: Car,
  dots: Ellipsis,
  heart: HeartPulse,
  home: House,
  movie: Film,
  utensils: Utensils,
};

type CategoryIconProps = {
  className?: string;
  icon: string | null;
};

export function CategoryIcon({ className, icon }: CategoryIconProps) {
  const SystemIcon = icon ? systemCategoryIcons[icon] : undefined;

  if (SystemIcon) {
    return <SystemIcon aria-hidden="true" className={className} strokeWidth={1.7} />;
  }

  if (!icon) {
    return <CircleHelp aria-hidden="true" className={className} strokeWidth={1.7} />;
  }

  // Category keys are words; unknown keys should never leak into the layout as
  // clipped text. Non-word values are intentional custom glyphs or emoji.
  if (/^[a-z][a-z0-9-]*$/i.test(icon)) {
    return <CircleHelp aria-hidden="true" className={className} strokeWidth={1.7} />;
  }

  return <span aria-hidden="true" className={className}>{icon}</span>;
}
