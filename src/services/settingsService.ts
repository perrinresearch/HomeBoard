import { AppSettings, ThemeConfig } from '../types';

export class SettingsService {
  static createDefaultSettings(): AppSettings {
    return {
      theme: {
        background: {
          type: 'gradient',
          gradient: {
            direction: 'to bottom right',
            colors: ['#667eea', '#764ba2']
          }
        },
        header: {
          type: 'color',
          color: 'rgba(255, 255, 255, 0.2)'
        },
        widgetHeader: {
          type: 'gradient',
          gradient: {
            direction: 'to right',
            colors: ['#667eea', '#764ba2']
          }
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
        return background.color || '#667eea';
      
      case 'gradient':
        if (background.gradient) {
          const { direction, colors } = background.gradient;
          return `linear-gradient(${direction}, ${colors.join(', ')})`;
        }
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      
      case 'image':
        if (background.image) {
          const { url, opacity } = background.image;
          return `linear-gradient(rgba(0, 0, 0, ${1 - opacity}), rgba(0, 0, 0, ${1 - opacity})), url(${url})`;
        }
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      
      default:
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  }

  static generateCSSHeader(header: ThemeConfig['header']): string {
    switch (header.type) {
      case 'color':
        return header.color || 'rgba(255, 255, 255, 0.2)';
      
      case 'gradient':
        if (header.gradient) {
          const { direction, colors } = header.gradient;
          return `linear-gradient(${direction}, ${colors.join(', ')})`;
        }
        return 'rgba(255, 255, 255, 0.2)';
      
      default:
        return 'rgba(255, 255, 255, 0.2)';
    }
  }

  static generateCSSWidgetHeader(widgetHeader: ThemeConfig['widgetHeader']): string {
    switch (widgetHeader.type) {
      case 'color':
        return widgetHeader.color || '#667eea';
      
      case 'gradient':
        if (widgetHeader.gradient) {
          const { direction, colors } = widgetHeader.gradient;
          return `linear-gradient(${direction}, ${colors.join(', ')})`;
        }
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      
      default:
        return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  }

  static getPresetThemes(): { name: string; theme: ThemeConfig }[] {
    return [
      {
        name: 'Default',
        theme: {
          background: {
            type: 'gradient',
            gradient: {
              direction: 'to bottom right',
              colors: ['#667eea', '#764ba2']
            }
          },
          header: {
            type: 'color',
            color: 'rgba(255, 255, 255, 0.2)'
          },
          widgetHeader: {
            type: 'gradient',
            gradient: {
              direction: 'to right',
              colors: ['#667eea', '#764ba2']
            }
          }
        }
      },
      {
        name: 'Ocean',
        theme: {
          background: {
            type: 'gradient',
            gradient: {
              direction: 'to bottom',
              colors: ['#1e3c72', '#2a5298']
            }
          },
          header: {
            type: 'color',
            color: 'rgba(255, 255, 255, 0.15)'
          },
          widgetHeader: {
            type: 'gradient',
            gradient: {
              direction: 'to right',
              colors: ['#1e3c72', '#2a5298']
            }
          }
        }
      },
      {
        name: 'Sunset',
        theme: {
          background: {
            type: 'gradient',
            gradient: {
              direction: 'to bottom',
              colors: ['#ff6b6b', '#feca57', '#48dbfb']
            }
          },
          header: {
            type: 'color',
            color: 'rgba(255, 255, 255, 0.2)'
          },
          widgetHeader: {
            type: 'gradient',
            gradient: {
              direction: 'to right',
              colors: ['#ff6b6b', '#feca57']
            }
          }
        }
      },
      {
        name: 'Forest',
        theme: {
          background: {
            type: 'gradient',
            gradient: {
              direction: 'to bottom right',
              colors: ['#2d5a27', '#4a7c59']
            }
          },
          header: {
            type: 'color',
            color: 'rgba(255, 255, 255, 0.15)'
          },
          widgetHeader: {
            type: 'gradient',
            gradient: {
              direction: 'to right',
              colors: ['#2d5a27', '#4a7c59']
            }
          }
        }
      },
      {
        name: 'Minimal',
        theme: {
          background: {
            type: 'color',
            color: '#f8f9fa'
          },
          header: {
            type: 'color',
            color: '#6c757d'
          },
          widgetHeader: {
            type: 'color',
            color: '#6c757d'
          }
        }
      }
    ];
  }
} 