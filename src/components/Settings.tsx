import React, { useState } from 'react';
import styled from 'styled-components';
import { AppSettings, ThemeConfig } from '../types';
import { SettingsService } from '../services/settingsService';
import { FiX, FiImage, FiDownload, FiUpload } from 'react-icons/fi';
import { MdPalette, MdGradient } from 'react-icons/md';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
}

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #333;
  font-size: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f0f0f0;
    color: #333;
  }
`;

const Section = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 16px 0;
  color: #333;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PresetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`;

const PresetButton = styled.button<{ isActive: boolean }>`
  background: ${props => props.isActive ? '#667eea' : '#f8f9fa'};
  color: ${props => props.isActive ? 'white' : '#333'};
  border: 2px solid ${props => props.isActive ? '#667eea' : '#e0e0e0'};
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #667eea;
    transform: translateY(-1px);
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 14px;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const ColorInput = styled.input`
  width: 60px;
  height: 40px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const ColorGroup = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
`;

const ColorLabel = styled.span`
  font-size: 14px;
  color: #666;
  min-width: 80px;
`;

const AddColorButton = styled.button`
  background: #667eea;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: #5a6fd8;
  }
`;

const RemoveColorButton = styled.button`
  background: #dc3545;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: #c82333;
  }
`;

const PreviewBox = styled.div<{ background: string }>`
  width: 100%;
  height: 80px;
  border-radius: 8px;
  background: ${props => props.background};
  border: 1px solid #e0e0e0;
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const OpacitySlider = styled.input`
  width: 100%;
  margin-top: 8px;
`;

const OpacityValue = styled.span`
  font-size: 12px;
  color: #666;
  margin-left: 8px;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
`;

const Button = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background-color 0.2s ease;
  
  &.primary {
    background: #667eea;
    color: white;
    
    &:hover {
      background: #5a6fd8;
    }
  }
  
  &.secondary {
    background: #6c757d;
    color: white;
    
    &:hover {
      background: #5a6268;
    }
  }
