import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  pageWidth: 'narrow' | 'normal' | 'wide' | 'full';
  autoSave: boolean;
  autoDescend: boolean;
  showRowHighlight: boolean;
  showSlashPlaceholder: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  fontSize: 'medium',
  pageWidth: 'normal',
  autoSave: true,
  autoDescend: false,
  showRowHighlight: false,
  showSlashPlaceholder: false,
};

const LOCAL_STORAGE_KEY = 'user-settings-fallback';

function getLocalSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('[useUserSettings] Failed to parse local settings:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveLocalSettings(settings: UserSettings) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[useUserSettings] Failed to save local settings:', e);
  }
}

export function useUserSettings() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings>(getLocalSettings);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedFromCloud = useRef(false);

  // Load settings from cloud on auth change
  useEffect(() => {
    async function loadFromCloud() {
      if (!user) {
        // Not logged in - use local settings
        setSettings(getLocalSettings());
        setIsLoading(false);
        hasLoadedFromCloud.current = false;
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[useUserSettings] Error loading settings:', error);
          setSettings(getLocalSettings());
        } else if (data) {
          const cloudSettings: UserSettings = {
            theme: data.theme as UserSettings['theme'],
            fontSize: data.font_size as UserSettings['fontSize'],
            pageWidth: data.page_width as UserSettings['pageWidth'],
            autoSave: data.auto_save,
            autoDescend: data.auto_descend,
            showRowHighlight: data.show_row_highlight,
            showSlashPlaceholder: data.show_slash_placeholder,
          };
          setSettings(cloudSettings);
          saveLocalSettings(cloudSettings); // Cache locally
          hasLoadedFromCloud.current = true;
        } else {
          // No cloud settings yet - check for local settings to migrate
          const local = getLocalSettings();
          setSettings(local);
          // Create cloud record with local/default settings
          await supabase.from('user_settings').insert({
            user_id: user.id,
            theme: local.theme,
            font_size: local.fontSize,
            page_width: local.pageWidth,
            auto_save: local.autoSave,
            auto_descend: local.autoDescend,
            show_row_highlight: local.showRowHighlight,
            show_slash_placeholder: local.showSlashPlaceholder,
          });
          hasLoadedFromCloud.current = true;
        }
      } catch (e) {
        console.error('[useUserSettings] Failed to load cloud settings:', e);
        setSettings(getLocalSettings());
      } finally {
        setIsLoading(false);
      }
    }

    loadFromCloud();
  }, [user]);

  // Apply theme when settings change
  useEffect(() => {
    setTheme(settings.theme);
  }, [settings.theme, setTheme]);

  // Apply font size and page width to document
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
    document.documentElement.setAttribute('data-page-width', settings.pageWidth);
  }, [settings.fontSize, settings.pageWidth]);

  // Debounced save to cloud
  const saveToCloud = useCallback(
    async (newSettings: UserSettings) => {
      if (!user) return;

      try {
        await supabase
          .from('user_settings')
          .update({
            theme: newSettings.theme,
            font_size: newSettings.fontSize,
            page_width: newSettings.pageWidth,
            auto_save: newSettings.autoSave,
            auto_descend: newSettings.autoDescend,
            show_row_highlight: newSettings.showRowHighlight,
            show_slash_placeholder: newSettings.showSlashPlaceholder,
          })
          .eq('user_id', user.id);
      } catch (e) {
        console.error('[useUserSettings] Failed to save to cloud:', e);
      }
    },
    [user]
  );

  const updateSettings = useCallback(
    (updates: Partial<UserSettings>) => {
      setSettings((current) => {
        const newSettings = { ...current, ...updates };
        
        // Save locally immediately
        saveLocalSettings(newSettings);

        // Debounce cloud save
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          saveToCloud(newSettings);
        }, 1000);

        return newSettings;
      });
    },
    [saveToCloud]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { settings, updateSettings, isLoading };
}
