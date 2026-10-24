import {
  Accessibility,
  Bus,
  Cloud,
  Dog,
  Droplet,
  HardHat,
  HeartPulse,
  Lightbulb,
  MoreHorizontal,
  Route,
  Shield,
  TrafficCone,
  Trash2,
  Trees,
  Volume2,
  type LucideIcon,
} from "lucide-react";

const ICONES: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  road: Route,
  "trash-2": Trash2,
  droplet: Droplet,
  "traffic-cone": TrafficCone,
  trees: Trees,
  "volume-2": Volume2,
  cloud: Cloud,
  bus: Bus,
  "hard-hat": HardHat,
  dog: Dog,
  shield: Shield,
  accessibility: Accessibility,
  "heart-pulse": HeartPulse,
  "more-horizontal": MoreHorizontal,
};

export function CategoriaIcon({
  icone,
  className = "h-4 w-4",
}: {
  icone: string | null;
  className?: string;
}) {
  const Icone = (icone && ICONES[icone]) || MoreHorizontal;
  return <Icone className={className} aria-hidden />;
}
