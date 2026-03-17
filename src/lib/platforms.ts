import type { Database } from '@/integrations/supabase/types';

type Platform = Database['public']['Enums']['ad_platform'];

export const PLATFORM_CONFIG: Record<Platform, { label: string; color: string; defaultUrl: string }> = {
  meta: {
    label: 'Meta',
    color: 'text-platform-meta',
    defaultUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2-s_6alRgXIJ3N_Qdj8fkg1xMQQKnq6uSW0eIdDz3Jj3Ey06eBI57a3raf6AU1yrAIN0Ze3lUM5_q/pub?gid=585558827&single=true&output=csv',
  },
  google: {
    label: 'Google Ads',
    color: 'text-platform-google',
    defaultUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2-s_6alRgXIJ3N_Qdj8fkg1xMQQKnq6uSW0eIdDz3Jj3Ey06eBI57a3raf6AU1yrAIN0Ze3lUM5_q/pub?gid=2023631673&single=true&output=csv',
  },
  tiktok: {
    label: 'TikTok Ads',
    color: 'text-platform-tiktok',
    defaultUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2-s_6alRgXIJ3N_Qdj8fkg1xMQQKnq6uSW0eIdDz3Jj3Ey06eBI57a3raf6AU1yrAIN0Ze3lUM5_q/pub?gid=159703754&single=true&output=csv',
  },
  linkedin: {
    label: 'LinkedIn Ads',
    color: 'text-platform-linkedin',
    defaultUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2-s_6alRgXIJ3N_Qdj8fkg1xMQQKnq6uSW0eIdDz3Jj3Ey06eBI57a3raf6AU1yrAIN0Ze3lUM5_q/pub?gid=1693040478&single=true&output=csv',
  },
  extra1: {
    label: 'Fuente Extra 1',
    color: 'text-muted-foreground',
    defaultUrl: '',
  },
  extra2: {
    label: 'Fuente Extra 2',
    color: 'text-muted-foreground',
    defaultUrl: '',
  },
};

export const PLATFORMS = Object.keys(PLATFORM_CONFIG) as Platform[];
