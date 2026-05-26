import Logo from "../Logo";
import AccountSettings from "../menu/AccountSettings";
import { isDesktop } from "react-device-detect";

export default function Header() {
  if (!isDesktop) return null;

  return (
    <header className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 border-b border-secondary-highlight bg-background_alt z-20">
      <div className="flex items-center gap-3">
        <Logo className="h-7 w-7" />
        <span className="font-semibold text-lg tracking-wider text-slate-100 select-none uppercase">
          AIVIEWSION
        </span>
      </div>
      <div className="flex items-center gap-2">
        <AccountSettings />
      </div>
    </header>
  );
}
