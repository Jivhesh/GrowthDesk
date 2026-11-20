import React, { useState, useEffect } from 'react';

export default function CustomerModal({ isOpen, onClose, onSave, customer, loading }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [lastVisitDate, setLastVisitDate] = useState('');
  const [visitCount, setVisitCount] = useState(0);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setEmail(customer.email || '');
      setTagsInput(Array.isArray(customer.tags) ? customer.tags.join(', ') : '');
      setNotes(customer.notes || '');
      setLastVisitDate(customer.last_visit_date || '');
      setVisitCount(customer.visit_count ?? 0);
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setTagsInput('');
      setNotes('');
      setLastVisitDate('');
      setVisitCount(0);
    }
    setValidationError('');
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Customer name is required.');
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    const countNum = parseInt(visitCount, 10);
    if (isNaN(countNum) || countNum < 0) {
      setValidationError('Visit count must be a non-negative number.');
      return;
    }

    // Parse tags: split by comma, trim, eliminate empty strings, deduplicate
    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const uniqueTags = Array.from(new Set(tagsArray));

    setValidationError('');
    onSave({
      name: trimmedName,
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      tags: uniqueTags,
      notes: notes.trim(),
      last_visit_date: lastVisitDate || null,
      visit_count: countNum
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {customer ? 'Edit Customer' : 'Add New Customer'}
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
            <label htmlFor="cust-name">Customer Name *</label>
            <input
              id="cust-name"
              type="text"
              required
              placeholder="e.g. Sarah Jenkins"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="cust-phone">Phone Number</label>
            <input
              id="cust-phone"
              type="tel"
              placeholder="e.g. 9876543210 or +91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
            <span className="form-hint">Used for 1-click WhatsApp messaging and follow-ups.</span>
          </div>

          <div className="form-group">
            <label htmlFor="cust-email">Email Address</label>
            <input
              id="cust-email"
              type="email"
              placeholder="sarah@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cust-tags">Tags (comma-separated)</label>
            <input
              id="cust-tags"
              type="text"
              placeholder="e.g. VIP, Haircut, Regular, High-value"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="cust-last-visit">Last Visit Date</label>
              <input
                id="cust-last-visit"
                type="date"
                value={lastVisitDate}
                onChange={(e) => setLastVisitDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cust-visits">Visit Count</label>
              <input
                id="cust-visits"
                type="number"
                min="0"
                value={visitCount}
                onChange={(e) => setVisitCount(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cust-notes">Notes / Preferences</label>
            <textarea
              id="cust-notes"
              rows="3"
              placeholder="Preferences, allergy notes, favourite services..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            ></textarea>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : customer ? 'Update Customer' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

