import Logo from "../Logo";
import AccountSettings from "../menu/AccountSettings";
import { isDesktop } from "react-device-detect";

export default function Header() {
  if (!isDesktop) return null;

  return (
    <header className="absolute left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-secondary-highlight bg-background_alt px-4">
      <div className="flex items-center gap-3">
        <Logo className="h-7 w-7" />
        <span className="select-none text-lg font-semibold uppercase tracking-wider text-slate-100">
          AIVIEWSION
        </span>
      </div>
      <div className="flex items-center gap-2">
        <AccountSettings />
      </div>
    </header>
  );
}
