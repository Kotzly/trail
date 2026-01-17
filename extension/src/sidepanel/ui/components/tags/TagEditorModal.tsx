import { useEffect, useMemo, useState } from 'react';
import type { TagDefinition } from '../../../../shared/types/tags.js';
import { TAG_COLOR_OPTIONS } from './tag-palette.js';
import { TAG_ICON_OPTIONS } from './tag-icons.js';
import { TagIcon } from './TagIcon.js';
import { Icons } from '../Icon.js';
import { createPortal } from 'react-dom';
import React from 'react';

type TagEditorMode = 'create' | 'edit';

export type TagEditorValue = {
  label: string;
  color: string;
  iconId: string;
};

type TagEditorModalProps = {
  open: boolean;
  mode: TagEditorMode;
  initial?: TagDefinition | null;
  onSubmit: (value: TagEditorValue) => void;
  onCancel: () => void;
};

export default function TagEditorModal({
  open,
  mode,
  initial,
  onSubmit,
  onCancel,
}: TagEditorModalProps) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [color, setColor] = useState(initial?.color ?? TAG_COLOR_OPTIONS[0]);
  const [iconId, setIconId] = useState(initial?.iconId ?? TAG_ICON_OPTIONS[0].id);

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? '');
    setColor(initial?.color ?? TAG_COLOR_OPTIONS[0]);
    setIconId(initial?.iconId ?? TAG_ICON_OPTIONS[0].id);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
      if (event.key === 'Enter') {
        const trimmed = label.trim();
        if (trimmed.length === 0 || trimmed.length > 20) return;
        event.preventDefault();
        onSubmit({ label: trimmed, color, iconId });
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [color, iconId, label, onCancel, onSubmit, open]);

  const trimmedLabel = label.trim();
  const isValid = trimmedLabel.length > 0 && trimmedLabel.length <= 20;
  const title = mode === 'create' ? 'New Tag' : 'Edit Tag';
  const submitLabel = mode === 'create' ? 'Create' : 'Save';
  const remaining = useMemo(() => 20 - trimmedLabel.length, [trimmedLabel.length]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="tag-editor-overlay" onClick={onCancel}>
      <div className="tag-editor" onClick={(event) => event.stopPropagation()}>
        <div className="tag-editor-header">
          <h3 className="tag-editor-title">{title}</h3>
          <button className="tag-editor-close" type="button" onClick={onCancel} aria-label="Close">
            <Icons.X size={16} />
          </button>
        </div>

        <label className="tag-editor-label">
          Name
          <div className="tag-editor-input-wrap">
            <input
              className="tag-editor-input"
              type="text"
              maxLength={20}
              placeholder="Tag name"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              autoFocus
            />
            <span className={`tag-editor-count ${remaining < 0 ? 'invalid' : ''}`}>
              {remaining}
            </span>
          </div>
        </label>

        <div className="tag-editor-section">
          <div className="tag-editor-section-title">Color</div>
          <div className="tag-editor-color-grid">
            {TAG_COLOR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`tag-editor-color ${option === color ? 'selected' : ''}`}
                style={{ backgroundColor: option }}
                onClick={() => setColor(option)}
                aria-label={`Select color ${option}`}
              />
            ))}
          </div>
        </div>

        <div className="tag-editor-section">
          <div className="tag-editor-section-title">Icon</div>
          <div className="tag-editor-icon-grid">
            {TAG_ICON_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`tag-editor-icon ${option.id === iconId ? 'selected' : ''}`}
                onClick={() => setIconId(option.id)}
                aria-label={`Select icon ${option.label}`}
              >
                <TagIcon id={option.id} size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="tag-editor-preview">
          <span className="tag-dot tag-editor-preview-dot" style={{ background: color }}>
            <TagIcon id={iconId} size={12} />
          </span>
          <span className="tag-editor-preview-label">{trimmedLabel || 'Tag name'}</span>
        </div>

        <div className="tag-editor-actions">
          <button className="tag-editor-btn ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="tag-editor-btn"
            type="button"
            disabled={!isValid}
            onClick={() => onSubmit({ label: trimmedLabel, color, iconId })}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
