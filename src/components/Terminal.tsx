import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, X, Minimize2, Maximize2 } from 'lucide-react';
import { tradingEngine, LogEntry } from '@/lib/trading-engine';
import { cn } from '@/lib/utils';

export function Terminal() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (entry: LogEntry) => {
      setLogs(prev => [...prev.slice(-200), entry]); // Keep last 200 entries
    };

    tradingEngine.onLog(handler);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'signal':
        return 'text-primary';
      case 'trade':
        return 'text-profit';
      case 'warning':
        return 'text-warning';
      case 'error':
        return 'text-loss';
      case 'ai':
        return 'text-accent';
      case 'throttle':
        return 'text-loss animate-pulse';
      default:
        return 'text-muted-foreground';
    }
  };

  const getTypeLabel = (type: LogEntry['type']) => {
    switch (type) {
      case 'signal':
        return 'SIG';
      case 'trade':
        return 'TRD';
      case 'warning':
        return 'WRN';
      case 'error':
        return 'ERR';
      case 'ai':
        return 'AI ';
      case 'throttle':
        return 'THR';
      default:
        return 'INF';
    }
  };

  return (
    <div className={cn(
      "flex flex-col border border-border rounded-lg bg-card overflow-hidden transition-all duration-300",
      isMinimized ? "h-12" : "h-full"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-card-elevated border-b border-border">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-medium text-foreground">SYSTEM LOGS</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono">
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-secondary rounded transition-colors"
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Minimize2 className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => setLogs([])}
            className="p-1 hover:bg-secondary rounded transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Log Content */}
      {!isMinimized && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 font-mono text-sm space-y-1 animate-data-stream"
        >
          {logs.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              <p>Waiting for trading engine to start...</p>
              <p className="text-xs mt-2">Logs will appear here</p>
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={`${log.timestamp}-${index}`}
                className="flex gap-2 animate-fade-in"
              >
                <span className="text-muted-foreground shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span className={cn("shrink-0 font-bold", getTypeColor(log.type))}>
                  [{getTypeLabel(log.type)}]
                </span>
                {log.symbol && (
                  <span className="text-primary shrink-0">
                    {log.symbol}:
                  </span>
                )}
                <span className="text-foreground break-all">
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div className="flex items-center gap-1 text-primary">
            <span className="animate-blink">▊</span>
          </div>
        </div>
      )}
    </div>
  );
}
