# HomeBoard Settings & Theme Customization

## Overview
HomeBoard now includes a comprehensive settings system that allows users to fully customize the appearance of their dashboard. Users can modify backgrounds, headers, and widget headers with support for solid colors, gradients, and background images.

## Features

### 1. Preset Themes
- **Default**: Classic purple gradient theme
- **Ocean**: Deep blue gradient theme
- **Sunset**: Warm orange-to-blue gradient theme
- **Forest**: Green gradient theme
- **Minimal**: Clean, simple theme with solid colors

### 2. Background Customization
- **Solid Color**: Choose any color for the background
- **Gradient**: Create custom gradients with multiple colors and directions
- **Background Image**: Use custom images with adjustable opacity

### 3. Header Customization
- **Solid Color**: Choose any color for the header buttons
- **Gradient**: Create custom gradients for header elements

### 4. Widget Header Customization
- **Solid Color**: Choose any color for widget headers
- **Gradient**: Create custom gradients for widget headers

## How to Access Settings

1. Click the **Settings** button in the top-right corner of the dashboard
2. The settings modal will open with all customization options
3. Make your changes and click **Save Changes** to apply them

## Background Options

### Solid Color Background
1. Select "Solid Color" from the Background Type dropdown
2. Use the color picker to choose your desired color
3. The preview will update immediately

### Gradient Background
1. Select "Gradient" from the Background Type dropdown
2. Choose a gradient direction (to right, to bottom, etc.)
3. Set your gradient colors using the color pickers
4. Add or remove colors as needed (minimum 2 colors)
5. The preview will update in real-time

### Background Image
1. Select "Background Image" from the Background Type dropdown
2. Enter the URL of your image (must be publicly accessible)
3. Adjust the opacity slider to control image visibility
4. The preview will show how the image will appear

## Header Options

### Solid Color Header
1. Select "Solid Color" from the Header Type dropdown
2. Use the color picker to choose your desired color
3. The preview will update immediately

### Gradient Header
1. Select "Gradient" from the Header Type dropdown
2. Choose a gradient direction
3. Set your gradient colors using the color pickers
4. The preview will update in real-time

## Widget Header Options

### Solid Color Widget Headers
1. Select "Solid Color" from the Widget Header Type dropdown
2. Use the color picker to choose your desired color
3. The preview will update immediately

### Gradient Widget Headers
1. Select "Gradient" from the Widget Header Type dropdown
2. Choose a gradient direction
3. Set your gradient colors using the color pickers
4. The preview will update in real-time

## Gradient Directions

Available gradient directions include:
- **To Right**: Horizontal gradient from left to right
- **To Bottom**: Vertical gradient from top to bottom
- **To Bottom Right**: Diagonal gradient to bottom right
- **To Bottom Left**: Diagonal gradient to bottom left
- **To Top**: Vertical gradient from bottom to top
- **To Top Right**: Diagonal gradient to top right
- **To Top Left**: Diagonal gradient to top left
- **To Left**: Horizontal gradient from right to left

## Technical Implementation

### Settings Service
The `SettingsService` class provides:
- Default theme configuration
- CSS generation for backgrounds, headers, and widget headers
- Preset theme management
- Theme update utilities

### Settings Component
The `Settings` component provides:
- Interactive theme customization interface
- Real-time preview of changes
- Preset theme selection
- Form validation and error handling

### Integration
- Settings are stored in the main app state
- Changes are applied immediately to the UI
- All components use dynamic styling based on settings

## CSS Generation

The settings system automatically generates CSS for:
- **Background**: `linear-gradient()`, `url()`, or solid colors
- **Headers**: `linear-gradient()` or solid colors
- **Widget Headers**: `linear-gradient()` or solid colors

## Best Practices

### Background Images
- Use high-resolution images (1920x1080 or higher)
- Ensure images are publicly accessible
- Consider using WebP format for better performance
- Test opacity settings for readability

### Color Selection
- Ensure sufficient contrast for text readability
- Consider using complementary colors for gradients
- Test your theme on different screen sizes
- Use color pickers for precise color selection

### Gradient Design
- Start with 2-3 colors for best results
- Use similar color families for smooth transitions
- Consider the direction's impact on visual flow
- Test gradients on different backgrounds

## Future Enhancements

Potential improvements could include:
- Custom theme import/export functionality
- More preset themes
- Advanced color palette tools
- Animation and transition effects
- Theme scheduling (day/night modes)
- User preference saving to localStorage
- Theme sharing between users

## Troubleshooting

### Image Not Loading
- Ensure the image URL is publicly accessible
- Check that the URL is correct and includes the file extension
- Try using a different image hosting service

### Colors Not Applying
- Refresh the page to ensure changes are saved
- Check that you clicked "Save Changes" before closing
- Verify that the color picker is working correctly

### Performance Issues
- Reduce the number of gradient colors
- Use optimized image formats
- Consider using solid colors instead of complex gradients 