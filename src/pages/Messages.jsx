import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { normalizePhoneNumber, generateWaLink } from '../lib/phoneUtils';

const DEFAULT_TEMPLATES = {
  follow_up: 'Hi {name}, thank you for visiting {business}! We wanted to check in and see how everything was. Let us know if you need anything or would like to book your next session!',
  review_request: 'Hi {name}, we loved having you at {business}! If you enjoyed your experience, would you mind taking 30 seconds to leave us a quick Google review? It helps our local team tremendously!',
  promotion: 'Special offer for you, {name}! As a valued customer of {business}, show this message on your next visit to receive 15% off your service. Offer valid this week!',
  custom: 'Hi {name},\n\n'
};

export default function Messages() {
  const { user, business } = useAuth();
  const location = useLocation();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [messageType, setMessageType] = useState('follow_up');
  const [messageText, setMessageText] = useState('');

  // Fetch customers
  useEffect(() => {
    if (!user) return;
    const fetchCustomers = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, phone, email, tags, last_visit_date')
          .order('name');

        if (error) throw error;
        setCustomers(data || []);

        // Pick customer from location state or default to first
        const preselectedId = location.state?.selectedCustomerId;
        if (preselectedId && data?.some((c) => c.id === preselectedId)) {
          setSelectedCustomerId(preselectedId);
        } else if (data && data.length > 0) {
          setSelectedCustomerId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching customers for messages:', err);
        setErrorMsg('Failed to load customers: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [user, location.state]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const businessName = business?.name || 'our business';
  const defaultCountryCode = business?.default_country_code || '+91';

  // Generate / update message text when type or customer changes
  useEffect(() => {
    const custName = selectedCustomer?.name || 'Customer';
    if (location.state?.followUpNote && messageType === 'follow_up') {
      setMessageText(
        `Hi ${custName}, this is ${businessName}. Following up regarding: ${location.state.followUpNote}. Please let us know if you need any assistance!`
      );
    } else {
      const template = DEFAULT_TEMPLATES[messageType] || DEFAULT_TEMPLATES.follow_up;
      const formatted = template
        .replace(/\{name\}/g, custName)
        .replace(/\{business\}/g, businessName);
      setMessageText(formatted);
    }
  }, [selectedCustomerId, messageType, businessName]);

  // Phone validation & normalization
  const phoneValidation = useMemo(() => {
    if (!selectedCustomer) {
      return { valid: false, error: 'No customer selected.', number: '' };
    }
    return normalizePhoneNumber(selectedCustomer.phone, defaultCountryCode);
  }, [selectedCustomer, defaultCountryCode]);

  const waLink = useMemo(() => {
    if (!phoneValidation.valid) return '#';
    return generateWaLink(phoneValidation.number, messageText);
  }, [phoneValidation, messageText]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp Message Generator</h1>
          <p className="page-subtitle">Personalize and dispatch 1-click WhatsApp messages to clients</p>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      {loading && (
        <div className="center-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading client directory...</p>
        </div>
      )}

      {!loading && customers.length === 0 && (
        <div className="card text-center" style={{ padding: '40px 20px' }}>
          <h3>No customers found</h3>
          <p className="text-muted" style={{ margin: '8px 0 16px' }}>
            Add customers with phone numbers to start sending WhatsApp messages.
          </p>
          <Link to="/customers" className="btn btn-primary">
            + Add Customers
          </Link>
        </div>
      )}

      {!loading && customers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          <div className="card">
            {/* Step 1: Select Customer */}
            <div className="form-group">
              <label htmlFor="msg-customer">1. Select Recipient Customer *</label>
              <select
                id="msg-customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                style={{ fontSize: '15px', fontWeight: 500 }}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone || '(No phone)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Phone Status */}
            <div style={{ marginBottom: '16px' }}>
              {selectedCustomer && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-page)',
                    border: `1px solid ${phoneValidation.valid ? 'var(--success)' : 'var(--danger)'}`,
                    fontSize: '13px',
                    color: 'var(--text-main)'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {phoneValidation.valid ? '✓ WhatsApp Number:' : '⚠️ Phone Issue:'}
                  </span>
                  {phoneValidation.valid ? (
                    <strong style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--success)' }}>
                      +{phoneValidation.number}
                    </strong>
                  ) : (
                    <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{phoneValidation.error}</span>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Message Type */}
            <div className="form-group">
              <label>2. Message Type / Template</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${messageType === 'follow_up' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMessageType('follow_up')}
                >
                  ⏰ Follow-up
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${messageType === 'review_request' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMessageType('review_request')}
                >
                  ⭐ Review Request
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${messageType === 'promotion' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMessageType('promotion')}
                >
                  🎁 Promotion / Discount
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${messageType === 'custom' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMessageType('custom')}
                >
                  ✏️ Custom
                </button>
              </div>
            </div>

            {/* Step 3: Editable Message */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="msg-textarea">3. Edit Message Text</label>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  {messageText.length} characters
                </span>
              </div>
              <textarea
                id="msg-textarea"
                rows="6"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                style={{ fontSize: '14px', lineHeight: '1.6' }}
              ></textarea>
              <span className="form-hint">
                You can freely edit the text before launching WhatsApp. Placeholders: {'{name}'} and {'{business}'}.
              </span>
            </div>

            {/* WhatsApp Open Action */}
            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <a
                href={phoneValidation.valid ? waLink : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success"
                style={{
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: 600,
                  opacity: phoneValidation.valid ? 1 : 0.5,
                  pointerEvents: phoneValidation.valid ? 'auto' : 'none'
                }}
                aria-disabled={!phoneValidation.valid}
              >
                💬 Open in WhatsApp
              </a>

              {!phoneValidation.valid && (
                <div style={{ fontSize: '13px', color: 'var(--danger)' }}>
                  Cannot open WhatsApp: {phoneValidation.error}{' '}
                  <Link to="/customers" style={{ textDecoration: 'underline' }}>
                    Edit customer phone
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
