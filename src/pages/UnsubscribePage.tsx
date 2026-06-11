import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type State = 'loading' | 'valid' | 'already' | 'invalid' | 'submitting' | 'done' | 'error';

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        const data = await res.json();
        if (data.valid) setState('valid');
        else if (data.reason === 'already_unsubscribed') setState('already');
        else setState('invalid');
      } catch {
        setState('invalid');
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState('submitting');
    const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
    if (error) { setErrorMsg(error.message); setState('error'); return; }
    if (data?.success || data?.reason === 'already_unsubscribed') setState('done');
    else { setErrorMsg('The request could not be processed.'); setState('error'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        {state === 'loading' && (<><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p>Validating link…</p></>)}
        {state === 'valid' && (<>
          <h1 className="text-xl font-semibold">Unsubscribe</h1>
          <p className="text-sm text-muted-foreground">Do you confirm you want to stop receiving email alerts?</p>
          <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
        </>)}
        {state === 'submitting' && (<><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p>Processing…</p></>)}
        {state === 'done' && (<>
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-semibold">Unsubscribed</h1>
          <p className="text-sm text-muted-foreground">You will no longer receive emails at this address.</p>
        </>)}
        {state === 'already' && (<>
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-semibold">You were already unsubscribed</h1>
          <p className="text-sm text-muted-foreground">This address no longer receives emails.</p>
        </>)}
        {state === 'invalid' && (<>
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Invalid link</h1>
          <p className="text-sm text-muted-foreground">The link has expired or is not valid.</p>
        </>)}
        {state === 'error' && (<>
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Error</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </>)}
      </Card>
    </div>
  );
}
