import { AppSettings, ThemeConfig } from '../types';

export class SettingsService {
  static createDefaultSettings(): AppSettings {
    return {
      theme: {
        background: {
          type: 'color',
          color: '#f4f3f0'
        },
        header: {
          type: 'color',
          color: '#ffffff'
        },
        widgetHeader: {
          type: 'color',
          color: '#5561d6'
        }
      }
    };
  }

  static updateTheme(settings: AppSettings, themeUpdates: Partial<ThemeConfig>): AppSettings {
    return {
      ...settings,
      theme: {
        ...settings.theme,
        ...themeUpdates
      }
    };
  }

  static updateBackground(settings: AppSettings, backgroundUpdates: Partial<ThemeConfig['background']>): AppSettings {
    return {
      ...settings,
      theme: {
        ...settings.theme,
        background: {
          ...settings.theme.background,
          ...backgroundUpdates
        }
      }
    };
  }

  static updateHeader(settings: AppSettings, headerUpdates: Partial<ThemeConfig['header']>): AppSettings {
    return {
      ...settings,
      theme: {
        ...settings.theme,
        header: {
          ...settings.theme.header,
          ...headerUpdates
        }
      }
    };
  }

  static updateWidgetHeader(settings: AppSettings, widgetHeaderUpdates: Partial<ThemeConfig['widgetHeader']>): AppSettings {
    return {
      ...settings,
      theme: {
        ...settings.theme,
        widgetHeader: {
          ...settings.theme.widgetHeader,
          ...widgetHeaderUpdates
        }
      }
    };
  }

  static generateCSSBackground(background: ThemeConfig['background']): string {
    switch (background.type) {
      case 'color':
        return background.color || '#1e2430';
      
      case 'gradient':
        if (background.gradient) {
          const { direction, colors } = background.gradient;
          return `linear-gradient(${direction}, ${colors.join(', ')})`;
        }
        return 'linear-gradient(to bottom, #1e2430, #2a3344)';
      
      case 'image':
        if (background.image) {
          const { url, opacity } = background.image;
          return `linear-gradient(rgba(0, 0, 0, ${1 - opacity}), rgba(0, 0, 0, ${1 - opacity})), url(${url})`;
        }
        return 'linear-gradient(to bottom, #1e2430, #2a3344)';
      
      default:
        return 'linear-gradient(to bottom, #1e2430, #2a3344)';
    }
  }

  static generateCSSHeader(header: ThemeConfig['header']): string {
    switch (header.type) {
      case 'color':
        return header.color || 'rgba(246, 243, 238, 0.12)';
      
      case 'gradient':
        if (header.gradient) {
          const { direction, colors } = header.gradient;
          return `linear-gradient(${direction}, ${colors.join(', ')})`;
        }
        return 'rgba(246, 243, 238, 0.12)';
      
      default:
        return 'rgba(246, 243, 238, 0.12)';
    }
  }

  static generateCSSWidgetHeader(widgetHeader: ThemeConfig['widgetHeader']): string {
    switch (widgetHeader.type) {
      case 'color':
        return widgetHeader.color || '#3d4fdb';
      
      case 'gradient':
        if (widgetHeader.gradient) {
          const { direction, colors } = widgetHeader.gradient;
          return `linear-gradient(${direction}, ${colors.join(', ')})`;
        }
        return '#3d4fdb';
      
      default:
        return '#3d4fdb';
    }
  }

  static getPresetThemes(): { name: string; theme: ThemeConfig }[] {
    const preset = (name: string, background: string, accent: string): { name: string; theme: ThemeConfig } => ({
      name,
      theme: {
        background: { type: 'color', color: background },
        header: { type: 'color', color: '#ffffff' },
        widgetHeader: { type: 'color', color: accent }
      }
    });
    return [
      preset('Soft', '#f4f3f0', '#5561d6'),
      preset('Sand', '#f3eee6', '#b0704a'),
      preset('Sage', '#edf1ec', '#4f7a5b'),
      preset('Mist', '#eef1f6', '#4f6fb0'),
      preset('Blush', '#f6efef', '#b45a6a')
    ];
  }
}
