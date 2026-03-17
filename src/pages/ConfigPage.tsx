import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { PLATFORM_CONFIG, PLATFORMS } from '@/lib/platforms';
import { validateCsvUrl } from '@/lib/csv';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Platform = Database['public']['Enums']['ad_platform'];

export default function ConfigPage() {
  const { user } = useAuth();
  const [urls, setUrls] = useState<Record<Platform, string>>({} as any);
  const [validationState, setValidationState] = useState<Record<Platform, 'idle' | 'loading' | 'valid' | 'invalid'>>({} as any);

  useEffect(() => {
    if (!user) return;
    // Init defaults
    const defaults: Record<string, string> = {};
    PLATFORMS.forEach(p => { defaults[p] = PLATFORM_CONFIG[p].defaultUrl; });
    
    supabase.from('data_sources').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) {
        data.forEach(d => { defaults[d.platform] = d.csv_url; });
      }
      setUrls(defaults as Record<Platform, string>);
    });
  }, [user]);

  const handleValidate = async (platform: Platform) => {
    if (!user) return;
    const url = urls[platform];
    if (!url) return;
    
    setValidationState(prev => ({ ...prev, [platform]: 'loading' }));
    const isValid = await validateCsvUrl(url);
    setValidationState(prev => ({ ...prev, [platform]: isValid ? 'valid' : 'invalid' }));

    // Upsert to data_sources
    await supabase.from('data_sources').upsert({
      user_id: user.id,
      platform,
      csv_url: url,
      is_valid: isValid,
      last_validated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' });
  };

  const getStatusIcon = (platform: Platform) => {
    const state = validationState[platform];
    if (state === 'loading') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (state === 'valid') return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (state === 'invalid') return <XCircle className="h-4 w-4 text-destructive" />;
    return null;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Configuración de Fuentes de Datos</h2>
      <p className="text-sm text-muted-foreground">Pegue las URLs de los CSV públicos de Google Sheets para cada plataforma.</p>
      <div className="space-y-3">
        {PLATFORMS.map(platform => (
          <Card key={platform} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-sm font-semibold ${PLATFORM_CONFIG[platform].color}`}>
                {PLATFORM_CONFIG[platform].label}
              </span>
              {getStatusIcon(platform)}
            </div>
            <div className="flex gap-2">
              <Input
                value={urls[platform] || ''}
                onChange={(e) => setUrls(prev => ({ ...prev, [platform]: e.target.value }))}
                placeholder="https://docs.google.com/spreadsheets/..."
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={() => handleValidate(platform)}
                disabled={!urls[platform] || validationState[platform] === 'loading'}
              >
                Validar
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
