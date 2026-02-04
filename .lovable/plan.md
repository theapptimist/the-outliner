
# User Settings Implementation Plan

## Overview
Add a comprehensive Settings page accessible from the editor, covering account management, editor preferences, and appearance options. The settings will be cloud-synced for authenticated users.

## Architecture

### New Files
```text
src/pages/Settings.tsx              - Main settings page with tabbed sections
src/components/settings/AccountSection.tsx    - Profile & account management
src/components/settings/EditorSection.tsx     - Editor preferences
src/components/settings/AppearanceSection.tsx - Theme, font size, page width
src/hooks/useUserSettings.ts        - Hook for cloud-synced user settings
```

### Modified Files
```text
src/App.tsx                         - Add /settings route
src/components/editor/FileMenu.tsx  - Add Settings menu item
```

### Database Changes
- Extend `user_style_preferences` table with new columns for all settings OR create a new `user_settings` table
- Recommended: Create new `user_settings` table for clean separation

## Detailed Design

### 1. Database: `user_settings` Table
```sql
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  
  -- Appearance
  theme text DEFAULT 'system',           -- 'light' | 'dark' | 'system'
  font_size text DEFAULT 'medium',       -- 'small' | 'medium' | 'large'
  page_width text DEFAULT 'normal',      -- 'narrow' | 'normal' | 'wide' | 'full'
  
  -- Editor Preferences (persisted globally, not per-document)
  auto_save boolean DEFAULT true,
  auto_descend boolean DEFAULT false,
  show_row_highlight boolean DEFAULT false,
  show_slash_placeholder boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies (same pattern as existing tables)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can create own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);
```

### 2. Settings Page Structure

```text
/settings
├── Account Tab
│   ├── Email (display only, linked to auth)
│   ├── Change Password form
│   ├── Delete Account button (with confirmation)
│   └── Sign Out button
│
├── Editor Tab
│   ├── Auto-save toggle
│   ├── Auto-descend toggle
│   ├── Row highlight toggle
│   ├── Slash placeholder toggle
│   └── Default outline style picker (links to existing style preferences)
│
└── Appearance Tab
    ├── Theme selector (Light / Dark / System)
    ├── Font size selector (Small / Medium / Large)
    └── Page width selector (Narrow / Normal / Wide / Full)
```

### 3. Theme Implementation
Currently, theme is managed via local state in `EditorSidebar.tsx` with a manual `isDark` toggle. This will be refactored:

- Install and configure `next-themes` ThemeProvider in `App.tsx`
- Replace manual dark class toggling with `useTheme()` hook
- Theme preference persists to `user_settings.theme` in cloud
- Add "System" option to respect OS preference

### 4. Hook: `useUserSettings`
```typescript
interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  pageWidth: 'narrow' | 'normal' | 'wide' | 'full';
  autoSave: boolean;
  autoDescend: boolean;
  showRowHighlight: boolean;
  showSlashPlaceholder: boolean;
}

function useUserSettings() {
  // Load from cloud on mount
  // Debounced save on changes
  // Fallback to localStorage for offline
  return { settings, updateSettings, isLoading };
}
```

### 5. Entry Point: FileMenu
Add a "Settings" menu item in `FileMenu.tsx` that navigates to `/settings`:
```tsx
<MenuItem
  icon={<Settings className="h-3.5 w-3.5" />}
  label="Settings"
  onClick={() => navigate('/settings')}
/>
```

### 6. Appearance Controls

**Font Size**: Applied via CSS variable on `<body>`:
```css
body[data-font-size="small"] { font-size: 14px; }
body[data-font-size="medium"] { font-size: 16px; }
body[data-font-size="large"] { font-size: 18px; }
```

**Page Width**: Applied to editor container:
```css
.page-narrow { max-width: 640px; }
.page-normal { max-width: 800px; }
.page-wide { max-width: 1024px; }
.page-full { max-width: 100%; }
```

### 7. Account Section Features

**Change Password**:
- Uses existing `supabase.auth.updateUser({ password })` 
- Same flow as password reset but without email link

**Delete Account**:
- Confirmation modal with email re-entry
- Cascade deletes all user data (documents, entities, settings)
- Calls `supabase.auth.admin.deleteUser()` via edge function (or user-initiated `signOut` + backend cleanup)

Note: Account deletion typically requires a backend function with service role key. Alternative: mark account for deletion and process async.

## Implementation Order

1. **Database migration**: Create `user_settings` table with RLS
2. **Hook**: Build `useUserSettings` with cloud sync
3. **ThemeProvider**: Wrap app with `next-themes` provider
4. **Settings page**: Build tabbed UI with all three sections
5. **FileMenu integration**: Add Settings navigation
6. **Migrate existing preferences**: Move `showRowHighlight`, `showSlashPlaceholder`, `isDark` from localStorage to cloud settings
7. **Account deletion edge function**: Create secure delete endpoint

## Technical Considerations

- **Backwards compatibility**: Existing localStorage preferences are migrated to cloud on first load
- **Offline support**: Settings fall back to localStorage when offline
- **Real-time sync**: Not required for settings (low-frequency updates)
- **Security**: Password changes require current session; account deletion requires confirmation

## UI/UX

- Clean card-based layout similar to Auth page
- Tabs for section navigation
- Inline validation and success feedback via toasts
- "Back to Editor" button in header
- Responsive design for mobile
