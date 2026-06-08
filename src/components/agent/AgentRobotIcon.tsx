import Image from "next/image";
import { cn } from "@/lib/utils";

export const AGENT_ROBOT_IMAGE = "/images/robot/robot.png";

type Props = {
  size?: number;
  className?: string;
};

export function AgentRobotIcon({ size = 24, className }: Props) {
  return (
    <Image
      src={AGENT_ROBOT_IMAGE}
      alt=""
      width={size}
      height={size}
      className={cn("object-contain", className)}
      aria-hidden
    />
  );
}
