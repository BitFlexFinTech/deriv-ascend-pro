import { useEffect, useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Server, 
  Database, 
  Cpu, 
  Radio,
  BarChart3,
  Shield,
  Zap
} from 'lucide-react';
import { DERIV_CONFIG } from '@/config/deriv';
import { derivWS, ConnectionStatus } from '@/lib/deriv-websocket';
import { cn } from '@/lib/utils';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'online' | 'offline' | 'connecting';
  icon: React.ReactNode;
}

export function IntegrationsPanel() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    const handler = (status: ConnectionStatus) => {
      setConnectionStatus(status);
    };
    derivWS.onStatusChange(handler);
    return () => derivWS.offStatusChange(handler);
  }, []);

  const getIntegrationStatus = (type: string): 'online' | 'offline' | 'connecting' => {
    if (connectionStatus === 'authorized') return 'online';
    if (connectionStatus === 'connecting' || connectionStatus === 'connected') return 'connecting';
    return 'offline';
  };

  const integrations: Integration[] = [
    {
      id: 'deriv-ws',
      name: 'Deriv WebSocket',
      description: 'Real-time market data stream',
      status: getIntegrationStatus('ws'),
      icon: <Radio className="h-5 w-5" />,
    },
    {
      id: 'scanner-v10',
      name: 'V10 Scanner',
      description: 'Volatility 10 Index',
      status: getIntegrationStatus('scanner'),
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      id: 'scanner-v50',
      name: 'V50 Scanner',
      description: 'Volatility 50 Index',
      status: getIntegrationStatus('scanner'),
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      id: 'scanner-v100',
      name: 'V100 Scanner',
      description: 'Volatility 100 Index',
      status: getIntegrationStatus('scanner'),
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      id: 'scanner-1hz',
      name: '1HZ Scanner',
      description: '1 Second Volatility',
      status: getIntegrationStatus('scanner'),
      icon: <Zap className="h-5 w-5" />,
    },
    {
      id: 'ai-engine',
      name: 'AI Trading Engine',
      description: 'Signal generation & execution',
      status: getIntegrationStatus('ai'),
      icon: <Cpu className="h-5 w-5" />,
    },
    {
      id: 'risk-manager',
      name: 'Risk Manager',
      description: 'Position sizing & stop loss',
      status: getIntegrationStatus('risk'),
      icon: <Shield className="h-5 w-5" />,
    },
  ];

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-profit" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-warning animate-spin" />;
      default:
        return <XCircle className="h-4 w-4 text-loss" />;
    }
  };

  const onlineCount = integrations.filter(i => i.status === 'online').length;

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          System Integrations
        </h3>
        <div className={cn(
          "px-2 py-0.5 rounded-full text-xs font-mono",
          onlineCount === integrations.length 
            ? "bg-profit/20 text-profit" 
            : "bg-warning/20 text-warning"
        )}>
          {onlineCount}/{integrations.length} ONLINE
        </div>
      </div>

      <div className="space-y-2">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg bg-secondary/30 border transition-all duration-300",
              integration.status === 'online' && "border-profit/20",
              integration.status === 'connecting' && "border-warning/20",
              integration.status === 'offline' && "border-border"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                integration.status === 'online' && "bg-profit/20 text-profit",
                integration.status === 'connecting' && "bg-warning/20 text-warning",
                integration.status === 'offline' && "bg-muted text-muted-foreground"
              )}>
                {integration.icon}
              </div>
              <div>
                <div className="font-mono text-sm font-medium text-foreground">
                  {integration.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {integration.description}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(integration.status)}
              <span className={cn(
                "text-xs font-mono uppercase",
                integration.status === 'online' && "text-profit",
                integration.status === 'connecting' && "text-warning",
                integration.status === 'offline' && "text-loss"
              )}>
                {integration.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* API Info */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">API Endpoint</span>
          <span className="font-mono text-foreground truncate ml-2 max-w-[200px]">
            {DERIV_CONFIG.WS_URL}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-2">
          <span className="text-muted-foreground">App ID</span>
          <span className="font-mono text-foreground">{DERIV_CONFIG.APP_ID}</span>
        </div>
      </div>
    </div>
  );
}
