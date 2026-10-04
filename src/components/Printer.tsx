import type { ReactNode } from "react";

/** The glossy navy printer from the reference animation. Paper renders below and feeds out of the slot. */
export function Printer({ active, children, width = "max-w-md" }: { active: boolean; children?: ReactNode; width?: string }) {
  return (
    <div className={`relative mx-auto w-full ${width}`}>
      <div className="printer-glow" />
      <div className="printer" data-active={active}>
        <div className="printer-led" />
        <div className="printer-slot" />
      </div>
      <div className="printer-mouth px-[7%]">{children}</div>
    </div>
  );
}
