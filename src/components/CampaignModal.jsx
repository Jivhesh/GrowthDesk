import React, { useState, useEffect } from 'react';

const SUGGESTED_TEMPLATES = [
  {
    name: 'Weekend Flash Offer',
    template: 'Hello {name}! Enjoy an exclusive 20% discount at {business} this Friday through Sunday. Show this message to claim your offer!'
  },
  {
    name: 'We Miss You! Re-engagement',
    template: 'Hi {name}, we noticed it has been a little while since your last visit to {business}. We would love to see you back! Here is a special 15% voucher for your next appointment.'
  },
  {
    name: 'Seasonal Festival Greeting',
    template: 'Warm greetings from {business}, {name}! Wishing you and your family joy and good health this festive season. Thank you for being a part of our journey.'
  }
];

export default function CampaignModal({ isOpen, onClose, onSave, campaign, loading }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (campaign) {
      setName(campaign.name || '');
      setTemplate(campaign.message_template || '');
    } else {
      setName('');
      setTemplate(SUGGESTED_TEMPLATES[0].template);
    }
    setValidationError('');
  }, [campaign, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Campaign name is required.');
      return;
    }
    if (!template.trim()) {
      setValidationError('Message template cannot be empty.');
      return;
    }

    setValidationError('');
    onSave({
      name: name.trim(),
      message_template: template.trim()
    });
  };

  const insertPlaceholder = (tag) => {
    setTemplate((prev) => prev + tag);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="campaign-modal-title">
      <div className="modal-content" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="campaign-modal-title" className="modal-title">
            {campaign ? 'Edit Campaign' : 'Create New Campaign'}
          </h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {validationError && (
          <div className="alert alert-error" role="alert">
            {validationError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="camp-name">Campaign Name *</label>
            <input
              id="camp-name"
              type="text"
              required
              placeholder="e.g. Diwal / Holiday Promotion, Re-engagement Drive"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Or Start with a Preset:</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {SUGGESTED_TEMPLATES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setName(preset.name);
                    setTemplate(preset.template);
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="camp-template">Message Template *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => insertPlaceholder('{name}')}
                  title="Insert recipient's name"
                >
                  + {'{name}'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => insertPlaceholder('{business}')}
                  title="Insert your business name"
                >
                  + {'{business}'}
                </button>
              </div>
            </div>
            <textarea
              id="camp-template"
              rows="5"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled={loading}
              required
              style={{ fontSize: '14px', lineHeight: '1.6' }}
            ></textarea>
            <span className="form-hint">
              Placeholders like <code>{'{name}'}</code> will be replaced with each customer&apos;s name, and <code>{'{business}'}</code> with your business name.
            </span>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : campaign ? 'Update Campaign' : 'Save Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

