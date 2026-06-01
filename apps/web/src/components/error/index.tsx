import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export const ErrorComponent = () => (
  <div className="grid min-h-[60vh] place-items-center text-center">
    <div className="space-y-3">
      <div className="text-5xl font-bold tracking-tight">404</div>
      <p className="text-muted-foreground">Sayfa bulunamadı.</p>
      <Button asChild>
        <Link to="/">Cockpit'e dön</Link>
      </Button>
    </div>
  </div>
);
