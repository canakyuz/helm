import { type ComponentProps } from "react";
import {
  AlertTriangle,
  Activity,
  Bell,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  History,
  Layers,
  LogOut,
  Map as MapIcon,
  RefreshCw,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react-native";

export const Icons = {
  alert: AlertTriangle,
  activity: Activity,
  bell: Bell,
  chevronRight: ChevronRight,
  circleAlert: CircleAlert,
  circleCheck: CircleCheck,
  circleDashed: CircleDashed,
  clock: Clock,
  dollar: DollarSign,
  eye: Eye,
  eyeOff: EyeOff,
  history: History,
  layers: Layers,
  logOut: LogOut,
  map: MapIcon,
  refresh: RefreshCw,
  settings: Settings,
  trendDown: TrendingDown,
  trendUp: TrendingUp,
  users: Users,
  wifi: Wifi,
  wifiOff: WifiOff,
} as const;

export type IconName = keyof typeof Icons;

type Props = ComponentProps<typeof AlertTriangle> & {
  name: IconName;
};

export function Icon({ name, size = 18, color = "#fafafa", ...rest }: Props) {
  const Component = Icons[name];
  return <Component size={size} color={color} {...rest} />;
}
