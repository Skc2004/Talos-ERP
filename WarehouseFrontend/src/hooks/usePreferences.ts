import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

interface UsePreferencesReturn {
  preferences: Record<string, any>;
  updatePreference: (key: string, value: any) => Promise<void>;
  loading: boolean;
}

const DEFAULT_SETTINGS: Record<string, Record<string, any>> = {
  'financial-dashboard': {
    showRevenueCard: true,
    showCogsCard: true,
    showEbitdaCard: true,
    showNetProfitCard: true,
    defaultDateRange: '30d',
  },
  'crm-dashboard': {
    defaultSort: 'ai_score',
    showPipelineChart: true,
    leadsPerPage: 20,
  },
  'global': {
    theme: 'dark',
    compactMode: false,
    notificationThreshold: 'WARNING',
  },
};

export const usePreferences = (pageId: string): UsePreferencesReturn => {
  const [preferences, setPreferences] = useState<Record<string, any>>(DEFAULT_SETTINGS[pageId] || {});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('user_preferences')
        .select('settings_json')
        .eq('auth_user_id', user.id)
        .eq('page_identifier', pageId)
        .single();

      if (data?.settings_json) {
        setPreferences({ ...(DEFAULT_SETTINGS[pageId] || {}), ...data.settings_json });
      }
      setLoading(false);
    };
    load();
  }, [pageId]);

  const updatePreference = useCallback(async (key: string, value: any) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_preferences')
      .upsert({
        auth_user_id: user.id,
        page_identifier: pageId,
        settings_json: updated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'auth_user_id,page_identifier' });
  }, [preferences, pageId]);

  return { preferences, updatePreference, loading };
};
