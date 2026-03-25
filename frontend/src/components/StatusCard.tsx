const StatusCard = ({ status }: { status?: string }) => {
  const isActive = status === "ACTIVE" || status === "TRADING";

  return (
    <div className="rounded-xl border border-border bg-card p-6 glow-green animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          System Status
        </h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full pulse-dot ${isActive ? "bg-primary" : "bg-destructive"}`} />
          <span className={`text-sm font-semibold ${isActive ? "text-primary" : "text-destructive"}`}>
            {status || "OFFLINE"}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {isActive ? "AVA is actively monitoring the market" : "AVA is currently offline"}
      </p>
    </div>
  );
};

export default StatusCard;