`;

const Settings: React.FC<SettingsProps> = ({ settings, onSettingsChange, onClose }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const presetThemes = SettingsService.getPresetThemes();

  const handlePresetSelect = (preset: { name: string; theme: ThemeConfig }) => {
    setLocalSettings({
      ...localSettings,
      theme: preset.theme
    });
  };

  const handleBackgroundTypeChange = (type: 'color' | 'gradient' | 'image') => {
    setLocalSettings(SettingsService.updateBackground(localSettings, { type }));
  };

  const handleBackgroundColorChange = (color: string) => {
    setLocalSettings(SettingsService.updateBackground(localSettings, { color }));
  };

  const handleBackgroundGradientDirectionChange = (direction: string) => {
    const currentGradient = localSettings.theme.background.gradient;
    if (currentGradient) {
      setLocalSettings(SettingsService.updateBackground(localSettings, {
        gradient: { ...currentGradient, direction: direction as any }
      }));
    }
  };

  const handleBackgroundGradientColorChange = (index: number, color: string) => {
    const currentGradient = localSettings.theme.background.gradient;
    if (currentGradient) {
      const newColors = [...currentGradient.colors];
      newColors[index] = color;
      setLocalSettings(SettingsService.updateBackground(localSettings, {
        gradient: { ...currentGradient, colors: newColors }
      }));
    }
  };

  const handleAddGradientColor = () => {
    const currentGradient = localSettings.theme.background.gradient;
    if (currentGradient) {
      setLocalSettings(SettingsService.updateBackground(localSettings, {
        gradient: { ...currentGradient, colors: [...currentGradient.colors, '#000000'] }
      }));
    }
  };

  const handleRemoveGradientColor = (index: number) => {
    const currentGradient = localSettings.theme.background.gradient;
    if (currentGradient && currentGradient.colors.length > 2) {
      const newColors = currentGradient.colors.filter((_, i) => i !== index);
      setLocalSettings(SettingsService.updateBackground(localSettings, {
        gradient: { ...currentGradient, colors: newColors }
      }));
    }
  };

  const handleBackgroundImageChange = (url: string) => {
    const currentImage = localSettings.theme.background.image;
    setLocalSettings(SettingsService.updateBackground(localSettings, {
      image: { url, opacity: currentImage?.opacity || 0.5 }
    }));
  };

  const handleBackgroundImageOpacityChange = (opacity: number) => {
    const currentImage = localSettings.theme.background.image;
    if (currentImage) {
      setLocalSettings(SettingsService.updateBackground(localSettings, {
        image: { ...currentImage, opacity }
      }));
    }
  };

  const handleHeaderTypeChange = (type: 'color' | 'gradient') => {
    setLocalSettings(SettingsService.updateHeader(localSettings, { type }));
  };

  const handleHeaderColorChange = (color: string) => {
    setLocalSettings(SettingsService.updateHeader(localSettings, { color }));
  };

  const handleHeaderGradientDirectionChange = (direction: string) => {
    const currentGradient = localSettings.theme.header.gradient;
    if (currentGradient) {
      setLocalSettings(SettingsService.updateHeader(localSettings, {
        gradient: { ...currentGradient, direction: direction as any }
      }));
    }
  };

  const handleHeaderGradientColorChange = (index: number, color: string) => {
    const currentGradient = localSettings.theme.header.gradient;
    if (currentGradient) {
      const newColors = [...currentGradient.colors];
      newColors[index] = color;
      setLocalSettings(SettingsService.updateHeader(localSettings, {
        gradient: { ...currentGradient, colors: newColors }
      }));
    }
  };

  const handleWidgetHeaderTypeChange = (type: 'color' | 'gradient') => {
    setLocalSettings(SettingsService.updateWidgetHeader(localSettings, { type }));
  };

  const handleWidgetHeaderColorChange = (color: string) => {
    setLocalSettings(SettingsService.updateWidgetHeader(localSettings, { color }));
  };

  const handleWidgetHeaderGradientDirectionChange = (direction: string) => {
    const currentGradient = localSettings.theme.widgetHeader.gradient;
    if (currentGradient) {
      setLocalSettings(SettingsService.updateWidgetHeader(localSettings, {
        gradient: { ...currentGradient, direction: direction as any }
      }));
    }
  };

  const handleWidgetHeaderGradientColorChange = (index: number, color: string) => {
    const currentGradient = localSettings.theme.widgetHeader.gradient;
    if (currentGradient) {
      const newColors = [...currentGradient.colors];
      newColors[index] = color;
      setLocalSettings(SettingsService.updateWidgetHeader(localSettings, {
        gradient: { ...currentGradient, colors: newColors }
      }));
    }
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  const currentBackgroundCSS = SettingsService.generateCSSBackground(localSettings.theme.background);
  const currentHeaderCSS = SettingsService.generateCSSHeader(localSettings.theme.header);
  const currentWidgetHeaderCSS = SettingsService.generateCSSWidgetHeader(localSettings.theme.widgetHeader);

  return (
    <Modal onClick={onClose}>
      <ModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <MdPalette />
            Theme Settings
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <FiX size={20} />
          </CloseButton>
        </ModalHeader>

        <Section>
          <SectionTitle>Preset Themes</SectionTitle>
          <PresetGrid>
            {presetThemes.map((preset) => (
              <PresetButton
                key={preset.name}
                isActive={JSON.stringify(preset.theme) === JSON.stringify(localSettings.theme)}
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.name}
              </PresetButton>
            ))}
          </PresetGrid>
        </Section>

        <Section>
          <SectionTitle>
            <FiImage />
            Background
          </SectionTitle>
          
          <FormGroup>
            <Label>Background Type</Label>
            <Select
              value={localSettings.theme.background.type}
              onChange={(e) => handleBackgroundTypeChange(e.target.value as any)}
            >
              <option value="color">Solid Color</option>
              <option value="gradient">Gradient</option>
              <option value="image">Background Image</option>
            </Select>
          </FormGroup>

          {localSettings.theme.background.type === 'color' && (
            <FormGroup>
              <Label>Background Color</Label>
              <ColorInput
                type="color"
                value={localSettings.theme.background.color || '#667eea'}
                onChange={(e) => handleBackgroundColorChange(e.target.value)}
              />
            </FormGroup>
          )}

          {localSettings.theme.background.type === 'gradient' && (
            <>
              <FormGroup>
                <Label>Gradient Direction</Label>
                <Select
                  value={localSettings.theme.background.gradient?.direction || 'to bottom right'}
                  onChange={(e) => handleBackgroundGradientDirectionChange(e.target.value)}
                >
                  <option value="to right">To Right</option>
                  <option value="to bottom">To Bottom</option>
                  <option value="to bottom right">To Bottom Right</option>
                  <option value="to bottom left">To Bottom Left</option>
                  <option value="to top">To Top</option>
                  <option value="to top right">To Top Right</option>
                  <option value="to top left">To Top Left</option>
                  <option value="to left">To Left</option>
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Gradient Colors</Label>
                {localSettings.theme.background.gradient?.colors.map((color, index) => (
                  <ColorGroup key={index}>
                    <ColorLabel>Color {index + 1}:</ColorLabel>
                    <ColorInput
                      type="color"
                      value={color}
                      onChange={(e) => handleBackgroundGradientColorChange(index, e.target.value)}
                    />
                    {localSettings.theme.background.gradient!.colors.length > 2 && (
                      <RemoveColorButton onClick={() => handleRemoveGradientColor(index)}>
                        Remove
                      </RemoveColorButton>
                    )}
                  </ColorGroup>
                ))}
                <AddColorButton onClick={handleAddGradientColor}>
                  Add Color
                </AddColorButton>
              </FormGroup>
            </>
          )}

          {localSettings.theme.background.type === 'image' && (
            <>
              <FormGroup>
                <Label>Image URL</Label>
                <Input
                  type="text"
                  placeholder="https://example.com/image.jpg"
                  value={localSettings.theme.background.image?.url || ''}
                  onChange={(e) => handleBackgroundImageChange(e.target.value)}
                />
              </FormGroup>

              <FormGroup>
                <Label>
                  Image Opacity
                  <OpacityValue>
                    {Math.round((localSettings.theme.background.image?.opacity || 0.5) * 100)}%
                  </OpacityValue>
                </Label>
                <OpacitySlider
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={localSettings.theme.background.image?.opacity || 0.5}
                  onChange={(e) => handleBackgroundImageOpacityChange(parseFloat(e.target.value))}
                />
              </FormGroup>
            </>
          )}

          <PreviewBox background={currentBackgroundCSS}>
            Background Preview
          </PreviewBox>
        </Section>

        <Section>
          <SectionTitle>
            <MdGradient />
            Header
          </SectionTitle>
          
          <FormGroup>
            <Label>Header Type</Label>
            <Select
              value={localSettings.theme.header.type}
              onChange={(e) => handleHeaderTypeChange(e.target.value as any)}
            >
              <option value="color">Solid Color</option>
              <option value="gradient">Gradient</option>
            </Select>
          </FormGroup>

          {localSettings.theme.header.type === 'color' && (
            <FormGroup>
              <Label>Header Color</Label>
              <ColorInput
                type="color"
                value={localSettings.theme.header.color || 'rgba(255, 255, 255, 0.2)'}
                onChange={(e) => handleHeaderColorChange(e.target.value)}
              />
            </FormGroup>
          )}

          {localSettings.theme.header.type === 'gradient' && (
            <>
              <FormGroup>
                <Label>Gradient Direction</Label>
                <Select
                  value={localSettings.theme.header.gradient?.direction || 'to right'}
                  onChange={(e) => handleHeaderGradientDirectionChange(e.target.value)}
                >
                  <option value="to right">To Right</option>
                  <option value="to bottom">To Bottom</option>
                  <option value="to bottom right">To Bottom Right</option>
                  <option value="to bottom left">To Bottom Left</option>
                  <option value="to top">To Top</option>
                  <option value="to top right">To Top Right</option>
                  <option value="to top left">To Top Left</option>
                  <option value="to left">To Left</option>
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Gradient Colors</Label>
                {localSettings.theme.header.gradient?.colors.map((color, index) => (
                  <ColorGroup key={index}>
                    <ColorLabel>Color {index + 1}:</ColorLabel>
                    <ColorInput
                      type="color"
                      value={color}
                      onChange={(e) => handleHeaderGradientColorChange(index, e.target.value)}
                    />
                  </ColorGroup>
                ))}
              </FormGroup>
            </>
          )}

          <PreviewBox background={currentHeaderCSS}>
            Header Preview
          </PreviewBox>
        </Section>

        <Section>
          <SectionTitle>
            <MdGradient />
            Widget Headers
          </SectionTitle>
          
          <FormGroup>
            <Label>Widget Header Type</Label>
            <Select
              value={localSettings.theme.widgetHeader.type}
              onChange={(e) => handleWidgetHeaderTypeChange(e.target.value as any)}
            >
              <option value="color">Solid Color</option>
              <option value="gradient">Gradient</option>
            </Select>
          </FormGroup>

          {localSettings.theme.widgetHeader.type === 'color' && (
            <FormGroup>
              <Label>Widget Header Color</Label>
              <ColorInput
                type="color"
                value={localSettings.theme.widgetHeader.color || '#667eea'}
                onChange={(e) => handleWidgetHeaderColorChange(e.target.value)}
              />
            </FormGroup>
          )}

          {localSettings.theme.widgetHeader.type === 'gradient' && (
            <>
              <FormGroup>
                <Label>Gradient Direction</Label>
                <Select
                  value={localSettings.theme.widgetHeader.gradient?.direction || 'to right'}
                  onChange={(e) => handleWidgetHeaderGradientDirectionChange(e.target.value)}
                >
                  <option value="to right">To Right</option>
                  <option value="to bottom">To Bottom</option>
                  <option value="to bottom right">To Bottom Right</option>
                  <option value="to bottom left">To Bottom Left</option>
                  <option value="to top">To Top</option>
                  <option value="to top right">To Top Right</option>
                  <option value="to top left">To Top Left</option>
                  <option value="to left">To Left</option>
                </Select>
              </FormGroup>

              <FormGroup>
                <Label>Gradient Colors</Label>
                {localSettings.theme.widgetHeader.gradient?.colors.map((color, index) => (
                  <ColorGroup key={index}>
                    <ColorLabel>Color {index + 1}:</ColorLabel>
                    <ColorInput
                      type="color"
                      value={color}
                      onChange={(e) => handleWidgetHeaderGradientColorChange(index, e.target.value)}
                    />
                  </ColorGroup>
                ))}
              </FormGroup>
            </>
          )}

          <PreviewBox background={currentWidgetHeaderCSS}>
            Widget Header Preview
          </PreviewBox>
        </Section>

        <ButtonGroup>
          <Button className="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button className="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </ButtonGroup>
      </ModalContent>
    </Modal>
  );
};

export default Settings; 