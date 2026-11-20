import React, { useState, useEffect } from 'react';

export default function FollowUpModal({
  isOpen,
  onClose,
  onSave,
  customers,
  initialCustomerId,
  loading
}) {
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCustomerId(initialCustomerId || (customers[0]?.id ?? ''));
      // Default due date to tomorrow or today
      const today = new Date();
      today.setDate(today.getDate() + 1);
      setDueDate(today.toISOString().split('T')[0]);
      setNote('');
      setValidationError('');
    }
  }, [isOpen, initialCustomerId, customers]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerId) {
      setValidationError('Please select a customer.');
      return;
    }
    if (!dueDate) {
      setValidationError('Please specify a due date.');
      return;
    }

    setValidationError('');
    onSave({
      customer_id: customerId,
      due_date: dueDate,
      note: note.trim()
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="follow-up-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="follow-up-title" className="modal-title">Schedule Follow-up</h2>
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
            <label htmlFor="fu-customer">Select Customer *</label>
            <select
              id="fu-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={loading || Boolean(initialCustomerId && customers.length <= 1)}
              required
            >
              {customers.length === 0 && <option value="">No customers available</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="fu-due-date">Due Date *</label>
            <input
              id="fu-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="fu-note">Note / Purpose</label>
            <textarea
              id="fu-note"
              rows="3"
              placeholder="e.g. Call to check after keratin treatment, ask for Google review, remind about monthly gym renewal..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={loading}
            ></textarea>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || customers.length === 0}>
              {loading ? 'Scheduling...' : 'Save Follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

