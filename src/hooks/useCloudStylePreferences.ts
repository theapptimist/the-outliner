import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MixedStyleConfig } from '@/lib/outlineStyles';
import { CustomStyle, getCustomStyles, saveCustomStyles, getDefaultStyleId, setDefaultStyleId as setLocalDefaultStyleId, clearDefaultStyle } from '@/lib/customStyles';

interface StylePreferences {
  custom_styles: CustomStyle[];
  default_style_id: string | null;
  current_mixed_config: MixedStyleConfig | null;
}

/**
 * Hook for cloud-synced style preferences.
 * Loads from cloud on mount, saves changes with debounce.
 */
export function useCloudStylePreferences() {
  const { user } = useAuth();
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
  const [defaultStyleId, setDefaultStyleIdState] = useState<string | null>(null);
  const [currentMixedConfig, setCurrentMixedConfig] = useState<MixedStyleConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChangesRef = useRef<Partial<StylePreferences> | null>(null);

  // Load preferences from cloud
  useEffect(() => {
    if (!user?.id) {
      // Load from localStorage when not authenticated
      setCustomStyles(getCustomStyles());
      setDefaultStyleIdState(getDefaultStyleId());
      setIsLoading(false);
      return;
    }

    const loadFromCloud = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_style_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // Cloud data exists - use it
          const cloudStyles = (data.custom_styles as unknown as CustomStyle[]) || [];
          const cloudDefault = data.default_style_id;
          const cloudConfig = data.current_mixed_config as unknown as MixedStyleConfig | null;
          
          setCustomStyles(cloudStyles);
          setDefaultStyleIdState(cloudDefault);
          setCurrentMixedConfig(cloudConfig);
          
          // Sync to localStorage for offline access
          saveCustomStyles(cloudStyles);
          if (cloudDefault) {
            setLocalDefaultStyleId(cloudDefault);
          } else {
            clearDefaultStyle();
          }
          
          setIsSynced(true);
        } else {
          // No cloud data - migrate from localStorage
          const localStyles = getCustomStyles();
          const localDefault = getDefaultStyleId();
          
          setCustomStyles(localStyles);
          setDefaultStyleIdState(localDefault);
          
          // Create cloud record with local data
          if (localStyles.length > 0 || localDefault) {
            await supabase.from('user_style_preferences').insert([{
              user_id: user.id,
              custom_styles: JSON.parse(JSON.stringify(localStyles)),
              default_style_id: localDefault,
              current_mixed_config: null,
            }]);
          }
          
          setIsSynced(true);
        }
      } catch (e) {
        console.error('[CloudStyles] Failed to load:', e);
        // Fallback to localStorage
        setCustomStyles(getCustomStyles());
        setDefaultStyleIdState(getDefaultStyleId());
      } finally {
        setIsLoading(false);
      }
    };

    loadFromCloud();
  }, [user?.id]);

  // Debounced save to cloud
  const saveToCloud = useCallback(async (changes: Partial<StylePreferences>) => {
    if (!user?.id) return;

    // Merge with pending changes
    pendingChangesRef.current = {
      ...pendingChangesRef.current,
      ...changes,
    };

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save
    saveTimeoutRef.current = setTimeout(async () => {
      const pending = pendingChangesRef.current;
      if (!pending) return;

      try {
        const updateData: Record<string, unknown> = {};
        
        if (pending.custom_styles !== undefined) {
          updateData.custom_styles = JSON.parse(JSON.stringify(pending.custom_styles));
        }
        if (pending.default_style_id !== undefined) {
          updateData.default_style_id = pending.default_style_id;
        }
        if (pending.current_mixed_config !== undefined) {
          updateData.current_mixed_config = JSON.parse(JSON.stringify(pending.current_mixed_config));
        }

        const { error } = await supabase
          .from('user_style_preferences')
          .upsert({
            user_id: user.id,
            ...updateData,
          }, { onConflict: 'user_id' });

        if (error) throw error;
        
        pendingChangesRef.current = null;
      } catch (e) {
        console.error('[CloudStyles] Failed to save:', e);
      }
    }, 1000);
  }, [user?.id]);

  // Add a custom style
  const addCustomStyle = useCallback((style: Omit<CustomStyle, 'id' | 'createdAt'>): CustomStyle => {
    const newStyle: CustomStyle = {
      ...style,
      id: `custom-${Date.now()}`,
      createdAt: Date.now(),
    };
    
    const updatedStyles = [...customStyles, newStyle];
    setCustomStyles(updatedStyles);
    saveCustomStyles(updatedStyles); // localStorage backup
    saveToCloud({ custom_styles: updatedStyles });
    
    return newStyle;
  }, [customStyles, saveToCloud]);

  // Update a custom style
  const updateCustomStyle = useCallback((id: string, updates: Partial<Omit<CustomStyle, 'id' | 'createdAt'>>): CustomStyle | null => {
    const index = customStyles.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    const updatedStyle = { ...customStyles[index], ...updates };
    const updatedStyles = [...customStyles];
    updatedStyles[index] = updatedStyle;
    
    setCustomStyles(updatedStyles);
    saveCustomStyles(updatedStyles);
    saveToCloud({ custom_styles: updatedStyles });
    
    return updatedStyle;
  }, [customStyles, saveToCloud]);

  // Delete a custom style
  const deleteCustomStyle = useCallback((id: string): boolean => {
    const filtered = customStyles.filter(s => s.id !== id);
    if (filtered.length === customStyles.length) return false;
    
    setCustomStyles(filtered);
    saveCustomStyles(filtered);
    saveToCloud({ custom_styles: filtered });
    
    // Clear default if deleted
    if (defaultStyleId === id) {
      setDefaultStyleIdState(null);
      clearDefaultStyle();
      saveToCloud({ default_style_id: null });
    }
    
    return true;
  }, [customStyles, defaultStyleId, saveToCloud]);

  // Set default style
  const setDefaultStyle = useCallback((id: string | null) => {
    setDefaultStyleIdState(id);
    if (id) {
      setLocalDefaultStyleId(id);
    } else {
      clearDefaultStyle();
    }
    saveToCloud({ default_style_id: id });
  }, [saveToCloud]);

  // Update current mixed config
  const updateMixedConfig = useCallback((config: MixedStyleConfig) => {
    setCurrentMixedConfig(config);
    saveToCloud({ current_mixed_config: config });
  }, [saveToCloud]);

  // Get a style by ID
  const getCustomStyle = useCallback((id: string): CustomStyle | null => {
    return customStyles.find(s => s.id === id) || null;
  }, [customStyles]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    customStyles,
    defaultStyleId,
    currentMixedConfig,
    isLoading,
    isSynced,
    addCustomStyle,
    updateCustomStyle,
    deleteCustomStyle,
    setDefaultStyle,
    updateMixedConfig,
    getCustomStyle,
  };
}
