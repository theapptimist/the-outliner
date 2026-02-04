import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface EntityPermission {
  id: string;
  entity_id: string;
  granted_to_user_id: string;
  granted_by_user_id: string;
  created_at: string;
}

interface UseEntityPermissionsOptions {
  entityId?: string;
}

export function useEntityPermissions(options: UseEntityPermissionsOptions = {}) {
  const { entityId } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [permissions, setPermissions] = useState<EntityPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch permissions for a specific entity (only owner can see)
  const fetchPermissions = useCallback(async (id?: string) => {
    const targetId = id || entityId;
    if (!user || !targetId) {
      setPermissions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('entity_permissions')
        .select('*')
        .eq('entity_id', targetId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPermissions(data || []);
    } catch (err) {
      console.error('[useEntityPermissions] Error fetching permissions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch permissions'));
    } finally {
      setLoading(false);
    }
  }, [user, entityId]);

  // Grant permission to a user
  const grantPermission = useCallback(async (
    entityId: string,
    grantToUserId: string
  ): Promise<EntityPermission | null> => {
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return null;
    }

    try {
      // Check if permission already exists
      const { data: existing } = await supabase
        .from('entity_permissions')
        .select('id')
        .eq('entity_id', entityId)
        .eq('granted_to_user_id', grantToUserId)
        .maybeSingle();

      if (existing) {
        toast({ title: 'Permission already exists' });
        return null;
      }

      const { data: newPermission, error: insertError } = await supabase
        .from('entity_permissions')
        .insert({
          entity_id: entityId,
          granted_to_user_id: grantToUserId,
          granted_by_user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setPermissions(prev => [newPermission, ...prev]);
      toast({ title: 'Permission granted' });
      return newPermission;
    } catch (err) {
      console.error('[useEntityPermissions] Error granting permission:', err);
      toast({ title: 'Failed to grant permission', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  // Revoke permission
  const revokePermission = useCallback(async (permissionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: deleteError } = await supabase
        .from('entity_permissions')
        .delete()
        .eq('id', permissionId);

      if (deleteError) throw deleteError;

      setPermissions(prev => prev.filter(p => p.id !== permissionId));
      toast({ title: 'Permission revoked' });
      return true;
    } catch (err) {
      console.error('[useEntityPermissions] Error revoking permission:', err);
      toast({ title: 'Failed to revoke permission', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  // Get entities shared with current user
  const getSharedWithMe = useCallback(async (): Promise<string[]> => {
    if (!user) return [];

    try {
      const { data, error: fetchError } = await supabase
        .from('entity_permissions')
        .select('entity_id')
        .eq('granted_to_user_id', user.id);

      if (fetchError) throw fetchError;

      return (data || []).map(p => p.entity_id);
    } catch (err) {
      console.error('[useEntityPermissions] Error fetching shared entities:', err);
      return [];
    }
  }, [user]);

  useEffect(() => {
    if (entityId) {
      fetchPermissions();
    }
  }, [entityId, fetchPermissions]);

  return {
    permissions,
    loading,
    error,
    refresh: fetchPermissions,
    grantPermission,
    revokePermission,
    getSharedWithMe,
  };
}
