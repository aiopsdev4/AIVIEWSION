import { cn } from "@/lib/utils";

import logoUrl from "../../images/branding/logo.png";

type LogoProps = {
  className?: string;
};
export default function Logo({ className }: LogoProps) {
  return (
    <img src={logoUrl} alt="Logo" className={cn("object-contain", className)} />
  );
}
