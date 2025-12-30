import { useState } from 'react';
import { Key, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { derivWS } from '@/lib/deriv-websocket';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export function ApiKeySettings() {
  const [apiKey, setApiKey] = useState(derivWS.getApiToken());
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    if (apiKey.trim()) {
      derivWS.setApiToken(apiKey.trim());
      setIsEditing(false);
      toast({
        title: "API Key Updated",
        description: "Reconnecting to Deriv with new credentials...",
      });
    }
  };

  const handleCancel = () => {
    setApiKey(derivWS.getApiToken());
    setIsEditing(false);
  };

  const maskedKey = apiKey.length > 8 
    ? `${apiKey.slice(0, 4)}${'•'.repeat(apiKey.length - 8)}${apiKey.slice(-4)}`
    : '•'.repeat(apiKey.length);

  return (
    <div className="bg-secondary/50 rounded-lg p-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Key className="h-3 w-3" />
        DERIV API TOKEN
      </label>
      
      {isEditing ? (
        <div className="space-y-2">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Deriv API token"
              className="pr-10 font-mono text-sm bg-background"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="flex-1">
              Save & Reconnect
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-sm text-foreground bg-background/50 px-3 py-2 rounded-md overflow-hidden">
            {showKey ? apiKey : maskedKey}
          </div>
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-muted-foreground hover:text-foreground p-2"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <Button size="sm" variant="terminal" onClick={() => setIsEditing(true)}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Change
          </Button>
        </div>
      )}
    </div>
  );
}
