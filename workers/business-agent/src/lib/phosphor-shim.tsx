import { createContext, forwardRef, useContext } from "react";
import type { SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  weight?: string;
  mirrored?: boolean;
}

export const IconContext = createContext<Partial<IconProps>>({
  size: 20,
  color: "currentColor",
  weight: "regular",
  mirrored: false,
});

function makeIcon(label: string) {
  return forwardRef<SVGSVGElement, IconProps>(function PhosphorShimIcon(props, ref) {
    const context = useContext(IconContext);
    const {
      size = context.size ?? 20,
      color = context.color ?? "currentColor",
      mirrored = context.mirrored ?? false,
      style,
      children,
      ...rest
    } = props;

    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: mirrored ? "scaleX(-1)" : undefined, ...style }}
        {...rest}
      >
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
        <text
          x="12"
          y="15"
          textAnchor="middle"
          fontSize="8"
          fontFamily="Arial, sans-serif"
          fill={color}
        >
          {label}
        </text>
        {children}
      </svg>
    );
  });
}

export const ArrowsClockwiseIcon = makeIcon("AR");
export const ArrowClockwiseIcon = makeIcon("A");
export const ArrowClockwise = ArrowClockwiseIcon;
export const ArrowCounterClockwiseIcon = makeIcon("AC");
export const BellIcon = makeIcon("B");
export const BuildingsIcon = makeIcon("BU");
export const BugIcon = makeIcon("BG");
export const CaretDownIcon = makeIcon("V");
export const CaretLeftIcon = makeIcon("<");
export const CaretRightIcon = makeIcon(">");
export const ChatCircleDotsIcon = makeIcon("CH");
export const CheckIcon = makeIcon("✓");
export const CheckCircleIcon = makeIcon("✓");
export const CheckCircle = CheckCircleIcon;
export const ClockCounterClockwiseIcon = makeIcon("CC");
export const CodeIcon = makeIcon("{}");
export const DotsThreeIcon = makeIcon("⋯");
export const EyeIcon = makeIcon("E");
export const Eye = EyeIcon;
export const FloppyDiskIcon = makeIcon("FD");
export const FloppyDisk = FloppyDiskIcon;
export const GearIcon = makeIcon("G");
export const GlobeIcon = makeIcon("GL");
export const HourglassIcon = makeIcon("H");
export const MicrophoneIcon = makeIcon("M");
export const MicrophoneSlashIcon = makeIcon("MS");
export const MoonIcon = makeIcon("MN");
export const PaperPlaneTiltIcon = makeIcon("PP");
export const PlusIcon = makeIcon("+");
export const RobotIcon = makeIcon("R");
export const RocketLaunchIcon = makeIcon("RL");
export const StopIcon = makeIcon("S");
export const StorefrontIcon = makeIcon("ST");
export const SunIcon = makeIcon("SU");
export const TrashIcon = makeIcon("T");
export const UserCircleIcon = makeIcon("U");
export const WarningIcon = makeIcon("!");
export const Warning = WarningIcon;
export const XIcon = makeIcon("X");
export const X = XIcon;
export const XCircleIcon = makeIcon("X");
