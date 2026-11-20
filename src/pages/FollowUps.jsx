import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import FollowUpModal from '../components/FollowUpModal';

export default function FollowUps() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [followUps, setFollowUps] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter state
  const [activeTab, setActiveTab] = useState('pending'); // 'all' | 'pending' | 'overdue' | 'completed'
  const [customerFilter, setCustomerFilter] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialCustId, setInitialCustId] = useState(null);
  const [deletingFollowUp, setDeletingFollowUp] = useState(null);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch customers and follow-ups in parallel
      const [custRes, fuRes] = await Promise.all([
        supabase.from('customers').select('id, name, phone, email').order('name'),
        supabase
          .from('follow_ups')
          .select(`
            id,
            business_id,
            customer_id,
            due_date,
            note,
            completed,
            completed_at,
            created_at,
            customers:customer_id (id, name, phone)
          `)
      ]);

      if (custRes.error) throw custRes.error;
      if (fuRes.error) throw fuRes.error;

      setCustomers(custRes.data || []);
      setFollowUps(fuRes.data || []);
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
      setErrorMsg('Failed to load follow-up records: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Check if routed with a selected customer
  useEffect(() => {
    if (location.state?.selectedCustomerId) {
      setInitialCustId(location.state.selectedCustomerId);
      setIsModalOpen(true);
    }
  }, [location.state]);

  // Sort logic: Incomplete first (ordered by due_date ASC - soonest & overdue first),
  // then completed (ordered by completed_at or due_date DESC)
  const sortedFollowUps = useMemo(() => {
    return [...followUps].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1; // Incomplete first
      }
      if (!a.completed) {
        // Soonest due date first (overdue dates like 2026-11-10 are smaller, so they appear at top)
        return a.due_date.localeCompare(b.due_date);
      }
      // Completed: newest completion first
      return (b.completed_at || b.due_date).localeCompare(a.completed_at || a.due_date);
    });
  }, [followUps]);

  // Metrics
  const stats = useMemo(() => {
    let pending = 0;
    let overdue = 0;
    let completed = 0;

    followUps.forEach((fu) => {
      if (fu.completed) {
        completed++;
      } else {
        pending++;
        if (fu.due_date < todayStr) {
          overdue++;
        }
      }
    });

    return { total: followUps.length, pending, overdue, completed };
  }, [followUps, todayStr]);

  // Filtered list
  const filteredList = useMemo(() => {
    return sortedFollowUps.filter((fu) => {
      const isOverdue = !fu.completed && fu.due_date < todayStr;

      // Tab filter
      if (activeTab === 'pending' && fu.completed) return false;
      if (activeTab === 'overdue' && !isOverdue) return false;
      if (activeTab === 'completed' && !fu.completed) return false;

      // Customer filter
      if (customerFilter && fu.customer_id !== customerFilter) return false;

      return true;
    });
  }, [sortedFollowUps, activeTab, customerFilter, todayStr]);

  // Toggle complete
  const handleToggleComplete = async (fu) => {
    if (!user) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const nextCompleted = !fu.completed;
      const { data, error } = await supabase
        .from('follow_ups')
        .update({
          completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null
        })
        .eq('id', fu.id)
        .select(`
          id,
          business_id,
          customer_id,
          due_date,
          note,
          completed,
          completed_at,
          created_at,
          customers:customer_id (id, name, phone)
        `)
        .single();

      if (error) throw error;
      setFollowUps((prev) => prev.map((item) => (item.id === fu.id ? data : item)));
    } catch (err) {
      console.error('Error toggling complete:', err);
      setErrorMsg('Failed to update follow-up: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Schedule follow-up save
  const handleSaveFollowUp = async (formData) => {
    if (!user) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .insert({
          business_id: user.id,
          customer_id: formData.customer_id,
          due_date: formData.due_date,
          note: formData.note,
          completed: false
        })
        .select(`
          id,
          business_id,
          customer_id,
          due_date,
          note,
          completed,
          completed_at,
          created_at,
          customers:customer_id (id, name, phone)
        `)
        .single();

      if (error) throw error;
      setFollowUps((prev) => [data, ...prev]);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error scheduling follow-up:', err);
      setErrorMsg('Failed to schedule follow-up: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete follow-up
  const handleDeleteFollowUp = async () => {
    if (!deletingFollowUp || !user) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('follow_ups')
        .delete()
        .eq('id', deletingFollowUp.id);

      if (error) throw error;
      setFollowUps((prev) => prev.filter((item) => item.id !== deletingFollowUp.id));
      setDeletingFollowUp(null);
    } catch (err) {
      console.error('Error deleting follow-up:', err);
      setErrorMsg('Failed to delete follow-up: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p className="page-subtitle">Track reminders, inquiries, and customer care touchpoints</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setInitialCustId(null);
            setIsModalOpen(true);
          }}
          disabled={customers.length === 0}
        >
          + Schedule Follow-up
        </button>
      </div>

      {errorMsg && (
        <div className="alert alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      {/* Quick Summary Pill Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({stats.pending})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'overdue' ? 'btn-danger' : 'btn-outline'}`}
            onClick={() => setActiveTab('overdue')}
          >
            ⚠️ Overdue ({stats.overdue})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'completed' ? 'btn-success' : 'btn-outline'}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({stats.completed})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('all')}
          >
            All ({stats.total})
          </button>

          {customers.length > 0 && (
            <div style={{ marginLeft: 'auto', minWidth: '180px' }}>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                aria-label="Filter follow-ups by customer"
                style={{ padding: '6px 10px', fontSize: '13px' }}
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="center-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading follow-ups...</p>
        </div>
      )}

      {/* Empty customer state */}
      {!loading && customers.length === 0 && (
        <div className="card text-center" style={{ padding: '40px 20px' }}>
          <h3>No customers available</h3>
          <p className="text-muted" style={{ margin: '8px 0 16px' }}>
            You need to add at least one customer before scheduling follow-ups.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/customers')}>
            Go to Customers
          </button>
        </div>
      )}

      {/* Empty follow-ups list */}
      {!loading && customers.length > 0 && filteredList.length === 0 && (
        <div className="card text-center" style={{ padding: '40px 20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>⏰</div>
          <h3>No follow-ups found</h3>
          <p className="text-muted" style={{ margin: '6px 0 16px' }}>
            {activeTab === 'overdue'
              ? 'Great job! No overdue follow-ups right now.'
              : activeTab === 'pending'
              ? 'All caught up! No pending follow-ups.'
              : 'No follow-up reminders in this view.'}
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setInitialCustId(null);
              setIsModalOpen(true);
            }}
          >
            + Schedule One Now
          </button>
        </div>
      )}

      {/* Follow-ups table */}
      {!loading && filteredList.length > 0 && (
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Done</th>
                <th>Due Date &amp; Status</th>
                <th>Customer</th>
                <th>Note / Purpose</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((fu) => {
                const isOverdue = !fu.completed && fu.due_date < todayStr;
                const custName = fu.customers?.name || 'Unknown Customer';
                const custPhone = fu.customers?.phone;

                return (
                  <tr
                    key={fu.id}
                    style={{
                      backgroundColor: isOverdue ? 'var(--danger-light)' : undefined,
                      opacity: fu.completed ? 0.7 : 1
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={fu.completed}
                        onChange={() => handleToggleComplete(fu)}
                        disabled={actionLoading}
                        aria-label={`Mark follow-up for ${custName} as ${fu.completed ? 'incomplete' : 'complete'}`}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600 }}>{fu.due_date}</span>
                        {isOverdue && <span className="badge badge-danger">OVERDUE</span>}
                        {fu.completed && <span className="badge badge-success">Completed</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{custName}</div>
                      {custPhone && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {custPhone}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                        {fu.note || <span className="text-muted">No note specified</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {custPhone && (
                          <button
                            className="btn btn-outline btn-sm"
                            title="Open WhatsApp message for this customer"
                            onClick={() =>
                              navigate('/messages', {
                                state: {
                                  selectedCustomerId: fu.customer_id,
                                  followUpNote: fu.note
                                }
                              })
                            }
                          >
                            💬
                          </button>
                        )}
                        <button
                          className="btn btn-danger-outline btn-sm"
                          title="Delete follow-up"
                          onClick={() => setDeletingFollowUp(fu)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Follow-up modal */}
      <FollowUpModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setInitialCustId(null);
        }}
        onSave={handleSaveFollowUp}
        customers={customers}
        initialCustomerId={initialCustId}
        loading={actionLoading}
      />

      {/* Delete confirmation modal */}
      {deletingFollowUp && (
        <div className="modal-overlay" onClick={() => setDeletingFollowUp(null)} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Follow-up</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeletingFollowUp(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <p style={{ fontSize: '14px' }}>
              Are you sure you want to delete this follow-up for{' '}
              <strong>{deletingFollowUp.customers?.name || 'this customer'}</strong>?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeletingFollowUp(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteFollowUp}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
