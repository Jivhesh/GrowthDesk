import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import CustomerModal from '../components/CustomerModal';
import FollowUpModal from '../components/FollowUpModal';

export default function Customers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingCustomer, setDeletingCustomer] = useState(null);

  // Detail drawer & associated follow-ups
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customerFollowUps, setCustomerFollowUps] = useState([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const fetchCustomers = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customers:', error);
        setErrorMsg('Failed to load customers: ' + error.message);
      } else {
        setCustomers(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching customers:', err);
      setErrorMsg('An unexpected error occurred while loading customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [user]);

  // When viewingCustomer changes, fetch their follow-ups
  useEffect(() => {
    if (!viewingCustomer || !user) {
      setCustomerFollowUps([]);
      return;
    }
    const fetchCustomerFollowUps = async () => {
      setLoadingFollowUps(true);
      try {
        const { data, error } = await supabase
          .from('follow_ups')
          .select('*')
          .eq('customer_id', viewingCustomer.id)
          .order('due_date', { ascending: true });

        if (error) throw error;
        setCustomerFollowUps(data || []);
      } catch (err) {
        console.error('Error fetching customer follow-ups:', err);
      } finally {
        setLoadingFollowUps(false);
      }
    };
    fetchCustomerFollowUps();
  }, [viewingCustomer, user]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set();
    customers.forEach((c) => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach((tag) => tag && tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [customers]);

  // Filtered customers based on search query and tag filter
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return customers.filter((cust) => {
      const matchesName = cust.name?.toLowerCase().includes(query);
      const matchesPhone = cust.phone?.toLowerCase().includes(query);
      const matchesTags = Array.isArray(cust.tags) && cust.tags.some((t) => t.toLowerCase().includes(query));
      const matchesSearch = !query || matchesName || matchesPhone || matchesTags;

      const matchesSelectedTag = !selectedTag || (Array.isArray(cust.tags) && cust.tags.includes(selectedTag));

      return matchesSearch && matchesSelectedTag;
    });
  }, [customers, searchQuery, selectedTag]);

  // Save handler (Add or Update)
  const handleSaveCustomer = async (formData) => {
    if (!user) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      if (editingCustomer) {
        const { data, error } = await supabase
          .from('customers')
          .update({
            ...formData,
            business_id: user.id
          })
          .eq('id', editingCustomer.id)
          .select()
          .single();

        if (error) throw error;
        setCustomers((prev) => prev.map((c) => (c.id === editingCustomer.id ? data : c)));
      } else {
        const { data, error } = await supabase
          .from('customers')
          .insert({
            ...formData,
            business_id: user.id
          })
          .select()
          .single();

        if (error) throw error;
        setCustomers((prev) => [data, ...prev]);
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
    } catch (err) {
      console.error('Error saving customer:', err);
      setErrorMsg('Failed to save customer: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete handler with confirmation
  const handleDeleteCustomer = async () => {
    if (!deletingCustomer || !user) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', deletingCustomer.id);

      if (error) throw error;
      setCustomers((prev) => prev.filter((c) => c.id !== deletingCustomer.id));
      setDeletingCustomer(null);
      if (viewingCustomer?.id === deletingCustomer.id) {
        setViewingCustomer(null);
      }
    } catch (err) {
      console.error('Error deleting customer:', err);
      setErrorMsg('Failed to delete customer: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Quick toggle complete on customer detail view
  const handleToggleFollowUpComplete = async (fu) => {
    if (!user) return;
    try {
      const nextVal = !fu.completed;
      const { data, error } = await supabase
        .from('follow_ups')
        .update({
          completed: nextVal,
          completed_at: nextVal ? new Date().toISOString() : null
        })
        .eq('id', fu.id)
        .select()
        .single();

      if (error) throw error;
      setCustomerFollowUps((prev) => prev.map((item) => (item.id === fu.id ? data : item)));
    } catch (err) {
      console.error('Error toggling follow-up:', err);
    }
  };

  // Save follow-up created directly from customer detail view
  const handleSaveFollowUp = async (formData) => {
    if (!user || !viewingCustomer) return;
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .insert({
          business_id: user.id,
          customer_id: viewingCustomer.id,
          due_date: formData.due_date,
          note: formData.note,
          completed: false
        })
        .select()
        .single();

      if (error) throw error;
      setCustomerFollowUps((prev) => [...prev, data]);
      setIsFollowUpModalOpen(false);
    } catch (err) {
      console.error('Error adding follow-up:', err);
      alert('Failed to save follow-up: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">
            {customers.length} total {customers.length === 1 ? 'customer' : 'customers'} enrolled
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingCustomer(null);
            setIsModalOpen(true);
          }}
        >
          + Add Customer
        </button>
      </div>

      {/* Global Action Error */}
      {errorMsg && (
        <div className="alert alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Search and Filters */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1', minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by name, phone, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search customers"
            />
          </div>

          <div style={{ width: '200px' }}>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              aria-label="Filter by tag"
            >
              <option value="">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  Tag: {tag}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || selectedTag) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedTag('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="center-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading customers...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && customers.length === 0 && (
        <div className="card text-center" style={{ padding: '48px 24px' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>👥</div>
          <h3>No customers added yet</h3>
          <p className="text-muted" style={{ maxWidth: '400px', margin: '8px auto 20px' }}>
            Start building your private customer list to keep track of visits, preferences, and automated follow-ups.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingCustomer(null);
              setIsModalOpen(true);
            }}
          >
            + Add Your First Customer
          </button>
        </div>
      )}

      {/* Filtered Empty State */}
      {!loading && customers.length > 0 && filteredCustomers.length === 0 && (
        <div className="card text-center" style={{ padding: '36px 24px' }}>
          <p className="text-muted">No customers match your search or filter.</p>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginTop: '12px' }}
            onClick={() => {
              setSearchQuery('');
              setSelectedTag('');
            }}
          >
            Reset Search
          </button>
        </div>
      )}

      {/* Customers Table */}
      {!loading && filteredCustomers.length > 0 && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Tags</th>
                <th>Visits</th>
                <th>Last Visit</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((cust) => (
                <tr key={cust.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{cust.name}</div>
                    {cust.email && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cust.email}</div>}
                  </td>
                  <td>
                    {cust.phone ? (
                      <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{cust.phone}</span>
                    ) : (
                      <span style={{ color: 'var(--text-light)', fontSize: '12px' }}>No phone</span>
                    )}
                  </td>
                  <td>
                    {Array.isArray(cust.tags) && cust.tags.length > 0 ? (
                      <div className="tags-list">
                        {cust.tags.map((t, idx) => (
                          <span key={idx} className="badge">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-light)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-success">{cust.visit_count ?? 0}</span>
                  </td>
                  <td>
                    {cust.last_visit_date ? (
                      <span style={{ fontSize: '13px' }}>{cust.last_visit_date}</span>
                    ) : (
                      <span style={{ color: 'var(--text-light)', fontSize: '12px' }}>Never</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        title="View details & follow-ups"
                        onClick={() => setViewingCustomer(cust)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        title="Edit customer"
                        onClick={() => {
                          setEditingCustomer(cust);
                          setIsModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        title="Open WhatsApp message generator"
                        onClick={() => navigate('/messages', { state: { selectedCustomerId: cust.id } })}
                      >
                        💬
                      </button>
                      <button
                        className="btn btn-danger-outline btn-sm"
                        title="Delete customer"
                        onClick={() => setDeletingCustomer(cust)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Create/Edit Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleSaveCustomer}
        customer={editingCustomer}
        loading={actionLoading}
      />

      {/* Customer Detail Drawer / Modal with Follow-ups */}
      {viewingCustomer && (
        <div className="modal-overlay" onClick={() => setViewingCustomer(null)} role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{viewingCustomer.name}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setViewingCustomer(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <strong>Phone:</strong>{' '}
                  {viewingCustomer.phone ? (
                    <span style={{ fontFamily: 'monospace' }}>{viewingCustomer.phone}</span>
                  ) : (
                    <span className="text-muted">Not specified</span>
                  )}
                </div>
                <div>
                  <strong>Email:</strong> {viewingCustomer.email || <span className="text-muted">Not specified</span>}
                </div>
                <div>
                  <strong>Visit Count:</strong> {viewingCustomer.visit_count ?? 0}
                </div>
                <div>
                  <strong>Last Visit:</strong>{' '}
                  {viewingCustomer.last_visit_date || <span className="text-muted">No visits recorded</span>}
                </div>
              </div>

              <div>
                <strong>Tags:</strong>
                <div className="tags-list" style={{ marginTop: '6px' }}>
                  {Array.isArray(viewingCustomer.tags) && viewingCustomer.tags.length > 0 ? (
                    viewingCustomer.tags.map((t, idx) => (
                      <span key={idx} className="badge">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">No tags</span>
                  )}
                </div>
              </div>

              <div>
                <strong>Notes / Preferences:</strong>
                <div
                  style={{
                    backgroundColor: 'var(--bg-page)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    marginTop: '4px',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {viewingCustomer.notes || <span className="text-muted">No notes recorded.</span>}
                </div>
              </div>

              {/* Follow-ups section inside Customer Detail */}
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Scheduled Follow-ups</h3>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setIsFollowUpModalOpen(true)}
                  >
                    + Add Follow-up
                  </button>
                </div>

                {loadingFollowUps ? (
                  <p className="text-muted" style={{ fontSize: '13px' }}>Loading follow-ups...</p>
                ) : customerFollowUps.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '13px', fontStyle: 'italic' }}>
                    No follow-ups scheduled for {viewingCustomer.name}.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {customerFollowUps.map((fu) => {
                      const isOverdue = !fu.completed && fu.due_date < todayStr;
                      return (
                        <div
                          key={fu.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${isOverdue ? 'var(--danger-border)' : 'var(--border-color)'}`,
                            backgroundColor: isOverdue ? 'var(--danger-light)' : 'var(--bg-page)',
                            fontSize: '13px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="checkbox"
                              checked={fu.completed}
                              onChange={() => handleToggleFollowUpComplete(fu)}
                              aria-label="Toggle completed"
                            />
                            <div>
                              <span style={{ fontWeight: 600 }}>{fu.due_date}</span>
                              {isOverdue && (
                                <span className="badge badge-danger" style={{ marginLeft: '6px' }}>
                                  OVERDUE
                                </span>
                              )}
                              {fu.completed && (
                                <span className="badge badge-success" style={{ marginLeft: '6px' }}>
                                  Done
                                </span>
                              )}
                              <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                                {fu.note || 'No note'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button
                className="btn btn-outline"
                onClick={() => setViewingCustomer(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const target = viewingCustomer;
                  setViewingCustomer(null);
                  navigate('/messages', { state: { selectedCustomerId: target.id } });
                }}
              >
                💬 WhatsApp Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCustomer && (
        <div className="modal-overlay" onClick={() => setDeletingCustomer(null)} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Customer</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeletingCustomer(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)' }}>
              Are you sure you want to delete <strong>{deletingCustomer.name}</strong>?
            </p>
            <p className="text-muted" style={{ fontSize: '13px', marginTop: '8px' }}>
              ⚠️ This will also permanently delete all follow-ups and history associated with this customer. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeletingCustomer(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteCustomer}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up modal from customer detail view */}
      {viewingCustomer && (
        <FollowUpModal
          isOpen={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
          onSave={handleSaveFollowUp}
          customers={[viewingCustomer]}
          initialCustomerId={viewingCustomer.id}
          loading={false}
        />
      )}
    </div>
  );
}
