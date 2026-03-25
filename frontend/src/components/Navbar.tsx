import { Link, useLocation } from "react-router-dom";
import { Activity, Signal } from "lucide-react";

const Navbar = () => {
  const location = useLocation();

  const links = [
    { to: "/", label: "Dashboard", icon: Activity },
    { to: "/signal", label: "Signal", icon: Signal },
  ];

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="font-display text-primary text-sm font-bold">A</span>
          </div>
          <span className="font-display text-lg font-bold tracking-wider text-foreground">
            AVA
          </span>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Autonomous Value Agent
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                location.pathname === to
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
