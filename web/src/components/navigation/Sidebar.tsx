import NavItem from "./NavItem";
import { CameraGroupSelector } from "../filter/CameraGroupSelector";
import { useMatch } from "react-router-dom";
import GeneralSettings from "../menu/GeneralSettings";
import useNavigation from "@/hooks/use-navigation";
import { baseUrl } from "@/api/baseUrl";
import { useMemo } from "react";

function Sidebar() {
  const basePath = useMemo(() => new URL(baseUrl).pathname, []);

  const isRootMatch = useMatch("/");
  const isBasePathMatch = useMatch(basePath);

  const navbarLinks = useNavigation();

  return (
    <aside className="scrollbar-container scrollbar-hidden absolute bottom-0 left-0 top-14 z-10 flex w-[52px] flex-col justify-between overflow-y-auto border-r border-secondary-highlight bg-background_alt py-4">
      <span tabIndex={0} className="sr-only" />
      <div className="flex w-full flex-col items-center gap-0">
        {navbarLinks.map((item) => {
          const showCameraGroups =
            (isRootMatch || isBasePathMatch) && item.id === 1;

          return (
            <div key={item.id}>
              <NavItem
                className={`mx-[10px] ${showCameraGroups ? "mb-2" : "mb-4"}`}
                item={item}
                Icon={item.icon}
              />
              {showCameraGroups && <CameraGroupSelector className="mb-4" />}
            </div>
          );
        })}
      </div>
      <div className="mb-8 flex flex-col items-center gap-4">
        <GeneralSettings />
      </div>
    </aside>
  );
}

export default Sidebar;
