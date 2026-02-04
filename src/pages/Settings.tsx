import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { AccountSection } from '@/components/settings/AccountSection';
import { EditorSection } from '@/components/settings/EditorSection';
import { AppearanceSection } from '@/components/settings/AppearanceSection';
import { ArrowLeft, User, PenTool, Palette, Loader2 } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { settings, updateSettings, isLoading: settingsLoading } = useUserSettings();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4 max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/editor')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Editor
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8 max-w-3xl mx-auto">
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-2">
              <PenTool className="h-4 w-4" />
              <span className="hidden sm:inline">Editor</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <AccountSection />
          </TabsContent>

          <TabsContent value="editor">
            <EditorSection settings={settings} onUpdateSettings={updateSettings} />
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSection settings={settings} onUpdateSettings={updateSettings} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
